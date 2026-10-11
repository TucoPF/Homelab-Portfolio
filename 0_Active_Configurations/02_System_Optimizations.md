# System Optimizations & Hardware Fixes (Active)

> **Last Updated:** June 2026

## 💻 Laptop Environment & Integration (Windows 11)
- **SSH Agent Forwarding:** Integrated with 1Password SSH Agent via the native Windows OpenSSH named pipe. The `IdentityAgent` directive is commented out in `.ssh/config` to default cleanly.
- **PowerShell Profile Shortcuts:** Configured quick SSH command wrappers (`m` for matrix, `s` for skynet, `n` for Nuc) in the PowerShell profile.
- **Networking:** Assigned static ULA reservation (`fddf::10`) and DHCP IPv4 reservation (`192.168.1.10`) on the local network router for T800.

## 🗄️ Tiered Storage Architecture ("Fusion")
- **Mechanism:** MergerFS pooling local NVMe (`/mnt/matrix-cache`) with local MergerFS pool `/mnt/matrix-pool` (pooling local EXT4 disks `disk1` and `disk2` mapped via iSCSI from skynet).
- **Mount Point:** `/mnt/fusion`
- **iSCSI Mount Options:** `_netdev,noatime,nofail,noexec,x-systemd.device-timeout=5s` on `disk1` and `disk2` in `/etc/fstab` to eliminate host boot hangs.
- **iSCSI Target DB Tuning:** `/var/lib/iscsi/nodes/` persistent target records configured with `node.startup = manual`, `login_timeout = 3`, and `initial_login_retry_max = 2` to prevent 4-minute boot delays when storage links initialize.
- **Cloud Tier SAN:** Native Proxmox ZFS over iSCSI (`LIO` provider) connecting `matrix` (`Remote-pool`) to `skynet` (`Local-pool`) over the 10G link (`fddd::2`).


## 🏗️ Virtualization & Permissions (Proxmox)
- **LXC ID Mapping:** Unprivileged containers are mapped to host UID/GID 1000 for seamless storage access (Jellyfin/Arr-stack).
- **GPU Passthrough:** iGPU Intel passed through to LXC 101 (Jellyfin) for hardware acceleration.
- **iGPU SR-IOV Split:** The Intel UHD/Iris Xe graphics is split into 4 Virtual Functions (VFs) to provide dedicated PCIe graphics to VMs 201–203. See [06_Intel_iGPU_SRIOV_Setup.md](file:///root/Homelab-Portfolio/3_Engineering_and_Troubleshooting/06_Intel_iGPU_SRIOV_Setup.md) for details on configuration and update survival.
- **matrix Network Isolation:** `vmbr0` moved to `nic0` to avoid network loops with Intel vPro/AMT management on `nic1`.

## 🎛️ matrix Compute Node Performance (i9-13900H)
- **Thermal Interface:** Repasted with Honeywell PTM7950 phase-change material (idle temperatures reduced to ~49°C).
- **Power Delivery:** Upgraded to official 180W power supply, replacing the underpowered 90W charger to prevent Over-Current Protection (OCP) brownouts.
- **Turbo Ratios:** Reverted to factory defaults (P-Cores: 54/54/51/51/49/49/49/49, E-Cores: 41/41/41/41/39/39/39/39) now that the system has adequate thermal headroom and power delivery capacity.

## 🔇 Known Hardware Limitations & Diagnostics (T800)
- **BIOS ACPI Buffer Bug:** The HP Spectre BIOS firmware contains an ACPI buffer bug (`AE_AML_BUFFER_LIMIT` in `_SB.WMID.WQBZ`) which breaks the `hp-wmi` thermal profile interface on Linux. On Windows 11, the HP Command Center and OEM drivers abstract this bug, though manual thermal profile switches may exhibit minor lag in OEM software.
- **Audio Topology / SOF Warnings:** Hardware audio converter lines for unused virtual HDMI layouts are present, handled silently by Windows audio drivers.

## 🛡️ Service Self-Healing & Network Resilience (Authelia)
- **Authelia Boot Failure Fix (LXC 113):** Configured a systemd drop-in override at `/etc/systemd/system/authelia.service.d/override.conf` with `Restart=on-failure` and `RestartSec=10s` to ensure recovery from transient boot-time lookup errors. Added `disable_startup_check: true` to the `notifier` block in `/etc/authelia/configuration.yml` to prevent blocking on remote SMTP (`smtp-relay.brevo.com`) connectivity when the DNS/gateway nodes are not yet active during parallel host startup.

## 🖥️ CachyOS Workstation, Gaming & AI VM (ID: 121)
- **GPU Control & Telemetry:**
  - AMD Radeon RX 9070 XT passthrough running under `amdgpu` kernel module and Mesa 26.2.4 (RADV GFX1201 ACO compiler).
  - LACT hardware management daemon (`lactd.service`) active for DPM power states, temperature telemetry, and fan curve control.
  - VA-API hardware video acceleration (VCN 5) active for AV1, HEVC 10-bit, VP9, and H.264 decoding/encoding.
- **Display & Wayland Tuning:**
  - DisplayPort `DP-2` running under KDE Plasma 6 Wayland.
  - Refresh Rate: 120 Hz (provisional setting for cable stability) with full 240 Hz capability.
  - Variable Refresh Rate (VRR / FreeSync): Configured to `Automatic` to eliminate desktop backlight flickering while engaging dynamic sync during fullscreen 3D workloads.

## 🍓 Pi Out-of-Band VPN Node (Raspberry Pi 4)
- **Emergency Remote Access:** Dedicated Tailscale gateway providing redundant out-of-band ingress independent from matrix CT 111 WireGuard and Freebox port forwarding.
- **Lightweight System Stack:** Minimal Raspberry Pi OS Lite (Debian Trixie) tuned for high availability, low power draw, and headless resilience.
