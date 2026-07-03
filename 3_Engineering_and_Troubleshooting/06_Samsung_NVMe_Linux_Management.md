# 🧠 Samsung NVMe SSD Management & Maintenance on Linux

This guide serves as the definitive reference for managing consumer and enterprise/OEM Samsung NVMe SSDs under Linux. Since Samsung Magician (the desktop GUI) is not natively supported on Linux, this document details how to replicate and exceed its functionality using standard open-source tools: `smartctl` (`smartmontools`) and `nvme-cli`.

---

## 🛠️ Direct Commands to Replicate Samsung Magician

Linux provides native, scriptable, and highly efficient commands that map directly to Samsung Magician features.

### 1. Drive Health & S.M.A.R.T. Telemetry (Drive Dashboard)
Samsung Magician uses S.M.A.R.T. records to determine health status, temperature, and wear level. On Linux, this is polled directly via the NVMe controller.

*   **S.M.A.R.T. Full Report (`smartctl`):**
    ```bash
    sudo smartctl -a /dev/nvme0n1
    ```
*   **NVMe-Specific Smart Log (`nvme-cli`):**
    ```bash
    sudo nvme smart-log /dev/nvme0n1
    ```
    *Key Attributes to Monitor:*
    *   `percentage_used`: The percentage of the drive's rated endurance that has been consumed (wear level).
    *   `data_units_written`: Total Bytes Written (TBW). (Multiply by 512,000 and divide by $10^{12}$ to convert to Terabytes).
    *   `temperature`: Dual sensor monitoring (Sensor 1: Flash Controller, Sensor 2: NAND packages).

### 2. Diagnostic Self-Tests
Instead of a graphical progress bar, Linux triggers the controller's native firmware self-tests.

*   **Short Self-Test (approx. 2 minutes):**
    ```bash
    sudo nvme self-test-start -t short /dev/nvme0n1
    # OR using smartctl
    sudo smartctl -t short /dev/nvme0n1
    ```
*   **Extended/Long Self-Test:**
    ```bash
    sudo nvme self-test-start -t long /dev/nvme0n1
    # OR using smartctl
    sudo smartctl -t long /dev/nvme0n1
    ```
*   **Monitor Test Progress & Results:**
    ```bash
    sudo nvme self-test-log /dev/nvme0n1
    # OR using smartctl
    sudo smartctl -l selftest /dev/nvme0n1
    ```

### 3. Performance Optimization (TRIM & Deallocate)
Samsung Magician’s "Performance Optimization" triggers manual TRIM. On Linux, this is natively handled by the filesystem and block layers.

*   **Manual On-Demand TRIM:**
    ```bash
    sudo fstrim -av
    ```
*   **Automated Maintenance:** Ensure the systemd timer is active to automatically TRIM mounted filesystems weekly:
    ```bash
    sudo systemctl enable --now fstrim.timer
    ```

### 4. Over-Provisioning (OP)
Over-provisioning leaves unallocated space on the SSD to allow the controller's garbage collection to work more efficiently, maintaining high write speeds and extending NAND lifespan.
*   **Linux Standard Practice:** The simplest and most reliable way to over-provision is during partitioning. Simply leave **10%** of the drive unallocated (e.g., leave raw unpartitioned space at the end of the disk, or do not allocate the full volume group in LVM/LVM-Thin).
*   **Controller-Level Namespace Over-Provisioning:**
    > [!WARNING]
    > Resizing namespaces is destructive and deletes all data on the target namespace.
    ```bash
    # 1. Delete existing namespace
    sudo nvme delete-ns /dev/nvme0n1 -n 1
    
    # 2. Create a smaller namespace (e.g., 900GB instead of 1024GB)
    sudo nvme create-ns /dev/nvme0n1 --nsze=1757812500 --ncap=1757812500 --flbas=0
    
    # 3. Attach the new namespace to the controller
    sudo nvme attach-ns /dev/nvme0n1 -n 1 -c 0
    ```

---

## 💾 Performing Firmware Updates on Linux

Samsung distributes firmware updates as bootable `.iso` files containing a minimal Linux kernel and root filesystem. We can update the firmware without burning a USB or booting into the ISO, by extracting the binary and flashing it directly using `nvme-cli`.

### Step-by-Step CLI Firmware Flashing (No Reboot Required for Flashing)

#### 1. Download the Firmware ISO
Go to the [Samsung Semiconductor SSD Download Page](https://semiconductor.samsung.com/consumer-storage/support/tools/) and download the "Firmware" ISO for your specific drive (e.g., Samsung 990 PRO).

#### 2. Extract the Firmware Binary
We use standard tools to extract the firmware payload (`.bin` or `.img`) from the ISO:
```bash
# Install extraction tools
sudo pacman -S p7zip   # On Arch
# OR: sudo apt install p7zip-full  # On Debian/Ubuntu

# Extract the ISO image contents
7z x Samsung_SSD_990_PRO_Latest.iso -o/tmp/samsung-iso

# Extract the boot sector or initrd image containing the payload
# Inside the extracted files, locate the 'initrd' cpio archive (usually inside /boot/initrd)
cd /tmp/samsung-iso/boot
mkdir /tmp/samsung-initrd
cd /tmp/samsung-initrd
gzip -dc ../initrd | cpio -idmv
```
Look for a directory named `root/fumagician/` or similar. Inside, you will find:
- The firmware image file (e.g., `8B2QJXD7.bin` or `5B2QJXD7.bin`).
- The proprietary Samsung command-line update utility (`fumagician`).

#### 3. Flash the Firmware Natively via `nvme-cli`
Instead of using the proprietary `fumagician` executable, you can use the standard Linux kernel NVMe driver interface via `nvme-cli` to download and commit the image directly to a controller firmware slot.

> [!IMPORTANT]
> Verify your current active slot and firmware version before flashing:
> `sudo nvme fw-log /dev/nvme0n1`

*   **Download the Firmware Image to the Controller:**
    ```bash
    sudo nvme fw-download /dev/nvme0n1 --fw-image=/tmp/samsung-initrd/root/fumagician/8B2QJXD7.bin
    ```
*   **Commit the Firmware (Select Slot and Action):**
    Action `3` tells the controller to commit the downloaded image and activate it upon the next system reset:
    ```bash
    sudo nvme fw-commit /dev/nvme0n1 --slot=1 --action=3
    ```
    *(Alternatively, action `1` or `2` may support immediate activation without a full system reboot, but a system reboot/reset is always the safest path to ensure clean initialization).*

*   **Reboot the Host:**
    ```bash
    sudo reboot
    ```
*   **Verify the Success:**
    ```bash
    sudo nvme fw-log /dev/nvme0n1
    ```

---

## 📊 Live Homelab NVMe Telemetry

A snapshot of the active Samsung NVMe storage in the **Fusion** cluster:

### 🎛️ Matrix (Minisforum MS01 Compute Node)
Matrix utilizes two top-tier retail **Samsung 990 PRO** drives. Both are running the absolute latest firmware releases (released late 2025/early 2026), ensuring read-stability fixes are fully active.

| Drive Identifier | Model | Capacity | Firmware Version | Total Bytes Written (TBW) | Wear Level (`% used`) | Temp (Controller/NAND) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/dev/nvme0n1` | **Samsung 990 PRO 2TB** | 2000 GB | `8B2QJXD7` | **14.6 TB** | **0%** | 40°C / 42°C |
| `/dev/nvme1n1` | **Samsung 990 PRO 1TB** | 1000 GB | `5B2QJXD7` | **11.1 TB** | **1%** | 43°C / 46°C |

### 📦 Skynet (Storage & Backup Backend)
Skynet utilizes a Samsung OEM model (**PM9A1**, equivalent to a client 980 Pro) as its primary OS and local datastore disk.

| Drive Identifier | Model | Capacity | Firmware Version | Total Bytes Written (TBW) | Wear Level (`% used`) | Temp (Controller/NAND) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/dev/nvme0n1` | **PM9A1 Samsung** | 1024 GB | `36310029` | **32.2 TB** | **3%** | 39°C / 38°C |

> [!NOTE]
> The PM9A1 has completed **9,359 Power On Hours** (approx. 1.06 years of continuous runtime) with only **3% wear**, showing outstanding long-term durability.
