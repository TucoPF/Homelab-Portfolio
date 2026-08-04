# Homelab Tiered Storage Architecture

## 🚀 Current Configuration: Fusion v4.0 (ZFS over iSCSI SAN & God-Mode ACL Architecture - July 2026)
This section reflects the transition to a high-performance native Proxmox ZFS over iSCSI SAN (`iscsiprovider LIO`) to eliminate NFS overhead, prevent systemd boot loops via persistent `iscsid` database tuning (`node.startup = manual`), and maintain God-Mode ACLs across tiered storage.

### 🏗️ Architecture Overview
*   **SAN Backend (skynet):**
    *   **Hardware:** 4x 10TB Seagate Exos SAS HDDs.
    *   **Role:** Exports 2 raw SAS block devices over the network via iSCSI LIO for the Media Tier (`disk1`, `disk2`). Natively pools the other 2 drives into a ZFS Mirror (`zfs-pool`) exposed locally as **`Local-pool`** (`zfspool`) and remotely to `matrix` via Proxmox ZFS over iSCSI (`LIO` provider).
*   **The Brain / Compute (matrix):**
    *   **Role:** Connects to skynet via iSCSI to map the 2 Media LUNs locally as `sda`, `sdd` (EXT4 pooled via MergerFS at `/mnt/matrix-pool`). Connects to skynet's ZFS pool over the 10G link (`fddd::2`) as **`Remote-pool`** via native Proxmox ZFS over iSCSI for dynamic VM/LXC ZVOL disk provisioning.
*   **Storage Pools:**
    *   **Cloud Tier (skynet Native & matrix Remote):** ~10TB high-integrity ZFS Mirror at `zfs-pool`. Exposed natively on skynet as `Local-pool` and on matrix as `Remote-pool` over the 10G `fddd::/64` link.
    *   **Media Tier (matrix Managed):** ~18TB usable (EXT4 `disk1` and `disk2` pooled via MergerFS at `/mnt/matrix-pool` on matrix).
*   **The Glue:** MergerFS on matrix combines the local SSD cache (`/mnt/matrix-cache`) and the Media Tier HDD pool (`/mnt/matrix-pool`) at `/mnt/fusion`.

### 💾 Partition & Hardware Mapping
| iSCSI LUN / Target (skynet) | Local Block / Storage ID (matrix) | Filesystem | Role / Pool |
| :--- | :--- | :--- | :--- |
| `media-disk1` (LUN 0) | `/dev/sda` | `ext4` (LABEL=disk1) | Media Tier (`matrix-pool`) |
| `media-disk2` (LUN 1) | `/dev/sdb` | `ext4` (LABEL=disk2) | Media Tier (`matrix-pool`) |
| `Local-pool` (skynet Native) | `zfs-pool` (sdb/sdc mirror) | `ZFS` | Cloud Tier (Local LXCs/VMs) |
| `Remote-pool` (matrix ZFS-o-iSCSI)| `[fddd::2]:3260` (LIO provider) | `ZFS over iSCSI` | Cloud Tier (Remote VM ZVOLs) |

### 📝 Core Configuration Files
#### matrix (`/etc/fstab` & `storage_gatekeeper.sh`) - Asynchronous SAN Mounting
Physical media layers (`disk1`, `disk2`, `matrix-pool`, `fusion`) are decoupled from `/etc/fstab` to eliminate host boot dependencies and timing race conditions. Probed and mounted asynchronously post-boot by `/home/tuco/scripts/storage_gatekeeper.sh` via `storage-gatekeeper.service`.
```text
# Local NVMe Cache SSD (Samsung 990 Pro)
UUID=3f74a8bb-8adc-44b0-a2a1-093ed387c4c0  /mnt/matrix-cache  ext4  defaults,noatime,nofail,noexec  0  2

# iSCSI Local Disks (EXT4 Media)
LABEL=disk1 /mnt/disk1 ext4 _netdev,noatime,nofail,noexec,x-systemd.device-timeout=5s 0 2
LABEL=disk2 /mnt/disk2 ext4 _netdev,noatime,nofail,noexec,x-systemd.device-timeout=5s 0 2

# matrix MergerFS Pool (Local HDDs)
/mnt/disk1:/mnt/disk2 /mnt/matrix-pool mergerfs defaults,nonempty,allow_other,use_ino,cache.files=partial,dropcacheonclose=true,category.create=epmfs,minfreespace=20G,_netdev,nofail,noexec,x-systemd.after=/mnt/disk1,x-systemd.after=/mnt/disk2 0 0

# Fusion Tiered Pool (Local NVMe Cache + Local HDD Pool)
/mnt/matrix-cache:/mnt/matrix-pool /mnt/fusion mergerfs defaults,nonempty,allow_other,use_ino,cache.files=partial,dropcacheonclose=true,attr_timeout=2,entry_timeout=2,category.create=ff,minfreespace=20G,_netdev,nofail,noexec,x-systemd.after=/mnt/matrix-pool,x-systemd.after=/mnt/matrix-cache 0 0
```

### ⚙️ Proxmox Storage Configuration (`/etc/pve/storage.cfg`)
```text
zfspool: Local-pool
	pool zfs-pool
	content images,rootdir
	nodes skynet
	sparse 1

zfs: Remote-pool
	blocksize 16k
	iscsiprovider LIO
	pool zfs-pool
	portal fddd::2
	lio_tpg tpg1
	target iqn.2024-01.local.homelab:skynet-target
	content images
	nodes matrix
	sparse 1
	zfs-base-path /dev/zvol
```

### 🔒 Permissions & Security (The God-Mode ACLs)
*   **The Problem:** Unprivileged LXC containers map internal users (like UID 1000) to host users (like `101000`), causing permission failures when writing to shared host directories unless complex `lxc.idmap` configs were used.
*   **The Solution:** We deployed Default POSIX ACLs directly onto the physical drives (`matrix-cache`, `disk1`, `disk2`):
    ```bash
    sudo setfacl -d -m u::rwx,g::rwx,o::rwx /mnt/matrix-cache
    ```
*   **Result:** The Linux kernel forces `777` permissions onto all files created by any container, completely bypassing unprivileged UID conflicts.
*   **GPU Hardware Transcoding (Targeted ID Mapping):** To allow unprivileged containers (e.g., Jellyfin) to use Intel QuickSync without breaking the God-Mode ACLs for media files, the `lxc.idmap` was strictly targeted. The UID `1000` mapping was removed, but `video (44)` and `render (993)` groups were mapped back to the host:
    ```text
    lxc.idmap: u 0 100000 65536
    lxc.idmap: g 0 100000 44
    lxc.idmap: g 44 44 1
    lxc.idmap: g 45 100045 948
    lxc.idmap: g 993 993 1
    lxc.idmap: g 994 100994 64542
    ```

### 🔄 Automation: The Nightly Mover (Optimized systemd Mover)
*   **Logic:** It checks the local high-speed SSD cache (`/mnt/matrix-cache`) for movies, shows, and music files that have been idle (unmodified) for > 120 minutes, and transfers them to the sub-pool `matrix-pool`.
*   **Balancing:** Because it writes to `matrix-pool`, MergerFS automatically balances the writes across `disk1` and `disk2` using the `epmfs` policy.
*   **Script Location (matrix):** `/home/tuco/scripts/fusion_mover.sh`

### 🧠 Key Architecture & Troubleshooting Learnings
1. **Persistent `open-iscsi` Node Database Boot Hangs:**
    *   **Issue:** Automatic target logins (`node.startup = automatic` in `/var/lib/iscsi/nodes/`) caused `open-iscsi.service` to spend 4+ minutes retrying logins to `fddd::2:3260` during boot when `skynet` was offline or starting up, blocking Proxmox startup.
    *   **Fix:** Updated target node DB records using `iscsiadm -m node -T iqn... -o update -n node.startup -v manual` and set fast connection timeouts (`login_timeout = 3`, `initial_login_retry_max = 2`), reducing userspace boot from 4m22s to 1m38s.
2. **Container Storage ID Binding:**
    *   **Issue:** Renaming storage IDs in `/etc/pve/storage.cfg` broke container rootfs/subvol bindings on `skynet` because container configs in `/etc/pve/nodes/skynet/lxc/*.conf` hardcode storage ID prefixes (`zfs-pool:subvol-XXX-disk-0`).
    *   **Fix:** Updated LXC container volume references on `skynet` to match the local storage ID `Local-pool:`.
