# Intel iGPU SR-IOV Split Configuration & Update Guide (matrix)

This document outlines the setup, architecture, and update survival procedure for the Intel Core i9-13900H integrated GPU (Iris Xe Graphics) split using SR-IOV on **matrix** (Minisforum MS01).

---

## 🏗️ Architecture & VF Allocations

The integrated GPU is configured to support up to **4 Virtual Functions (VFs)** via the custom `i915-sriov-dkms` module. These VFs are mapped as separate PCIe devices and assigned to virtual machines:

### 1. Host Physical Device
*   **Host GPU:** `0000:00:02.0` (Intel Corporation Raptor Lake-P [Iris Xe Graphics] `[8086:a7a0]`)
*   **LXC Passthrough:** Passed through to **LXC 101 (Jellyfin)** natively using Linux `/dev/dri` render nodes for hardware acceleration.

### 2. Virtual Function Assignments (VMs)
*   **VF 1 (`0000:00:02.1`)**: Assigned to **VM 201 (WinServer2025)**
    *   Configuration parameter: `hostpci0: 0000:00:02.1,pcie=1,x-vga=1` (Primary VGA enabled)
*   **VF 2 (`0000:00:02.2`)**: Assigned to **VM 202 (WinClient1)**
    *   Configuration parameter: `hostpci0: 0000:00:02.2,pcie=1`
*   **VF 3 (`0000:00:02.3`)**: Assigned to **VM 203 (WinClient2)**
    *   Configuration parameter: `hostpci0: 0000:00:02.3,pcie=1,x-vga=1` (Primary VGA enabled)

---

## ⚙️ Host Configuration & Boot Options

To initialize the VFs on boot, the following parameters are active on the host:

1.  **Kernel Command Line (`/etc/kernel/cmdline`)**:
    ```text
    intel_iommu=on iommu=pt i915.enable_guc=3 i915.max_vfs=4 module_blacklist=xe
    ```
    *   `intel_iommu=on iommu=pt`: Enables IOMMU and limits translation to passthrough mode for native speed.
    *   `i915.enable_guc=3`: Enables GuC submission and HuC authentication, required for SR-IOV virtualization.
    *   `i915.max_vfs=4`: Instructs the SR-IOV driver to initialize 4 virtual interfaces.
    *   `module_blacklist=xe`: Disables the modern `xe` driver, forcing the system to run on the legacy `i915` driver where the SR-IOV patch is active.

---

## 🔄 Kernel Update Survival Strategy

### Why the Setup Breaks
Because the Intel SR-IOV code is not merged into the mainline Linux kernel, it requires a custom out-of-tree DKMS module (`i915-sriov-dkms`). 
During a Proxmox kernel upgrade (e.g. from `7.0.6-2-pve` to `7.0.12-1-pve`), if the corresponding compiler headers (`proxmox-headers-<version>`) are missing, the DKMS build hook fails silently. The host then falls back to the stock, in-tree `i915` module which:
1. Ignores the `max_vfs` parameter (`i915: unknown parameter 'max_vfs' ignored`).
2. Fails to initialize any Virtual Functions (`driver does not support SR-IOV configuration via sysfs`).

### Resolution Procedure (After Kernel Update)
If the VFs are missing after a kernel update, run the following steps on **matrix**:

1.  **Install current headers**:
    ```bash
    sudo apt-get update
    sudo apt-get install -y proxmox-headers-$(uname -r)
    ```
2.  **Verify & Install meta-headers** (prevents future breakages):
    ```bash
    sudo apt-get install -y proxmox-default-headers
    ```
3.  **Compile & Install the DKMS module**:
    ```bash
    # Test compilation safely
    sudo dkms build -m i915-sriov-dkms -v 2026.05.06 -k $(uname -r)
    
    # Apply and register the module
    sudo dkms install -m i915-sriov-dkms -v 2026.05.06 -k $(uname -r)
    ```
4.  **Confirm Status**:
    Ensure the module shows as `installed` for the running kernel:
    ```bash
    sudo dkms status
    ```
5.  **Reboot matrix**:
    ```bash
    sudo reboot
    ```
