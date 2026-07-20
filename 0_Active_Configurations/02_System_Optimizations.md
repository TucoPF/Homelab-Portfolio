# System Optimizations & Hardware Fixes (Active)

> **Last Updated:** June 2026

## 💻 Laptop Environment & Integration (Windows 11)
- **SSH Agent Forwarding:** Integrated with 1Password SSH Agent via the native Windows OpenSSH named pipe. The `IdentityAgent` directive is commented out in `.ssh/config` to default cleanly.
- **PowerShell Profile Shortcuts:** Configured quick SSH command wrappers (`m` for matrix, `s` for skynet, `n` for Nuc) in the PowerShell profile.
- **Networking:** Assigned static ULA reservation (`fddf::10`) and DHCP IPv4 reservation (`192.168.1.10`) on the local network router for T800.

## 🗄️ Tiered Storage Architecture ("Fusion")
- **Mechanism:** MergerFS pooling local NVMe (`/mnt/matrix-cache`) with local MergerFS pool `/mnt/matrix-pool` (pooling local EXT4 disks `disk1` and `disk2` mapped via iSCSI from skynet).
- **Mount Point:** `/mnt/fusion`
- **NFS Options (for Backup):** `hard,timeo=600,retrans=5` (Optimized for large file transfers from matrix to skynet's backup SSD).
- **Container Mount Dependencies:** 
  * `pve-container@101.service` (Jellyfin) and `pve-container@103.service` (Arr-Stack) require `mnt-fusion.mount`. They will not start if `/mnt/fusion` is unmounted, preventing database wipes.
  * `pve-container@102.service` (NZBGet) requires `mnt-matrix\x2dcache.mount` to prevent downloading to the host OS root filesystem if the cache SSD is offline.


## 🏗️ Virtualization & Permissions (Proxmox)
- **LXC ID Mapping:** Unprivileged containers are mapped to host UID/GID 1000 for seamless storage access (Jellyfin/Arr-stack).
- **GPU Passthrough:** iGPU Intel passed through to LXC 101 (Jellyfin) for hardware acceleration.
- **iGPU SR-IOV Split:** The Intel UHD/Iris Xe graphics is split into 4 Virtual Functions (VFs) to provide dedicated PCIe graphics to VMs 201–203. See [06_Intel_iGPU_SRIOV_Setup.md](file:///root/portfolio/3_Engineering_and_Troubleshooting/06_Intel_iGPU_SRIOV_Setup.md) for details on configuration and update survival.
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

## 💻 Nuc Client Optimizations (Intel NUC7i3DNHE)
- **CPU Scaling Governor:** Configured a persistent systemd service (`cpu-governor.service`) that forces all cores to the `performance` scaling governor at boot time, eliminating decoding stutters under Moonlight while preserving hardware C-state power saving at idle.
- **TCP BBR:** Enabled BBR congestion control and Fair Queueing (`fq`) to optimize TCP packet delivery.
- **Wi-Fi Power Management:** Disabled Wi-Fi power saving on `wlan0` (`Power save: off`) to prevent packet drops and latency spikes during downstream video streams.
