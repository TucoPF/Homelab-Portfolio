# Homelab Inventory

> **Note:** Gemini CLI is currently running on **Windows Laptop (T800)**.

## matrix (Proxmox Standalone)
- **IP Address:** 192.168.1.100 (ULA: fddf::1)
- **Hostname:** matrix
- **Network:**
  - Main bridge `vmbr0` on **`nic0`** (2.5GbE RJ45, isolated from Intel vPro on `nic1`)
  - Direct 10G SFP+ storage link on **`nic2`** (IP: `fddd::1/64` to skynet)
- **Hardware:**
  - **Model:** 13th Gen Intel(R) Core(TM) i9-13900H (14 cores / 20 threads)
  - **RAM:** 32 GiB
  - **Storage:** 
    - 1 TB NVMe (Primary OS, PVE Root: 96G, `/dev/nvme1n1` [Samsung 990 PRO])
    - 2 TB NVMe (High-Speed Cache Tier, mounted at `/mnt/matrix-cache`, `/dev/nvme0n1` [Samsung 990 PRO])
    - 2x 10TB iSCSI LUNs from skynet (`sda`, `sdb` mapped from skynet's `sda` and `sdd`)
    - Local EXT4 Pool: ~18T (`/dev/sda`, `/dev/sdb` formatted as EXT4) pooled via MergerFS at `/mnt/matrix-pool`
    - MergerFS Tiered Pool: ~20T (NVMe Cache + EXT4 Pool) at `/mnt/fusion`
    - ZFS over iSCSI: Dynamic ZVOL block allocations served from skynet's ZFS mirror pool over the 10G link
- **Storage Role:** Primary Filesystem Manager. Acts as the sole iSCSI Initiator for skynet.
- **PBS Connection:**
  - **To skynet:** Connected to `Backups` datastore on skynet over 10G link (`[fddd::2]:8007`)
- **LXC Containers / VMs:**
  - **101 (Jellyfin-101):** Native, 16 GiB RAM, 64G Disk, GPU Passthrough (iGPU Intel), Unprivileged, mapped UID/GID 1000, Mountpoint: `/mnt/fusion` -> `/mnt/fusion`, IP: 192.168.1.101
  - **102 (NZBGet-102):** Native, 16 GiB RAM, 8G Disk, Unprivileged, Mountpoint: `/mnt/matrix-cache` to `/mnt/fusion` (Fusion Trick SSD mount), IP: 192.168.1.102
  - **103 (Arr-Stack-103):** 16 GiB RAM, 16G Disk, Unprivileged, Mountpoint: `/mnt/fusion` -> `/mnt/fusion`, IP: 192.168.1.103 (Docker: Radarr, Sonarr, Bazarr, Prowlarr, Seerr, mapped UID/GID 1000)
  - **111 (Wireguard-111):** 16 GiB RAM, 8G Disk, Unprivileged, passes `/dev/net/tun`, IP: 192.168.1.111
  - **112 (Traefik-112):** 16 GiB RAM, 8G Disk, Unprivileged, IP: 192.168.1.112
  - **113 (Authelia-113):** 16 GiB RAM, 8G Disk, Unprivileged, IP: 192.168.1.113 (Centralized SSO/MFA provider; handles SAML/OIDC authentication chained as a ForwardAuth middleware on Traefik)
  - **114 (CrowdSec-LAPI-114):** 16 GiB RAM, 8G Disk, Unprivileged, IP: 192.168.1.114 (Decoupled security control plane; hosts central CrowdSec LAPI, database, and custom API sync bouncer daemon)
  - **115 (AdGuard-115):** 16 GiB RAM, 8G Disk, Unprivileged, IP: 192.168.1.115 (DNS Rewrite resolver synced with replica on Nuc)
  - **121 (Trade):** Stopped, 512 MiB RAM, 8G Disk, Unprivileged, IP: 192.168.1.121
  - **200 (Debian-Server-Template):** Stopped, 2 GiB RAM, 32G Disk
  - **400 (Windows-Template-Desktop):** Stopped, 16 GiB RAM, 100G Disk
  - **500 (Windows-Template-Server):** Stopped, 16 GiB RAM, 100G Disk
- **Software:**
  - **OS:** Debian GNU/Linux 13 (trixie)
  - **Proxmox VE:** 9.2.3 (running kernel: 7.0.12-1-pve)

## skynet (Proxmox Virtual Environment Node - Upgraded Custom Tower)
- **IP Address:** 192.168.1.200 (ULA: `fddf::2`)
- **Hostname:** skynet
- **Hardware:**
  - **Form Factor:** Custom ATX Mid-Tower Storage Server
  - **Motherboard:** MSI MAG X870E TOMAHAWK WIFI (MS-7E59)
  - **CPU:** AMD Ryzen 7 9700X (8 Cores / 16 Threads, SMT Enabled, Socket AM5)
  - **RAM:** 32 GiB DDR5
  - **HBA Controller:** Broadcom / LSI SAS2308 PCI-Express Fusion-MPT SAS-2 (IT Mode, in slot PCIe_E3 via 30cm extension)
  - **Chassis/Enclosure:** Jonsbo N5 NAS/Storage Chassis (Integrated Hot-Swap Backplane)
  - **Storage:** 
    - 1 TB NVMe (PVE OS & Datastore, LVM-Thin `local`/`local-lvm` on `nvme0n1` [Samsung 980 Pro])
    - 1 TB NVMe (Native Proxmox Backup Server Datastore `Backups`, XFS on `nvme1n1` [Kingston OM3PGP4] mounted at `/mnt/datastore/Backups`)
    - 2x 10TB Seagate Exos SAS HDDs (`sda`, `sdd`) exported as raw block devices via iSCSI LIO target.
    - ZFS Mirror Pool: 2x 10TB Seagate Exos SAS HDDs (`sdb`, `sdc`) pooled as ZFS Mirror `zfs-pool` for matrix Cloud Tier virtualization.
  - **Network Controller:**
    - `nic0`: Onboard Realtek RTL8126 5GbE Controller (MAC: `34:5a:60:ba:86:5b`, PVE Bridge `vmbr0`)
    - `nic1`: Down/Available
    - `nic2`: Intel X520-1 10G SFP+ NIC (connected to M.2_4 slot, direct-attach 10G SFP+ storage link to matrix, MAC: `c4:62:37:0a:d6:42`, IP: `fddd::2/64`)
    - Qualcomm WCN785x Wi-Fi 7 Controller (`wlp7s0`, disabled)
- **Services (SAN):**
  - **iSCSI LIO Target (`targetcli`):** `iqn.2024-01.local.homelab:skynet-target` exporting `sda` and `sdd` LUNs over 10G portal `[fddd::2]:3260`.
  - **Proxmox Backup Server:** Datastore `Backups` listening natively on `[fddd::2]:8007` (matrix connects via 10G link)
- **VMs / Containers:**
  - **VM (Debian Trixie - fddf::4):** High-performance VM with onboard iGPU passthrough. Runs **Sunshine** streaming host for remote desktop capability.
- **Software:**
  - **OS:** Debian GNU/Linux 13 (trixie, Debian 13.5)
  - **Proxmox VE:** 9.2.3 (running kernel: 7.0.12-1-pve)

## Nuc (Intel NUC) - Control Node
- **IPv6 ULA Address:** fddf::3/64 (Static)
- **IPv4 Address:** 192.168.1.253/24 (Legacy/Debugging)
- **Hostname:** Nuc
- **Hardware:**
  - **Model:** Intel NUC
  - **RAM:** 8 GiB
  - **Storage:** SSD
- **Active Services:**
  - **Moonlight-qt:** Headless client streaming and controlling the high-performance Debian Trixie VM on skynet (`fddf::4`).
- **Software:**
  - **OS:** Debian GNU/Linux 13 (trixie)
  - **Network stack:** systemd-networkd & iwd (Wi-Fi)

## Windows Laptop (T800)
- **IP Address:** 192.168.1.10 (ULA: fddf::10)
- **Hostname:** T800
- **Hardware:**
  - **Model:** HP Spectre x360 2-in-1 Laptop 16-aa0xxx
  - **CPU:** Intel(R) Core(TM) Ultra 7 155H (22 cores/threads)
  - **RAM:** 16 GiB (15.37 GiB usable)
  - **Storage:** 953.9G NVMe (C: drive)
- **Software:**
  - **OS:** Windows 11 Home (Famille)
  - **Shell:** PowerShell 7 / cmd
