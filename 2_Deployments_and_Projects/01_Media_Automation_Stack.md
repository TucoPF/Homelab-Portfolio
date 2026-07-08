# Homelab Arr-Stack & Jellyfin Setup (March 6, 2026)

This document summarizes the current working configuration of the Arr-Stack (LXC 103), Jellyfin (LXC 101), and NZBGet (LXC 102) on the **matrix** Proxmox node.

## 🏗️ Architecture Summary
- **matrix (Node 1):** 192.168.1.100
- **LXC 101 (Jellyfin):** 192.168.1.101
- **LXC 102 (NZBGet):** 192.168.1.102 (Native LXC, "Fusion Trick" NVMe mount)
- **LXC 103 (Arr-Stack):** 192.168.1.103 (Docker-based)
- **Storage:** `mergerfsPool` mounted at `/mnt/fusion` in the Jellyfin and Arr-Stack containers.
  - Underlying Branches: `/mnt/matrix-cache` (NVMe cache), `/mnt/matrix-pool` (local EXT4 disk pool mapped via iSCSI from skynet).

## 🚀 Service Configuration

### 🎥 Radarr (Movies) - Port 7878
- **Root Folder:** `/mnt/fusion/movies/` (Correctly isolated from downloads).
- **Download Client (NZBGet):**
  - **Category:** `movies` (Lowercase match required).
- **Jellyfin Connection:**
  - **Type:** Emby / Jellyfin
  - **API Key:** [REDACTED - See Jellyfin Dashboard]
  - **Settings:** `Notify: No`, `Update Library: Yes`.
- **Import Method:** Standard Move (Instant rename on the same physical disk).

### 📺 Sonarr (TV Shows) - Port 8989
- **Root Folder:** `/mnt/fusion/shows/`.
- **Download Client (NZBGet):**
  - **Category:** `shows` (Lowercase match required).
- **Jellyfin Connection:**
  - **Type:** Emby / Jellyfin
  - **API Key:** [REDACTED - See Jellyfin Dashboard]
  - **Settings:** `Notify: No`, `Update Library: Yes`.

### 📥 NZBGet (Downloader) - Port 6789
- **MainDir:** `/config`
- **DestDir:** `/mnt/fusion/downloads/complete`
- **Categories:** `movies`, `shows`, `music`. (Ensure lowercase matches in Arr apps).

### 🔍 Seerr (Requests) - Port 5055
- Manages requests and sends them to Radarr/Sonarr. Verified as the start of the automation chain.

## 🛠️ Critical Fixes Implemented
1.  **Category Case-Sensitivity:** Updated Radarr/Sonarr to use lowercase categories (`movies`, `shows`) to match NZBGet's history.
2.  **Jellyfin Instant Scan:** Fixed the "MediaBrowser" notification error by disabling the `Notify` flag while keeping `Update Library` enabled.
3.  **Root Folder Isolation:** Moved Radarr's library root from `/mnt/fusion/` to `/mnt/fusion/movies/` to prevent conflict warnings with the `/mnt/fusion/downloads/` path.
4.  **Hardlink Optimization:** Verified that imports stay on the same physical disk (`matrix-cache`) whenever possible to perform instant renames and reduce disk wear.

---

## 🏗️ Deployed Hybrid Architecture (April 9, 2026 Update)

The media automation environment is structured as a robust hybrid architecture, using lightweight native LXCs for high-throughput I/O processes (like transcoding and downloading) and a single Docker-enabled LXC for the Arr-Stack apps.

### 📦 Container Layout
- **LXC 101 (Jellyfin):** 192.168.1.101 (Native LXC, Hardware Transcoding `/dev/dri/renderD128`, unprivileged)
- **LXC 102 (NZBGet):** 192.168.1.102 (Native LXC, Unlimited Cores/RAM, "Fusion Trick" NVMe mount)
- **LXC 103 (Arr-Stack-103):** 192.168.1.103 (Docker stack inside Debian 13 LXC, unprivileged, mapped to host user `1000`, running in pure **Host Network Mode** with `docker0` disabled)
  - **Docker Containers (Host Mode, Dual-Stack IPv6 enabled):**
    - **Radarr** (Port 7878)
    - **Sonarr** (Port 8989)
    - **Prowlarr** (Port 9696)
    - **Bazarr** (Port 6767)
    - **Seerr** (Port 5055)

### 📥 Download Clients & Caching (NZBGet LXC 102)
- **The "Fusion Trick":** NZBGet mounts the raw high-speed matrix NVMe `/mnt/matrix-cache` to `/mnt/fusion`. The Arr containers mount the actual MergerFS pool (`/mnt/fusion`). Because the paths match perfectly (`/mnt/fusion/downloads/complete` to `/mnt/fusion/movies`), imports are processed instantly as atomic hardlinks on the NVMe cache tier.
- **NZBGet Performance Settings:**
  - `MainDir`: `/mnt/fusion/downloads/nzbget`
  - `ArticleCache`: 2048 (2GB RAM Cache)
  - `WriteBuffer`: 1024 (1MB chunks)
  - `ParBuffer`: 1024 (1GB Repair Cache)
  - `ParThreads`: 0 (Max Cores)
  - **Credentials:** `nzbget` / `tegbzn6789`

### 🛠️ Hardening & Optimization
1.  **Tailscale DNS Conflict:** Hardcoded `nameserver 1.1.1.1 8.8.8.8` in Proxmox container configs to override Tailscale's DNS socket hijack (`100.100.100.100`).
2.  **Notification DB Corruption:** Cleared corrupted Jellyfin notification JSON from Radarr's SQLite database during the v6.1.1 upgrade.
3.  **NZBGet v21 Bug:** Removed broken Debian-repo version of NZBGet (v21) and manually installed the community v26.1 release.
4.  **Mountpoint Optimization:** Added `mountoptions=noatime,backup=0` to all container bind mounts (`mp0`). This eliminates write time access updates (`noatime`) during heavy downloading and prevents Proxmox Backup Server from backing up the massive media/downloads directories (`backup=0`).
5.  **UID/GID Mapping:** Configured `lxc.idmap` hole-punching for UID/GID `1000` (host user `tuco` -> container user `arr` / `1000:1000`), preventing any file creation permission errors over NFS.
6.  **Docker Image Disk Bloat (Arr Container OS Disk Full):** Cleaned up ~9 GB of dangling and unused Docker images inside LXC 103 (Arr-Stack-103) root filesystem. Configured a weekly systemd timer (`docker-prune.timer` triggering `docker-prune.service`) to run `docker image prune -f` automatically, ensuring old image versions are garbage collected and preventing future container storage depletion.
7.  **Container Interface Hardening (Host Mode Migration):** Migrated all Arr stack Docker containers (Radarr, Sonarr, Prowlarr, Bazarr, Seerr) to `network_mode: host` in `docker-compose.yml` to simplify inter-container networking and lower CPU/IO overhead. Hardened LXC 103's networking by configuring `"bridge": "none"` in `/etc/docker/daemon.json`, completely removing the redundant `docker0` bridge interface and all virtual ethernet subnets to establish a pristine, minimalist environment (`lo` and `eth0` only) and routing internal API connections cleanly over local IPv4 (`192.168.1.102:6789`) due to hardcoded Servarr IPv6 engine limitations.
8.  **Instant Jellyfin Library Updates:** Reduced `<LibraryMonitorDelay>` from `60` down to `3` seconds inside `/etc/jellyfin/system.xml` on Jellyfin (LXC 101). Since the "Fusion Trick" uses instant NVMe hardlinks, there is no physical file-writing lag on import. Eliminating this 60-second stabilization timer ensures movies appear in Jellyfin almost instantaneously (under 3 seconds) after Radarr finishes the import.
