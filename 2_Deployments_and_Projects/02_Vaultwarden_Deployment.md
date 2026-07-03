# ⚠️ Vaultwarden Homelab Setup (DECOMMISSIONED)
*Date: March 15, 2026*

> [!WARNING]
> **Status: Decommissioned / Archived**
> As of April 2026, this self-hosted Vaultwarden deployment has been successfully decommissioned. We have transitioned back to using 1Password (integrated via the local 1Password SSH agent socket at `~/.1password/agent.sock` for secure credential and key management). This document remains purely for historical reference.

## Overview
Successfully deployed a self-hosted Vaultwarden instance (Bitwarden compatible) on the Skynet Proxmox node. This has been replaced by 1Password.

## Architecture
* **Host:** Skynet (192.168.1.200)
* **LXC ID:** 111 (Unprivileged Debian 13 - Decommissioned, IP and ID now reused for Wireguard gateway)
* **LXC IP:** 192.168.1.111
* **Deployment Method:** Docker Compose inside the LXC.
* **Storage Strategy:** 
  * LXC Root OS: `local-lvm`
  * Persistent Data: Bound to host NVMe (`/mnt/storage/vaultwarden_data`) mapped to `/vw-data` in the container. No complex ID mapping required; host directory ownership set to `100000:100000` (default unprivileged root).

## Network & Access
* **Internal Port:** 80 (Mapped via Docker to port 80 of the LXC).
* **Reverse Proxy:** Nginx Proxy Manager (NPM) handles HTTPS termination.
  * **Config:** Forward to `192.168.1.111:80`. *Websockets Support* enabled for real-time sync.
* **VPN:** Tailscale is installed directly inside the LXC (requiring `/dev/net/tun` mapping and DNS set to `8.8.8.8` initially for setup).

## Backup Strategy
* **Method:** Nightly Rsync to MergerFS HDD pool.
* **Source:** `/mnt/storage/vaultwarden_data/` (Fast NVMe)
* **Destination:** `/mnt/fusion/backups/vaultwarden/` (Resilient HDDs)
* **Automation:** Cron job on the Skynet host running daily at 04:00 AM (`/home/tuco/scripts/vaultwarden_backup.sh`).

## Migration Steps (1Password -> Vaultwarden)
1. Exported 1Password vault as an unencrypted `.1pux` file (preserves custom fields, tags, secure notes, unlike CSV).
2. Imported via Vaultwarden Web UI -> Tools -> Import Data.
3. *Crucial:* Permanently delete the `.1pux` file from the local machine after import.

## SSH Agent Support
Vaultwarden supports acting as an SSH Agent via the Bitwarden Desktop app, keeping private keys securely in the vault. 
* *Note:* On Linux, the AppImage or native AUR package (`bitwarden`) must be used. The Flatpak version does not support SSH agent functionality due to sandbox constraints.
* Set `export SSH_AUTH_SOCK=...` in `.bashrc` to point to the Bitwarden socket.