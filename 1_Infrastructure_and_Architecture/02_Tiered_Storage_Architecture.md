# Homelab Tiered Storage Architecture

## 🚀 Current Configuration: Fusion v4.0 (NFS SAN & God-Mode ACL Architecture - July 2026)
This section reflects the transition from ZFS-over-iSCSI to a native NFS Datastore to eliminate systemd boot loops, and the implementation of God-Mode ACLs to purify Proxmox container permissions.

### 🏗️ Architecture Overview
*   **SAN Backend (skynet):**
    *   **Hardware:** 4x 10TB Seagate Exos SAS HDDs.
    *   **Role:** Exports 2 raw SAS block devices over the network via iSCSI LIO for the Media Tier. Natively pools the other 2 drives into a ZFS Mirror (`zfs-pool`) and exports a dataset via NFS for the Cloud/Compute Tier.
*   **The Brain / Compute (matrix):**
    *   **Role:** Connects to skynet via iSCSI to map the 2 Media LUNs locally as `sda`, `sdd`. Connects to the skynet ZFS pool via native NFS (`skynet-NFS`) for isolated Proxmox LXC virtual disks.
*   **Storage Pools:**
    *   **Cloud Tier (skynet Native):** ~10TB high-integrity ZFS Mirror at `zfs-pool`. Exported via NFS (`/zfs-pool/pve-nfs`) over the 10G `fddd::/64` link.
    *   **Media Tier (matrix Managed):** ~18TB usable (EXT4 `disk1` and `disk2` pooled via MergerFS at `/mnt/matrix-pool` on matrix).
*   **The Glue:** MergerFS on matrix combines the local SSD cache (`/mnt/matrix-cache`) and the Media Tier HDD pool (`/mnt/matrix-pool`) at `/mnt/fusion`.

### 💾 Partition & Hardware Mapping
| iSCSI LUN (skynet) | Local Block (matrix) | Filesystem | Role / Pool |
| :--- | :--- | :--- | :--- |
| `disk1` (LUN 0) | `/dev/sda` | `ext4` (LABEL=disk1) | Media Tier (`matrix-pool`) |
| `disk2` (LUN 1) | `/dev/sdb` | `ext4` (LABEL=disk2) | Media Tier (`matrix-pool`) |
| N/A (skynet Native) | N/A | ZFS Member (`/dev/sdb` on skynet)| Cloud Tier (`zfs-pool` Mirror) |
| N/A (skynet Native) | N/A | ZFS Member (`/dev/sdc` on skynet)| Cloud Tier (`zfs-pool` Mirror) |

### 📝 Core Configuration Files
#### matrix (`/etc/fstab`) - Hardware Execution Lock
All physical media layers are mounted with `noexec` to prevent malicious script execution, counterbalancing the public `777` ACLs.
```text
# Local NVMe Cache SSD (Samsung 990 Pro)
UUID=3f74a8bb-8adc-44b0-a2a1-093ed387c4c0  /mnt/matrix-cache  ext4  defaults,noatime,nofail,noexec  0  2

# iSCSI Local Disks (EXT4 Media)
LABEL=disk1 /mnt/disk1 ext4 _netdev,noatime,nofail,noexec 0 2
LABEL=disk2 /mnt/disk2 ext4 _netdev,noatime,nofail,noexec 0 2

# matrix MergerFS Pool (Local HDDs)
/mnt/disk1:/mnt/disk2 /mnt/matrix-pool mergerfs defaults,nonempty,allow_other,use_ino,cache.files=partial,dropcacheonclose=true,category.create=epmfs,minfreespace=20G,_netdev,nofail,noexec,x-systemd.after=/mnt/disk1,x-systemd.after=/mnt/disk2 0 0

# Fusion Tiered Pool (Local NVMe Cache + Local HDD Pool)
/mnt/matrix-cache:/mnt/matrix-pool /mnt/fusion mergerfs defaults,nonempty,allow_other,use_ino,cache.files=partial,dropcacheonclose=true,attr_timeout=2,entry_timeout=2,category.create=ff,minfreespace=20G,_netdev,nofail,noexec,x-systemd.after=/mnt/matrix-pool,x-systemd.after=/mnt/matrix-cache 0 0
```

#### skynet NFS Export (`/etc/exports`)
skynet natively hosts the ZFS pool and explicitly exports it to matrix over the 10G link, avoiding Proxmox iSCSI loopback complications.
```text
/zfs-pool/pve-nfs fddd::/64(rw,sync,no_root_squash,no_subtree_check) 
```

### ⚙️ Proxmox Storage Configuration (`/etc/pve/storage.cfg`)
matrix dynamically consumes the skynet NFS export. The storage is explicitly restricted to `nodes matrix` to prevent skynet from loopback-mounting its own NFS export.
```text
nfs: nfs
	export /zfs-pool/pve-nfs
	path /mnt/pve/nfs
	server skynet-san
	content backup,snippets,rootdir,images,iso,vztmpl,import
	nodes matrix
	options vers=4.2
	preallocation off
	prune-backups keep-all=1
```

### 🔒 Permissions & Security (The God-Mode ACLs)
*   **The Problem:** Unprivileged LXC containers map internal users (like UID 1000) to host users (like `101000`), causing permission failures when writing to shared host directories unless complex `lxc.idmap` configs were used.
*   **The Solution:** We deployed Default POSIX ACLs directly onto the physical drives (`matrix-cache`, `disk1`, `disk2`):
    ```bash
    sudo setfacl -d -m u::rwx,g::rwx,o::rwx /mnt/matrix-cache
    ```
*   **Result:** The Linux kernel forces `777` permissions onto all files created by any container, completely bypassing unprivileged UID conflicts. All `lxc.idmap` mappings were deleted (except for specific GPU group mappings below), returning the homelab to a factory-standard Proxmox configuration. 
*   **GPU Hardware Transcoding (Targeted ID Mapping):** To allow unprivileged containers (e.g., Jellyfin) to use Intel QuickSync without breaking the God-Mode ACLs for media files, the `lxc.idmap` was strictly targeted. The UID `1000` mapping was removed (forcing the app to run as standard `101000` so it works with the Media ACLs), but the `video (44)` and `render (993)` groups were mapped perfectly back to the host to preserve GPU access without `udev` hacks:
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
1. **ZFS over iSCSI Systemd Death Loop:**
    *   **Issue:** Attempting to run a native ZFS pool on matrix over iSCSI block devices triggered a fatal `systemd` ordering cycle (`local-fs.target` -> `zfs-mount` -> `open-iscsi`).
    *   **Fix:** Decoupled ZFS from matrix entirely. Moved the ZFS pool natively to skynet and exported it as a standard NFS Datastore to matrix.
2. **Purifying Unprivileged Containers (Removing `lxc.idmap`):**
    *   **Issue:** When removing `lxc.idmap` from a container, its physical files on the host are left orphaned at the old Host UID, breaking internal services.
    *   **Fix:** Dynamically shift the ownership on the host by diving into the container's running namespace and updating the old UID to the new default unprivileged UID (`101000`):
        ```bash
        PID=$(sudo lxc-info -n <CT_ID> -p | awk '{print $2}')
        sudo find /proc/$PID/root/ -xdev \( -uid 1000 -o -gid 1000 \) -exec chown -h 101000:101000 {} +
        ```
3. **NFS I/O Failures:**
    *   **Fix:** Resolved large file transfer crashes by transitioning matrix mounts to `hard,timeo=600,retrans=5`.
