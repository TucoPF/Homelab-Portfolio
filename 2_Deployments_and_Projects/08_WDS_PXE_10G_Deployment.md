# 🏆 WDS PXE OS Deployment over 10G Isolated Network

## Project Overview
This project documents the implementation of a virtualized OS deployment lab using Windows Deployment Services (WDS) and DHCP over a dedicated, physically isolated 10Gb SFP+ link between `matrix` (Compute Node) and `skynet` (Storage Node).

## Network & Virtualization Architecture

### 1. Host Network Configuration (Proxmox VE)
To allow VMs on different nodes to communicate over the 10Gb direct-attach link, the physical interface `nic2` was transitioned into a Linux Bridge (`vmbr2`) on both hosts.
*   **Jumbo Frames (MTU 9000):** Maintained on both `nic2` (physical port) and `vmbr2` (virtual bridge) to ensure maximum throughput for storage and image transfers.
*   **Dual-Stack Traffic:**
    *   **IPv6 (`fddd::/64`):** Dedicated to high-speed backend storage traffic (iSCSI LIO targets, NFS mounts, Proxmox Backup Server).
    *   **IPv4 (`10.10.10.0/24`):** Isolated L2 network dedicated to PXE boot broadcasts and DHCP.

### 2. VM Network Mapping (Multi-Homing)
*   **WDS Master Server (WinServer2025 - VM 201 on Matrix):**
    *   `net0` -> Attached to `vmbr0` (LAN/WAN access via Freebox for AD Domain services, RDP, and internet).
    *   `net1` -> Attached to `vmbr2` (10Gb isolated network for WDS/PXE). IP: `10.10.10.1/24`, no gateway, DNS: `10.10.10.1`.
*   **Target VM (Win11 - VM 206 on Skynet):**
    *   `net0` -> Attached to `vmbr2` (VirtIO model, configured to boot via PXE first).

---

## Service Configurations (Windows Server)

### 1. DHCP Server Setup
Since `vmbr2` is isolated, a dedicated DHCP scope was configured on the Windows Server to handle PXE requests:
*   **Scope Range:** `10.10.10.50` to `10.10.10.100` (Subnet `/24`).
*   **DNS Server (Option 006):** `10.10.10.1` (crucial for domain resolution).
*   **Domain Name (Option 015):** `studi.lan`.
*   **Router (Option 003):** Left empty (no routing to LAN).

### 2. WDS & DHCP Coexistence (Port 67 Conflict)
Running WDS and DHCP on the same Windows Server requires resolving the UDP port 67 binding conflict. Under WDS Server Properties > DHCP tab:
*   [x] **Do not listen on DHCP port (UDP 67):** Checked.
*   [x] **Configure DHCP Option 60 to 'PXEClient':** Checked (notifies DHCP clients that this server is also a PXE server).

### 3. Active Directory Integration
WDS was initialized as **Active Directory Integrated** (domain `studi.lan`). This enables automatic naming schemas (e.g., `PC-%03#`) and automatic domain-joining of deployed VMs into designated Organizational Units (OUs).

---

## Driver Injection & OS Deprecation Workarounds

### 1. VirtIO Driver Injection (The "Pro" Method)
Windows PE (the boot environment loaded into RAM) does not natively support Proxmox VirtIO devices (VirtIO network and VirtIO SCSI storage).
*   **Driver Import:** Imported VirtIO drivers (from `virtio-win.iso`) into WDS.
*   **Injection:** Injected `NetKVM` (Network) and `vioscsi` / `viostor` (Storage SCSI/Block) drivers into the WDS boot image (`boot.wim`). This allows WinPE to see the network card at 10Gb/s and the target hard disk.

### 2. Bypassing Windows 11 WDS Deprecation Block
*   **The Issue:** Microsoft has partially deprecated OS deployment features in WDS for Windows 11. Using a Windows 11 `boot.wim` directly triggers a hardcoded warning popup. Clicking "OK" aborts the installer and reboots the VM.
*   **The Workaround:** Import a Windows 10 `boot.wim` as the WDS boot image. The Windows 10 setup engine does not contain this block, and it is fully capable of installing a Windows 11 `install.wim` image.
*   **Result:** The VM boots using the Windows 10 PE, setup runs smoothly, and installs a native, fully functional Windows 11 onto the VirtIO disk.

---

## Operational Guide: Post-Deployment Steps
1.  **Boot Order Restoration:** Once WDS finishes copying the OS files and reboots the target VM, change the VM's boot order in Proxmox to place the hard disk (`scsi0`) first (or disable network boot). This prevents the VM from looping back into PXE setup.
2.  **Post-Install Tools:** Mount `virtio-win.iso` on the final Windows 11 VM and run `guest-agent\qemu-ga-x86_64.msi` to install the QEMU Guest Agent.
