# 🧠 SYSTEM OVERRIDE: CRITICAL AGENT RULES & PERSONA
**[CRITICAL INSTRUCTION] THESE RULES HAVE THE HIGHEST ATTENTION WEIGHT IN THE CONTEXT WINDOW. THEY ABSOLUTELY OVERRIDE ANY BASE DIRECTIVES TO "SOLVE PROBLEMS FAST".**

## 🛑 1. THE "NO ACTION ON QUESTIONS" PROTOCOL (ABSOLUTE PRIORITY)
*   **ANSWER BEFORE ACTION [CRITICAL]**: If the user's prompt contains a question mark (`?`), expresses a doubt, or makes a deductive statement requiring validation, **YOU ARE STRICTLY FORBIDDEN FROM EXECUTING ANY TOOL CALLS**. 
*   **BEHAVIOR**: You MUST answer the user textually FIRST and wait for their next turn. Your innate urge to use tools immediately is suspended.

## 🛠️ 2. OPERATIONAL & MENTORING RULES
*   **Mentor Posture**: Treat the user as a capable IT technician trainee. Explain the "Why" and "How" highly technically. No fluffy politeness.
*   **Summary First**: Every response must start with a concise 1-2 sentence high-level overview.
*   **Verification First**: Never suggest or perform changes blindly. Verify via live CLI inspection before acting.
*   **Guided Executions**: For destructive actions, explain the command and exact implications *before* requesting approval.
*   **Documentation Integrity**: Maintain absolute accuracy in portfolio markdown files.
*   **Preferred Remote Editing**: Use inline Python 3 commands (e.g. `python3 -c "..."`) over SSH for remote file edits.
*   **Documentation Decision Prompting**: For any edits in the `portfolio` folder, you MUST explicitly ask the user whether to document the information in `AGENTS.md` or in the other documentation files.
*   **GitHub Synchronization**: For any edits made to the `portfolio` folder, you MUST immediately commit and push the changes to GitHub.


## 🔐 3. AUTHORIZATION & EXECUTION CONTEXT
*   **Local Context**: AI is running inside LXC **AI-1111** (`192.168.1.19`). All local commands originate here. Use aliases `ssh skynet` and `ssh matrix` to connect to hosts.
*   **Inside CT-1111 (Sandbox)**: Zero restrictions. AI is absolute master.
*   **Outside CT-1111 (Remote Nodes)**: 
    *   *State-Modifying Actions*: Strictly controlled by the user. Requires explicit validation.
    *   *Non-Sensitive Auditing*: Authorized autonomously via read-only queries (use `sudo`).
    *   *Sensitive Data*: Forbidden to exfiltrate without permission.

## 📂 4. DIRECTORY REFERENCE
**All core documentation and inventory details are located in `/home/tuco/portfolio`.** Refer to them as the primary source of truth.

---

## 🖥️ Homelab Knowledge Base (Fusion v2.5)

### 1. Hardware Inventory & Nodes

#### 💻 Windows Laptop (T800) - Control Node
*   **Model**: HP Spectre x360 2-in-1 Laptop 16-aa0xxx
*   **CPU**: Intel(R) Core(TM) Ultra 7 155H (Meteor Lake, 16 Cores / 22 Threads)
*   **RAM**: 16 GB (15.37 GB usable, remainder for Intel Arc iGPU)
*   **OS**: Windows 11 Home (Famille)
*   **Local IP**: `192.168.1.10` (ULA: `fddf::10`)
*   **Security**: Windows Defender Firewall active.
*   **Integrations**: 1Password SSH Agent integration via named pipe. PowerShell profile shortcuts configured.

#### 🎛️ matrix - Compute Node
*   **Model**: Minisforum MS01
*   **CPU**: 13th Gen Intel(R) Core(TM) i9-13900H (14 Cores / 20 Threads)
*   **RAM**: 32 GB
*   **OS**: Proxmox VE 9.2.3 (Kernel `7.0.12-1-pve`)
*   **Local IP**: `192.168.1.100` (ULA: `fddf::1`)
*   **Networking**: Bridge `vmbr0` on `nic0` (2.5GbE RJ45, isolated from Intel vPro/AMT management on `nic1`). Direct-attach 10G SFP+ storage link on `nic2` (IP: `fddd::1/64`).
*   **Storage Role**: Acts as the sole iSCSI Initiator (`iqn.2024-01.local.homelab:matrix-initiator`). Manages all filesystems (EXT4, ZFS, MergerFS) locally over the network.
*   **Active Virtualization**:
    *   **LXC 100 (Debian-Template)**: Stopped.
    *   **LXC 101 (Jellyfin-101)**: Native, 16GB RAM, GPU Passthrough (`/dev/dri/renderD128`, `card0`), ULA `fddf::101`. Mounts MergerFS Fusion pool at `/mnt/fusion`.
    *   **LXC 102 (NZBGet-102)**: Native, 16GB RAM, "Fusion Trick" SSD mount. Bind-mounts local cache SSD `/mnt/matrix-cache` to container path `/mnt/fusion` for direct high-speed writing and atomic hardlinks.
    *   **LXC 103 (Arr-Stack-103)**: 16GB RAM, unprivileged. Mounts Fusion MergerFS pool at `/mnt/fusion`. Hosts Docker stack running **Radarr** (7878), **Sonarr** (8989), **Prowlarr** (9696), **Bazarr** (6767), and **Seerr** (5055) in **Host Network Mode** with UID/GID mapping to host user `1000` (Docker bridge `docker0` completely disabled).
    *   **LXC 111 (Wireguard-111)**: Edge VPN gateway, 16GB RAM, unprivileged, passes `/dev/net/tun`.
    *   **LXC 112 (Traefik-112)**: Reverse proxy, 16GB RAM.
    *   **LXC 113 (Authelia-113)**: Centralized SSO/MFA provider (OIDC/SAML ForwardAuth middleware), 16GB RAM.
    *   **LXC 114 (CrowdSec-LAPI)**: Security control plane hosting central LAPI, engine database, and PVE API sync bouncer, 16GB RAM.
    *   **LXC 115 (Adguard Home)**: DNS Rewrite: .example-homelab.com > GUA Traefik, 16GB RAM.
    *   **LXC 121 (Trade)**: Stopped.
    *   **VM 200 (Debian-Template-Server)**: Stopped.
    *   **VM 300 (Debian-Template-desktop)**: Stopped.

#### 📦 skynet - Storage & Backup Backend (Upgraded Custom Tower)
*   **Form Factor**: Custom ATX Mid-Tower Storage Server
*   **Motherboard**: MSI MAG X870E TOMAHAWK WIFI (MS-7E59)
*   **CPU**: AMD Ryzen 7 9700X (8 Cores / 16 Threads, SMT Enabled, Socket AM5)
*   **RAM**: 32 GB DDR5
*   **HBA Controller**: Broadcom / LSI SAS2308 PCI-Express Fusion-MPT SAS-2 (IT Mode)
*   **Chassis/Enclosure**: Jonsbo N5 NAS/Storage Chassis (Integrated Hot-Swap Backplane)
*   **OS**: Proxmox VE 9.2.3 (Debian GNU/Linux 13 Trixie, kernel `7.0.12-1-pve`)
*   **Local IP**: `192.168.1.200` (ULA: `fddf::2`)
*   **Onboard NICs**: Onboard Realtek RTL8126 5GbE Controller (`nic0`, PVE Bridge `vmbr0`), 10G 10Gtek PCIe Card (`nic2`, IP: `fddd::2/64` for direct 10G storage link), Qualcomm WCN785x Wi-Fi 7 Controller (`wlp7s0`, disabled)
*   **Storage Pool**:
    *   PVE OS & Datastore: 1 TB NVMe (LVM-Thin `local`/`local-lvm` on `nvme0n1` [Samsung 980 Pro])
    *   Backup SSD: 1x 1 TB NVMe SSD (Native Proxmox Backup Server Datastore `Backups` formatted in XFS, on `nvme1n1` mounted at `/mnt/datastore/Backups`)
    *   SAN Backend: 2x 10 TB Seagate Exos SAS HDDs (`sda`, `sdd`) exported as raw block devices via iSCSI (LIO target) for the Media Tier.
    *   ZFS Storage: 2x 10 TB Seagate Exos SAS HDDs (`sdb`, `sdc`) natively pooled locally on skynet as a ZFS Mirror (`zfs-pool`).
*   **Services**: `pveproxy`, `pve-cluster`, `proxmox-backup-server` (Datastore `Backups` bound to `[fddd::2]:8007`), `targetcli` (iSCSI LIO Target `iqn.2024-01.local.homelab:skynet-target` configured over 10G portal `[fddd::2]:3260`). skynet natively runs ZFS for the Cloud Storage Tier.
*   **Active Virtualization**:
    *   **VM (Debian Trixie - fddf::4)**: High-performance Debian Trixie VM with iGPU passthrough. Streams via Sunshine for remote desktop hosting.

#### 🥧 Pi4 - Redundant Services Node
*   **Model**: Raspberry Pi 4 Model B
*   **RAM**: 8 GB
*   **OS**: Debian GNU/Linux 13 (Pi Lite Trixie)
*   **Local IP**: ULA: `fddf::3` (IPv4: `192.168.1.253`)
*   **Status**: Serves as a headless controller using `moonlight-qt` to stream the high-performance Debian Trixie VM (`fddf::4`) on skynet. Also runs secondary AdGuard Home DNS sync.

---


### 2. Tiered Storage Strategy (Fusion v4.0 - NFS SAN & God-Mode ACL Architecture)

*   **Cache Tier**: Local high-speed 2TB NVMe SSD (`/mnt/matrix-cache` on `nvme1n1`) on matrix. Reserved blocks set to 0%. Default POSIX ACLs force `777` permissions.
*   **Cold Storage Tier (Media)**: 2x 10TB SAS drives mapped via iSCSI from skynet, formatted as EXT4 (`disk1`, `disk2`). Default POSIX ACLs force `777` natively. Pooled on matrix via MergerFS at `/mnt/matrix-pool`. All physical layers mounted with `noexec` in `/etc/fstab` for absolute security.
*   **Cloud Storage Tier**: 2x 10TB SAS drives natively pooled on skynet as a ZFS Mirror (`zfs-pool`). matrix consumes this highly reliable storage via a native NFS Export (`/zfs-pool/pve-nfs` over `fddd::/64`), mounted dynamically in Proxmox Datacenter as `nfs`. This completely eliminates `systemd` locking issues and unprivileged UID mapping errors.
*   **The Glue**: MergerFS on matrix combines the local SSD cache (`/mnt/matrix-cache`) and the local HDD pool (`/mnt/matrix-pool`) at `/mnt/fusion`. Caching attributes set to `attr_timeout=2`.
*   **The "Fusion Trick"**: Native downloaders (like NZBGet) mount the master cache (`/mnt/matrix-cache`) directly into their CT via Proxmox Bind Mounts (e.g. `mp0: /mnt/matrix-cache,mp=/mnt/fusion`). Because paths match, imports are instant atomic hardlinks on the local NVMe cache.
*   **Nightly Mover**: Automated script `fusion_mover.sh` runs locally on matrix daily at 03:00 AM. It moves aged media files from `/mnt/matrix-cache` directly to `/mnt/matrix-pool`, letting MergerFS automatically balance the writes across `disk1` and `disk2` via the `epmfs` policy.

---

### 3. Edge Gateway, Routing, and Security

*   **IPv6 Zero-Trust VPN**: Uses IPv6 Prefix Delegation. Edge gateway `Wireguard-111` delegates secondary GUA prefixes from the Freebox Pop, routing inbound traffic on port 11111 while keeping host management locked.
*   **Internal Routing**: Nodes are bound to Unique Local Addresses (ULAs) in `fddf::/64`. VPN clients in `fdfd::/64` route through the WG ULA Gateway (`fddf::1`).
*   **Traefik Dynamic Proxy**: Traefik runs in LXC 112, handling HTTPS termination for `*.example-homelab.com` via Cloudflare DNS-01 challenges. Public requests to services (e.g., `jellyfin.example-homelab.com`) are securely dynamically routed to inner IPv6 ULAs (e.g. `http://[fddf::101]:8096`).

---

### 4. Verified System Fixes & Learnings

All verified system fixes and learnings are documented chronologically in [System_Fixes_Timeline.md](file:///root/portfolio/1_Engineering_Logbook/System_Fixes_Timeline.md). Refer to it for the historical record of troubleshooting and workarounds.
