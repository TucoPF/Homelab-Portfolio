# Homelab Tiered Storage Architecture

## 🚀 Current Configuration: Fusion v3.0 (iSCSI SAN Architecture - June 2026)
This section reflects the transition of **Skynet** to a pure iSCSI SAN Backend and the consolidation of storage management on **Matrix**.

### 🏗️ Architecture Overview
*   **SAN Backend (Skynet - LIO Target):**
    *   **Hardware:** 4x 10TB Seagate Exos SAS HDDs.
    *   **Role:** Exports 2 raw SAS block devices over the network via iSCSI LIO for Media. Natively hosts a ZFS pool (`zfs-pool`) on the other 2 drives for Cloud Storage.
*   **The Brain / Initiator (Matrix):**
    *   **Role:** Connects to Skynet via iSCSI and maps the 2 Media LUNs locally as `sda`, `sdd`. Connects to the Skynet ZFS pool via Proxmox "ZFS over iSCSI" plugin for LXC virtual disks.
*   **Storage Pools:**
    *   **Cloud Tier (Skynet Native):** ~10TB high-integrity (ZFS Mirror pooling `/dev/sdb` and `/dev/sdc`) at `zfs-pool` on Skynet. Consumed natively by Matrix Proxmox via ZFS-over-iSCSI.
    *   **Media Tier (Matrix Managed):** ~18TB usable (EXT4 `disk1` and `disk2` pooled via MergerFS at `/mnt/matrix-pool` on Matrix).
*   **The Glue:** MergerFS on Matrix combines the local SSD cache (`/mnt/matrix-cache`) and the Media Tier HDD pool (`/mnt/matrix-pool`) at `/mnt/fusion`.

### 💾 Partition & Hardware Mapping
| iSCSI LUN (Skynet) | Local Block (Matrix) | Filesystem | Role / Pool |
| :--- | :--- | :--- | :--- |
| `disk1` (LUN 0) | `/dev/sda` | `ext4` (LABEL=disk1) | Media Tier (`matrix-pool`) |
| `disk2` (LUN 1) | `/dev/sdb` | `ext4` (LABEL=disk2) | Media Tier (`matrix-pool`) |
| N/A (Skynet Native) | N/A | ZFS Member (`/dev/sdb` on Skynet)| Cloud Tier (`zfs-pool` Mirror) |
| N/A (Skynet Native) | N/A | ZFS Member (`/dev/sdc` on Skynet)| Cloud Tier (`zfs-pool` Mirror) |

### 📝 Core Configuration Files
#### Matrix (`/etc/fstab`)
```text
# Local NVMe Cache SSD (Samsung 990 Pro)
UUID=3f74a8bb-8adc-44b0-a2a1-093ed387c4c0  /mnt/matrix-cache  ext4  defaults,noatime,nofail  0  2

# iSCSI Local Disks (EXT4 Media)
LABEL=disk1 /mnt/disk1 ext4 _netdev,noatime,nofail 0 2
LABEL=disk2 /mnt/disk2 ext4 _netdev,noatime,nofail 0 2

# Matrix MergerFS Pool (Local HDDs)
/mnt/disk1:/mnt/disk2 /mnt/matrix-pool mergerfs defaults,nonempty,allow_other,use_ino,cache.files=partial,dropcacheonclose=true,category.create=epmfs,minfreespace=20G,_netdev,nofail,x-systemd.after=/mnt/disk1,x-systemd.after=/mnt/disk2 0 0

# Fusion Tiered Pool (Local NVMe Cache + Local HDD Pool)
/mnt/matrix-cache:/mnt/matrix-pool /mnt/fusion mergerfs defaults,nonempty,allow_other,use_ino,cache.files=partial,dropcacheonclose=true,attr_timeout=2,entry_timeout=2,category.create=ff,minfreespace=20G,_netdev,nofail,x-systemd.after=/mnt/matrix-pool,x-systemd.after=/mnt/matrix-cache 0 0

# Centralized Backup Storage
# Backups are now handled natively by Proxmox Backup Server on Skynet over the 10G link ([fddd::2]:8007).
# No local fstab mounts required for backups.
```

#### Skynet (`targetcli`) & Proxmox ZFS over iSCSI (`zscsi`)
Skynet uses `targetcli` to export the drives via IQN `iqn.2024-01.local.homelab:skynet-target` listening on IPv6 `[fddd::2]:3260`.

### ⚙️ Proxmox ZFS over iSCSI Configuration (`zpool`)
Matrix consumes `zfs-pool` on Skynet dynamically via Proxmox's native `zscsi` plugin.

#### Datacenter Storage Parameters (`/etc/pve/storage.cfg`)
```text
zfs: zpool
	blocksize 16k
	iscsiprovider LIO
	pool zfs-pool
	portal skynet-san
	target iqn.2024-01.local.homelab:skynet-target
	content images,rootdir
	lio_tpg tpg1
	nodes matrix
	nowritecache 1
	sparse 1
	zfs-base-path /dev/zvol
```

#### Key Architecture & Troubleshooting Learnings
1. **QEMU `libiscsi` IPv6 Parser Bug (`skynet-san` resolution):**
   * **Issue:** Setting the portal directly to an unbracketed IPv6 literal (`fddd::2`) causes QEMU `blockdev-add` to fail with `Invalid target:fddd::2 Can not resolv into IPv4/v6`.
   * **Fix:** Use the hostname alias `skynet-san` (defined in `/etc/hosts` as `fddd::2 skynet-san`). Standard Glibc `getaddrinfo` handles hostname resolution cleanly without triggering QEMU URL parsing errors.
2. **SSH Authentication Key Mapping:**
   * **Requirement:** Proxmox requires an SSH key at `/etc/pve/priv/zfs/<portal>_id_rsa`.
   * **Setup:** Link `/etc/pve/priv/zfs/skynet-san_id_rsa` to `/etc/pve/priv/zfs/fddd::2_id_rsa` (mode `0600`).
3. **ZFS Base Path (`/dev/zvol`):**
   * If the SSH probe fails during initial GUI storage creation (e.g. missing SSH key), Proxmox auto-detection falls back to legacy `/dev`.
   * **Fix:** Explicitly define `zfs-base-path /dev/zvol` to ensure Proxmox points to Linux ZVOL block symlinks (`/dev/zvol/zfs-pool/...`).
4. **Blocksize Optimization (`16k`):**
   * Set `blocksize 16k` to eliminate 4K `volblocksize` warnings, optimize ZFS metadata overhead, and prevent space amplification on 4K-native SAS HDDs.

---

## 🔄 Automation: The Nightly Mover (Optimized systemd Mover)
To maximize drive performance, manage local SSD space, and reduce mechanical disk fragmentation, the mover script runs locally on **Matrix** every day at **03:00 AM** via a systemd service/timer.

*   **Logic:** It checks the local high-speed SSD cache (`/mnt/matrix-cache`) for movies, shows, and music files that have been idle (unmodified) for > 120 minutes, and transfers them to the sub-pool `matrix-pool`.
*   **Balancing:** Because it writes to `matrix-pool`, MergerFS automatically balances the files across `disk1` and `disk2` using the `epmfs` policy.
*   **Script Location (Matrix):** `/home/tuco/scripts/fusion_mover.sh`

## 🔒 Permissions & Security
*   **Unprivileged LXC Mapping:** `root:1000:1` is active in `subuid`/`subgid` on both nodes.
*   All drives and the MergerFS pool are owned by `tuco:tuco` (1000:1000).
*   Inside the LXC (Arr-Stack), the user `arr` runs as UID 1000, ensuring seamless file creation and movement across the network without permission errors.

## 🚀 Performance & Verification
*   **ZFS over iSCSI:** Matrix manages LXC volumes seamlessly over the network using the Proxmox Datacenter plugin, creating ZVOLs dynamically on Skynet. This eliminates systemd boot loop cycles on Matrix.
*   **Cooling:** Jonsbo N5 system fans and SAS HBA cooling verified. Under load, drive temps remained stable at **~31°C**.
*   **Resilience:** `nofail` and `_netdev` flags ensure Matrix boots cleanly even if Skynet is offline.

