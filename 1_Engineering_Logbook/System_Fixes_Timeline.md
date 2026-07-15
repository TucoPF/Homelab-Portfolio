# System Fixes Log

## Date: 10 March 2026

### Issue 1: Unexpected Idle Reboots
* **Symptoms:** The HP Spectre 16 (Meteor Lake) laptop would suddenly reboot when left completely idle, particularly around times of low activity.
* **Diagnosis:** A known stability issue with Intel Meteor Lake processors on recent Linux kernels where transitioning into deep sleep states (C6-C10) causes a crash or hard reset.
* **Fix Applied:** Added the kernel parameter `intel_idle.max_cstate=4` to limit the depth of processor sleep states.
* **Implementation:** 
  1. Appended `intel_idle.max_cstate=4` to `/etc/kernel/cmdline`.
  2. Regenerated the Unified Kernel Image (UKI) using `sudo mkinitcpio -P`.

### Issue 2: `auto-cpufreq` Log Flooding and Conflicts
* **Symptoms:** `journalctl` logs were being flooded with "Device or resource busy" (`erreur d'écriture: Périphérique ou ressource occupé`) errors from the `auto-cpufreq` service.
* **Diagnosis:** The system was already utilizing the modern `intel_pstate` driver in active mode (which hardware-manages frequencies efficiently). `auto-cpufreq` was actively conflicting with this built-in driver, constantly attempting to apply changes that were locked by the hardware.
* **Fix Applied:** Stopped and disabled the redundant `auto-cpufreq` service.
* **Implementation:**
  ```bash
  sudo systemctl stop auto-cpufreq
  sudo systemctl disable auto-cpufreq
  ```

## Date: 15 March 2026

### Issue 3: NFS Input/Output Error (EIO) during Large File Transfers
* **Symptoms:** The `fusion_mover.sh` script failed when moving large files (e.g., 82GB 4K Remux). `rsync` reported `Input/output error (5)`. `journalctl` on matrix showed `nfs: server 192.168.1.50 not responding, timed out`.
* **Diagnosis:** The NFS mount on matrix was using the `soft` option. During sustained high-throughput writes (82GB+), the skynet HDD/MergerFS layer occasionally lagged behind, causing the NFS client to reach its retransmission limit and return a hard error to the application (rsync).
* **Fix Applied:** Changed the NFS mount type from `soft` to `hard` on matrix. Increased `timeo` to 600 (60 seconds) and `retrans` to 5 to allow the client to wait indefinitely for the server to recover instead of failing the transfer.
* **Implementation:**
  1. Modified `/etc/fstab` on matrix: Changed `soft` to `hard,timeo=600,retrans=5`.
  2. Applied changes: `sudo systemctl daemon-reload && sudo umount -l /mnt/skynet_pool && sudo mount /mnt/skynet_pool`.

### Issue 4: Network Loop / Intel vPro Conflict on matrix
* **Symptoms:** `dmesg` logs flooded with `received packet on nic1 with own address as source address` every 120 seconds.
* **Diagnosis:** The Intel vPro/AMT management firmware shares the physical RJ45 port of `nic1` (Intel i225/i226). Proxmox's `vmbr1` bridge was receiving its own reflected packets, causing potential instability or switch port blocking.
* **Fix Applied:** Migrated the Proxmox bridge (`vmbr1`) to a different physical port (**`nic0`**) to isolate OS traffic from the vPro/AMT management traffic.
* **Implementation:**
  1. Physically moved the RJ45 cable from `nic1` to `nic0`.
  2. Modified `/etc/network/interfaces` on matrix: Changed `bridge-ports nic1` to `bridge-ports nic0`.
  3. Verified `dmesg` for the absence of loop warnings.

### Issue 5: Slow Shutdown/Reboot on matrix (Proxmox Hang)
* **Symptoms:** matrix took 5-10 minutes to reboot, often hanging during the shutdown of LXC containers (101/Jellyfin and 102/Arr-Stack).
* **Diagnosis:** Containers were using a MergerFS mount (`/home/tuco/fusion`) that depends on a remote NFS mount (skynet). During shutdown, the network or NFS was being stopped *before* the containers, causing MergerFS to freeze and Proxmox to hang while waiting for the containers to exit.
* **Fix Applied:** Added a systemd override for the `pve-guests.service` to ensure containers are stopped *before* the fusion mount is touched.
* **Implementation:**
  1. Created `/etc/systemd/system/pve-guests.service.d/override.conf`.
  2. Added:
     ```ini
     [Unit]
     After=home-tuco-fusion.mount
     ```
  3. Reloaded systemd: `sudo systemctl daemon-reload`.
  4. Result: Shutdown time reduced from minutes to ~8 seconds.

## Date: 16 March 2026

### Issue 6: Pi4 Complete Freeze ("Zombie State")
* **Symptoms:** The Pi4 (192.168.1.100) stopped responding to SSH with `Connection reset by peer` and all hosted web services went offline, but it still responded to network pings. The system was completely locked up, requiring a hard power cycle.
* **Diagnosis:** The system ran completely out of RAM (OOM). Because Docker was running without memory limit support, a container could consume all available system RAM unchecked, crashing the Pi instead of just the container. Additionally, all historical logs were lost on reboot because `journald` was configured to use volatile (RAM) storage.
* **Fix Applied:** Enabled persistent logging, limited log size to protect the SSD, and enabled kernel memory cgroups to allow Docker to track and enforce RAM usage.
* **Implementation:**
  1. **Persistent Logging:** Created an override file at `/etc/systemd/journald.conf.d/40-rpi-volatile-storage.conf` with `Storage=persistent` and `SystemMaxUse=500M`. Restarted `systemd-journald`.
  2. **Memory Management (Cgroups):** Appended `cgroup_enable=cpuset cgroup_enable=memory cgroup_memory=1` to the beginning of `/boot/firmware/cmdline.txt`.
  3. **Cleanup:** Removed a broken NAS mount from `/etc/fstab` that caused boot hangs. Removed the heavy monitoring stack (Grafana, Loki, Prometheus) to free up resources.
  4. Rebooted the Pi4 to apply kernel changes. Verified `docker stats` now correctly reports memory usage.

### Issue 7: Scanopy Server/Daemon Communication Failure
* **Symptoms:** The Scanopy Web GUI continually displayed the "Create Daemon" onboarding screen. The Server and Daemon containers were running, but the Daemon logged `Missing network ID` and the Server logged connection timeouts to `http://host.docker.internal:60073`.
* **Diagnosis:** A combination of Docker bridge isolation and the Pi's strict `nftables` firewall prevented the Server container from reaching the Daemon running in Host Mode. Even after opening the firewall, Scanopy's onboarding process required an exact API key match to adopt the Daemon.
* **Fix Applied:** Opened specific ports in the firewall for Docker bridges, removed the daemon from the `docker-compose.yml`, and initialized the daemon manually using the command provided by the Scanopy Web GUI.
* **Implementation:**
  1. **Firewall Fix:** Updated `/etc/nftables.conf` to explicitly allow traffic from `docker0` and `br-*` to access essential Web UI ports and Scanopy ports (`60072`, `60073`), while keeping SSH (`22`) strictly locked to physical/Tailscale interfaces.
  2. **Configuration Update:** Updated the Server's `docker-compose.yml` to set `SCANOPY_PUBLIC_URL` to `http://192.168.1.100:60072`.
  3. **Daemon Initialization:** Removed the daemon service from docker-compose, stopped the existing container, and manually ran the `docker run` command provided by the Web GUI (ensuring `SCANOPY_SERVER_URL` was set to the Pi's IP, `192.168.1.100`). This injected the correct `SCANOPY_DAEMON_API_KEY` and `SCANOPY_NETWORK_ID`, successfully establishing the connection and starting network discovery.
## Date: 17 March 2026

### Issue 8: Broken Default Shell on matrix (Minisforum)
* **Symptoms:** SSH returned `Permission denied (publickey)` and the Proxmox local console displayed `root -- no shell: no such file or directory`.
* **Diagnosis:** The default shell for both `root` and `tuco` was changed to `zsh` before the package was actually installed on the system. Since the specified shell path was invalid, the OS refused all login attempts.
* **Fix Applied:** Used the GRUB `init=/bin/bash` method to gain a temporary root shell, bypassed the broken login process, and reset the shells to `/bin/bash`.
* **Implementation:**
  1. **GRUB Interception:** Interrupted the boot sequence and appended `init=/bin/bash` to the kernel parameters.
  2. **Emergency Access:** Mounted the root partition as read-write: `mount -o remount,rw /`.
  3. **Shell Reset:** Reverted shells for both accounts: `chsh -s /bin/bash root` and `chsh -s /bin/bash tuco`.
  4. **Clean Fix:** Once access was restored, properly installed `zsh` and its plugins before re-applying the configuration.

# Gemini Session Summary - 2026-03-01 (Post-Reboot Verification)

## Context
Verification of the fingerprint sensor power management fix after a system reboot.

## Status After Reboot
- **Fingerprint Sensor (06cb:016c)**:
  - **Path**: `/sys/bus/usb/devices/3-3`
  - **Power Control**: `on` (Verified)
  - **Autosuspend**: `-1` (Verified)
  - **Udev Rule**: `/etc/udev/rules.d/99-tudor-custom.rules` is correctly applied, setting the group to `input` and forcing power to `on`.

## Outcome
The fix is persistent across reboots. The sensor no longer enters autosuspend, which should eliminate wake-up delays during authentication.

## Pending Items
- **Gemini CLI Update**: User deferred the update to version 0.31.0 for now.
- **Real-world Testing**: User is currently testing the system to ensure stability and responsiveness.

## Date: 21 March 2026

### Issue 9: Intermittent Fingerprint Reader Unavailability (Hybrid Fix)
* **Symptoms:** The Synaptics fingerprint sensor (06cb:016c) would occasionally fail to respond, and `fprintd` logs reported "Device was already claimed" or "transfer timed out."
* **Diagnosis:** The `--no-timeout` (`-t`) flag was suspected of preventing the daemon from releasing the hardware handle. However, removing it completely led to other responsiveness issues. A hybrid approach was chosen to ensure both persistence and reliability.
* **Fix Applied:** Re-enabled the `-t` flag to keep the daemon active for faster subsequent unlocks, but kept `Restart=on-failure` to automatically recover the service if the sensor or daemon hangs/crashes.
* **Implementation:**
  1. Modified `/etc/systemd/system/fprintd.service.d/override.conf`:
     ```ini
     [Service]
     ExecStart=
     ExecStart=/usr/lib/fprintd -t
     Restart=on-failure
     ```
  2. Reloaded and restarted the service: `sudo systemctl daemon-reload && sudo systemctl restart fprintd.service`.

## Date: 24 March 2026

### Issue 10: Fingerprint Reader Initialization Failure (Error 789)
* **Symptoms:** The Synaptics fingerprint sensor (06cb:016c) stopped prompting for authentication during login or `sudo`. `fprintd` logs showed `Device responded with error: 789` and `Probe fingerprint sensor failed with 133!`.
* **Diagnosis:** The sensor requires the `tudor-host-launcher.service` to function as a bridge for the TOD driver. This service was `static` and not starting at boot. Because `fprintd` used the `-t` (no-timeout) flag, its initial failure at boot became persistent, as the daemon never exited to re-probe the hardware.
* **Fix Applied:** Enabled the `tudor-host-launcher` service to start at boot and synchronized `fprintd` to start only after the launcher is ready.
* **Implementation:**
  1. Updated `/etc/systemd/system/tudor-host-launcher.service` to include an `[Install]` section and `Restart=always`.
  2. Enabled and started the launcher: `sudo systemctl enable --now tudor-host-launcher.service`.
  3. Modified `/etc/systemd/system/fprintd.service.d/override.conf` to add `After=tudor-host-launcher.service` and `BindsTo=tudor-host-launcher.service`.
  4. Performed a USB reset (unbind/bind) to clear the hardware error state.

### Issue 11: Fingerprint Reader Conflict with TLP Autosuspend
* **Date:** 27 March 2026
* **Symptoms:** The sensor (06cb:016c) failed again with Error 789 after a period of stability.
* **Diagnosis:** Although a `udev` rule was present to disable autosuspend, `TLP` was active and overriding the rule on battery/AC transitions, forcing the device into a state where `fprintd` could not initialize it without a manual reset.
* **Fix Applied:** Explicitly denylisted the device in TLP to ensure it never autosuspends, regardless of the power source.
* **Implementation:**
  1. Created `/etc/tlp.d/99-fingerprint.conf` with: `USB_DENYLIST="06cb:016c"`.
  2. Applied settings: `sudo tlp start`.
  3. Reset the device: `echo "3-3" | sudo tee /sys/bus/usb/drivers/usb/unbind && sleep 1 && echo "3-3" | sudo tee /sys/bus/usb/drivers/usb/bind`.
  4. Verified with `tlp-stat -u` (control = on) and `fprintd-verify` (success).

## Date: 3 April 2026

### Issue 12: skynet Storage Expansion & Optimization (10TB SAS Upgrade)
* **Symptoms:** skynet "disk1" (1TB SSD) needed replacement to expand capacity for the "Fusion" tiered storage. A new 10TB SAS Enterprise drive (ST10000NM0096) was inserted but appeared empty/unformatted despite existing NTFS partitions.
* **Diagnosis:** 
    1. **Data Recovery:** `testdisk` scan confirmed the MFT was corrupted or wiped (likely a Quick Format), making original files inaccessible. User opted to wipe and repurpose the drive.
    2. **Protocol Conflict:** `hdparm` failed to manage the drive because it uses the SAS (SCSI) protocol instead of ATA/SATA.
    3. **Space Inefficiency:** EXT4 default reserved space (5%) was consuming ~465GB of usable space on the 10TB drive.
* **Fix Applied:** Formatted the drive as EXT4 with the `disk1` label, reclaimed "lost" space by reducing reserved blocks, and configured SAS-specific power management.
* **Implementation:**
    1. **Wipe & Format:** Used `mkfs.ext4 -F -L disk1 /dev/sda` after clearing the partition table with `fdisk`.
    2. **Space Reclamation:** Reduced EXT4 reserved space to **1%** on all skynet HDDs and the matrix Cache NVMe using `sudo tune2fs -m 1 /dev/sdX`. Reclaimed ~550GB of total capacity across the lab.
    3. **SAS Power Management:** Installed `sdparm` and `sg3-utils`. Disabled `IDLE_A` and `IDLE_B` states to prevent mechanical wear from frequent spin-downs: `sudo sdparm --set=IDLE_B=0 --save /dev/sda`.
    4. **Performance Verification:** Confirmed raw write speeds of **~230MB/s** using `dd` with `oflag=direct`.
    5. **Data Migration:** Restored files from matrix NVMe back to skynet using `rsync -avhP --preallocate --remove-source-files`. The `--preallocate` flag was used to ensure contiguous sector writes on the new 10TB platters.

### Issue 13: Fingerprint Reader "Device already claimed" (UEFI Fix)
* **Date:** 3 April 2026
* **Symptoms:** `fprintd` logs reported "Device was already claimed" preventing 1Password and system authentication from using the Synaptics sensor (06cb:016c).
* **Diagnosis:** The sensor's Match-on-Chip internal memory was holding onto stale security tokens from previous OS installations or BIOS pre-boot authentication, locking out `fprintd`.
* **Fix Applied:** Wiped the fingerprint hardware memory directly from the UEFI/BIOS settings instead of relying on OS-level workarounds (like TLP exclusions or `tudor-host-launcher` bridges used previously).
* **Implementation:**
    1. Rebooted into UEFI/BIOS settings.
    2. Navigated to Security > Fingerprint settings.
    3. Enabled the "Clear Fingerprint Data on boot" (or similar) option.
    4. Saved, exited, and let the system boot to clear the hardware state.
    5. Re-enrolled fingerprint via `fprintd-enroll`.

### Issue 14: Fingerprint Reader Performance & Claim Conflict (Hybrid OS Fix)
* **Date:** 3 April 2026
* **Symptoms:** After the initial UEFI wipe, the fingerprint reader still experienced ~10-second delays during unlock and periodic "Device was already claimed" errors in `journalctl`.
* **Diagnosis:** 
    1. **Autosuspend (Error 789):** Even without TLP, the standard Linux kernel was putting the USB sensor (06cb:016c) to sleep. The hardware was failing to wake up correctly, causing it to hang.
    2. **Race Condition:** GNOME Shell and 1Password were competing to "claim" the sensor, and the default `fprintd` timeout was too aggressive, causing them to block each other.
* **Fix Applied:** Disabled USB autosuspend for the sensor and implemented a systemd override to keep `fprintd` persistent.
* **Implementation:**
    1. **USB Power Management:** Created `/etc/udev/rules.d/99-fingerprint-autosuspend.rules` with:
       ```ini
       ACTION=="add|change", SUBSYSTEM=="usb", ATTR{idVendor}=="06cb", ATTR{idProduct}=="016c", TEST=="power/control", ATTR{power/control}="on"
       ```
    2. **Service Persistent Override:** Added a systemd override for `fprintd.service`:
       ```ini
       [Service]
       ExecStart=
       ExecStart=/usr/lib/fprintd -t
       Restart=on-failure
       ```
    3. **Activation:** Reloaded rules and service: `sudo udevadm control --reload-rules && sudo systemctl daemon-reload && sudo systemctl restart fprintd`.
    4. **Verification:** Confirmed power control state is permanently `on` via `cat /sys/bus/usb/devices/3-3/power/control`.

### Issue 15: GNOME Shell IBus "Set global engine failed" Log Noise
* **Date:** 3 April 2026
* **Symptoms:** `journalctl` flooded with `Gio.DBusError: GDBus.Error:org.freedesktop.DBus.Error.Failed: Set global engine failed: Operation was cancelled`.
* **Diagnosis:** Environment variables (`QT_IM_MODULE`, `XMODIFIERS`) were forcing IBus as a middleman for a single keyboard layout (`fr`). GNOME Shell repeatedly tried to set the IBus engine for every focus change/new window, but cancelled the request as redundant.
* **Fix Applied:** Unset IBus environment variables via a systemd user environment override to stop GNOME Shell from repeatedly trying to set the engine.
* **Implementation:**
    1. **Reset Gsettings:** Reverted `gtk-im-module` back to default: `gsettings reset org.gnome.desktop.interface gtk-im-module`.
    2. **Environment Override:** Created `~/.config/environment.d/99-unset-ibus.conf` to explicitly override the forcing variables for the Wayland session with harmless dummy values (since older systemd versions reject empty assignments with a syntax error):
       ```ini
       QT_IM_MODULE=wayland
       XMODIFIERS=@im=none
       QT_IM_MODULES=wayland
       ```
    3. **Activation:** Requires logout/login to apply to the user environment.

### Issue 16: GNOME Sharing Daemon "NoSuchUnit" Errors
* **Date:** 3 April 2026
* **Symptoms:** `gsd-sharing` reported `Failed to stop rygel.service: NoSuchUnit` and `Failed to stop gnome-user-share-webdav.service: NoSuchUnit` in `journalctl`.
* **Diagnosis:** GNOME's Settings Daemon attempted to manage media/file sharing backend services that were not installed on this minimal Arch system.
* **Fix Applied:** Installed the missing backend packages (`rygel`, `gnome-user-share`) to satisfy `gsd-sharing`'s unit checks without activating the services themselves.
* **Implementation:**
    1. Installed the missing packages: `sudo pacman -S rygel gnome-user-share`.
    2. Verified that both services remain `inactive (dead)` by default, consuming zero resources until manually enabled via GNOME Settings.



## Date: 09 April 2026

### Issue 17: Wi-Fi Roaming Drops and SSID Duplication
* **Symptoms:** NetworkManager/IWD created duplicate profiles (e.g., "Maison 1"). Connection would drop completely when moving between APs, with logs reporting `Reason: 15 (4WAY_HANDSHAKE_TIMEOUT)`.
* **Diagnosis:** Multiple conflicts:
    1. The Freebox WPA3 "Transition" mode caused negotiation failures.
    2. IWD's Fast Transition (802.11r) was timing out during the 4-way handshake.
    3. MAC Address Randomization caused APs to treat roaming as a new device connection, breaking state.
* **Fix Applied:** Stabilized the connection by disabling problematic "fast" features in favor of reliability and pinning the hardware identity.
* **Implementation:**
    1. **Router:** Set Freebox to "WPA2/WPA3 Compatibility" and purged stale connections.
    2. **IWD Config:** Modified `/etc/iwd/main.conf` to set `EnableFT=false` and tuned roaming: `RoamThreshold=-70`, `RoamThreshold5G=-74`.
    3. **MAC Identity:** Set the "Maison" connection to use the permanent hardware MAC address (`nmcli connection modify Maison 802-11-wireless.mac-address E4:85:FB:8A:2A:43`).

### Issue 18: Fingerprint Reader "Device already claimed" after Suspend
* **Symptoms:** After re-enabling system suspend (S0ix), the Synaptics sensor (06cb:016c) failed on wake-up. `journalctl` reported "Corrupted message", "Got unexpected sequence number", and "Device was already claimed".
* **Diagnosis:** The sensor's hardware state machine desynchronizes during power state transitions. Because `fprintd` is configured as persistent (`-t`), it maintains a stale, broken handle to the USB device upon resume.
* **Fix Applied:** Implemented a systemd resume hook to force a fresh initialization of the fingerprint daemon whenever the laptop wakes up.
* **Implementation:**
    1. Created `/etc/systemd/system/fprintd-resume.service` triggered by `suspend.target`.
    2. Configured it to run `systemctl restart fprintd.service`.
    3. Enabled the service: `sudo systemctl enable fprintd-resume.service`.

### Issue 19: Keyboard Controller "Unknown Key 0xab" Log Spam
* **Symptoms:** `journalctl` was flooded with hundreds of entries: `atkbd serio0: Unknown key pressed (translated set 2, code 0xab)`.
* **Diagnosis:** HP Spectre firmware sends redundant "ghost" scan codes (0xab) via the PS/2 interface for events already handled by the WMI driver (like brightness or lid changes). The kernel logs an error because it has no mapping for this raw code.
* **Fix Applied:** Silenced the log noise by mapping the scan code to `reserved` in the hardware database.
* **Implementation:**
    1. Created `/etc/udev/hwdb.d/90-hp-keyboard.hwdb`.
    2. Added mapping: `KEYBOARD_KEY_ab=reserved` for the HP Spectre DMI signature.
    3. Updated the database: `sudo systemd-hwdb update && sudo udevadm trigger`.

### Issue 20: System Freeze and Session Logout on Resume (Bus Contention)
* **Date:** 09 April 2026
* **Symptoms:** Upon waking from suspend (S2idle), the system froze for ~13 seconds, forced a GDM logout, and reset GNOME touchpad settings (middle-click emulation). `dmesg.bak` showed `ath12k_pci: failed to start mhi: -34` and `scheduled expiry is in the past`.
* **Diagnosis:** A race condition occurred between the new Wi-Fi 7 card (ath12k) and the `fprintd-resume.service`. The Wi-Fi card's slow resume process locked the PCI bus; when the fingerprint service attempted a simultaneous hardware reset, the bus contention triggered a kernel "hiccup" long enough to crash the Wayland session and reset input device configurations.
* **Fix Applied:** Implemented a 5-second delay in the fingerprint resume service to allow the Wi-Fi driver to stabilize before initiating the fingerprint sensor reset.
* **Implementation:**
    1. Modified `/etc/systemd/system/fprintd-resume.service`.
    2. Added `ExecStartPre=/usr/bin/sleep 5` to the `[Service]` section.
    3. Reloaded: `sudo systemctl daemon-reload`.
* **Status:** Verified stable after multiple suspend cycles. Touchpad settings (middle-click) and Wi-Fi connection now persist correctly across resumes.

## Date: 12 April 2026

### Issue 9: Qualcomm WCN785x (ath12k) Wi-Fi 7 Instability
* **Symptoms:** 'failed to pull fw stats: -71' and 'qmi dma allocation failed' in dmesg. 4-way handshake timeouts during roaming.
* **Diagnosis:** Missing CMA memory reservation (driver failed to allocate 7MB contiguous blocks) and aggressive PCIe ASPM power management timing issues.
* **Fix Applied:** Reserved 256M of CMA memory and removed the 'powersave' ASPM policy.
* **Implementation:**
  1. Added 'cma=256M' to /etc/kernel/cmdline.
  2. Removed 'pcie_aspm.policy=powersave' from /etc/kernel/cmdline.
  3. Regenerated the UKI using 'sudo mkinitcpio -p linux'.
  4. Restored iwd thresholds to stable defaults (-70/-74).

## Date: 23 April 2026

### Issue 21: skynet Backplane Noise Investigation and Safe Shutdown
* **Symptoms:** Strange noise originating from the Icybox IB-544SSK backplane on the `skynet` server.
* **Diagnosis:** Ran SMART short tests on all 4 SAS drives (`sda`, `sdb`, `sdc`, `sdd`). Tests passed with no errors. Spun down drives `sdb`, `sdc`, `sdd` and finally `sda` using `sg_start --stop`, confirming the noise was not the drives but likely the backplane fan.
* **Findings:** `sda` (Serial: ZA29BN5M0000C9091B6V) reported 3 reassigned blocks in SMART health status. This needs to be monitored to see if the number grows. The other three drives reported 0 reassigned blocks.
* **Action Taken:** Placed the backplane face down to alleviate fan noise temporarily while waiting for a new Jonsbo 5 case. Decided to keep the drives spun down and the backplane powered off until the new case arrives.
* **Fix Applied:** 
  * Safely prepared the system for backplane power-off without shutting down the OS by stopping the NFS server, unmounting the 4 disk partitions, and exporting the ZFS pool.
  * Note: User safely unmounted all skynet shares from `matrix` as an extra precaution before proceeding.
  * Disabled the daily file-mover cron job (`/home/tuco/scripts/fusion_mover_skynet.sh`) while the drives are offline.
* **Implementation (Safe Backplane Power-off Procedure):**
  ```bash
  sudo systemctl stop nfs-kernel-server nfs-server
  sudo umount -l /mnt/disk1 /mnt/disk2 /mnt/disk3 /mnt/disk4
  sudo zpool export cloud_pool
  ```
  *Note: The drives are configured with the `nofail` option in `/etc/fstab`, so `skynet` can boot safely even with the backplane powered off. The cleanest approach taken was to fully shut down `skynet`, turn off the backplane, and power `skynet` back on.*

## Date: 25 April 2026

### Issue 22: Qualcomm WCN785x (ath12k) Memory Corruption & Kernel Panics
* **Symptoms:** Hard system lockups/kernel panics (e.g., `__kmalloc` panic during `ip6_finish_output`) when the laptop wakes from sleep or under network load. `dmesg` shows constant `failed to pull fw stats: -71` and `qmi dma allocation failed`. Also experienced network drops (CIFS timeouts) due to the Wi-Fi radio antenna sleeping.
* **Diagnosis:** 
  1. The Meteor Lake motherboard's aggressive PCIe Active State Power Management (ASPM) was putting the Wi-Fi 7 card's PCIe lanes into micro-sleep states (L0s/L1). The `ath12k` driver timed out trying to wake the link to allocate memory, resulting in timeouts and eventual kernel memory pool corruption. (Previous global IOMMU passthrough `iommu=pt` was redundant as the kernel already defaulted to identity mapping).
  2. The 802.11 Wi-Fi protocol power saving was causing the internal radio antenna to sleep, triggering the `-71` firmware timeouts when it failed to wake up quickly enough.
* **Fix Applied:** 
  1. Disabled ASPM (L0s and L1 sleep states) specifically for the Qualcomm Wi-Fi card using a targeted `udev` rule, keeping global power management intact. Maintained `cma=256M` to ensure 7MB contiguous memory blocks are always available.
  2. Disabled 802.11 software power saving for the `wlan0` interface via a NetworkManager dispatcher script to keep the radio antenna awake.
* **Implementation:**
  1. **ASPM Fix:** Created `/etc/udev/rules.d/99-wifi-aspm.rules` with the following rule:
     `ACTION=="add|change", SUBSYSTEM=="pci", ATTR{vendor}=="0x17cb", ATTR{device}=="0x1107", ATTR{link/l1_aspm}="0", ATTR{link/l0s_aspm}="0", ATTR{link/l1_1_aspm}="0", ATTR{link/l1_2_aspm}="0"`
     Reloaded rules: `sudo udevadm control --reload-rules && sudo udevadm trigger --subsystem-match=pci --attr-match=vendor=0x17cb --attr-match=device=0x1107`
  2. **Radio Power Save Fix:** Created `/etc/NetworkManager/dispatcher.d/01-disable-wifi-powersave`:
     ```bash
     #!/bin/sh
     /usr/bin/iw dev wlan0 set power_save off
     ```
     Made it executable: `sudo chmod +x /etc/NetworkManager/dispatcher.d/01-disable-wifi-powersave`.

## Date: 23 May 2026

### Issue 23: LXC 103 (Arr-Stack-103) Container OS Disk Depletion (100% Full)
* **Symptoms:** The Arr stack services (Radarr, Sonarr, Bazarr, Prowlarr, Seerr) were facing impending OS disk storage exhaustion, with the LXC 103 root filesystem (`/`) reporting 94% utilization (14 GB used of 16 GB).
* **Diagnosis:** Since docker-compose updates pull new images without garbage-collecting the previous layers, `containerd` had accumulated 12 GB of image and layer storage in `/var/lib/containerd`. Specifically, 21 dangling, untagged images occupied 9.12 GB of reclaimable space.
* **Fix Applied:** Purged dangling/unused Docker images and configured a persistent systemd timer inside LXC 103 to run a weekly automated prune.
* **Implementation:**
  1. **Immediate Cleanup:** Executed `docker image prune -a -f` inside LXC 103, freeing 9.0 GB and reducing disk utilization from 94% to 35% (5.1 GB used).
  2. **Automated Weekly Prune Service:** Created `/etc/systemd/system/docker-prune.service` inside LXC 103:
     ```ini
     [Unit]
     Description=Prune unused Docker images
     After=docker.service
     Requires=docker.service

     [Service]
     Type=oneshot
     ExecStart=/usr/bin/docker image prune -f
     ```
  3. **Weekly Timer Config:** Created `/etc/systemd/system/docker-prune.timer` inside LXC 103:
     ```ini
     [Unit]
     Description=Run weekly Docker prune

     [Timer]
     OnCalendar=weekly
     Persistent=true

     [Install]
     WantedBy=timers.target
     ```
  4. **Activation:** Registered and enabled the timer:
     ```bash
     systemctl daemon-reload
     systemctl enable --now docker-prune.timer
     ```
     Verified that the timer triggers `docker-prune.service` successfully and is active (`waiting` status).

### Issue 24: Redundant Virtual Interfaces and Subnets on LXC 103 (Arr-Stack-103)
* **Date:** 23 May 2026
* **Symptoms:** The LXC 103 container was cluttered with multiple redundant virtual ethernet interfaces (`veth*`), docker-compose custom bridges (`br-*`), and the default `docker0` bridge network interface, adding unnecessary network hops and complexity.
* **Diagnosis:** Since all Arr stack containers were transitioned to `network_mode: host` to simplify inter-container networking and lower CPU/IO overhead, Docker's virtual bridges and the default `docker0` interface were completely unused. Additionally, a known legacy limitation in the Servarr HTTP engine (`ManagedHttpDispatcher`) explicitly disables IPv6 outgoing sockets whenever a working IPv4 interface is active, meaning the containers must continue using local IPv4 (`192.168.1.102:6789`) to communicate with NZBGet.
* **Fix Applied:** Pruned all leftover custom networks, and configured the Docker daemon to prevent the creation of the default `docker0` bridge, restoring a clean, minimalist network stack.
* **Implementation:**
  1. **Pruned Custom Bridges:** Cleaned up unused custom docker networks by running `docker network prune -f`, immediately removing `arr-stack_default` and its associated interfaces.
  2. **Disabled Default Bridge Interface:** Created `/etc/docker/daemon.json` inside LXC 103:
     ```json
     {
       "bridge": "none"
     }
     ```
  3. **Applied Changes:** Restarted the Docker service:
     ```bash
     systemctl restart docker
     ```
  4. **Verification:** Verified `ip addr` inside LXC 103. The `docker0` bridge has been completely removed. The container now has a hardened, clean dual-stack network with only `lo` and `eth0` active, while all containers run flawlessly in Host Network Mode.

### Issue 25: Delayed Media Discovery in Jellyfin (LXC 101) Post-Import
* **Date:** 23 May 2026
* **Symptoms:** Newly imported movies (completed from Radarr) took an excessively long time (several minutes) to show up in the Jellyfin client UI.
* **Diagnosis:** Jellyfin is configured with a default `<LibraryMonitorDelay>` of `60` seconds inside `/etc/jellyfin/system.xml`. This stabilization timer is designed to wait for files to finish writing (copying) over network/disk. However, because this setup utilizes the **"Fusion Trick"** NVMe bind mount, file imports are instantaneous atomic hardlinks requiring zero write time, making the 60-second delay completely redundant.
* **Fix Applied:** Reduced the library monitoring stabilization delay from `60` down to `3` seconds.
* **Implementation:**
  1. **Config Modification:** Updated `/etc/jellyfin/system.xml` inside Jellyfin LXC 101 to set:
     ```xml
     <LibraryMonitorDelay>3</LibraryMonitorDelay>
     ```
  2. **Applied Changes:** Restarted the Jellyfin service:
     ```bash
     systemctl restart jellyfin
     ```
  3. **Verification:** Verified the configuration change and confirmed that library refreshes trigger almost instantly (3-second delay) upon receiving Radarr's API updates.

### Issue 26: Incorrect Time and Log Timestamps Across LXC and Docker Containers
* **Date:** 23 May 2026
* **Symptoms:** Log entries and system times inside the LXC containers and Docker containers (Jellyfin, NZBGet, Radarr, Sonarr, etc.) were displaying in UTC (or other incorrect timezones), making log correlation and troubleshooting difficult.
* **Diagnosis:** Proxmox LXC containers share the host kernel clock. While the physical time is correct, the container system configuration defaults to the `UTC` timezone. Additionally, the Docker containers in LXC 103 had explicit `TZ=Etc/UTC` (and `TZ=Asia/Tashkent` for Seerr) environment variables hardcoded in their `docker-compose.yml`, overriding system-level timezone settings.
* **Fix Applied:** Configured all LXC container system files and Docker compose environments to utilize the local `Europe/Paris` (CEST, UTC+2) timezone.
* **Implementation:**
  1. **LXC System Timezone Update:** Executed a system timezone adjustment loop across all containers (`100`, `101`, `102`, `103`, `111`, `112`, `113`, `114`, `121`), symlinking `/etc/localtime` to `/usr/share/zoneinfo/Europe/Paris` and running `dpkg-reconfigure -f noninteractive tzdata` to sync active, template, and trade systems.
  2. **Docker Timezone Update:** Modified `/root/Arr-Stack/docker-compose.yml` inside LXC 103 to set `TZ=Europe/Paris` for all services (Radarr, Sonarr, Prowlarr, Bazarr, Seerr).
  3. **Recreated Stack:** Re-deployed the Docker stack using `docker compose up -d --force-recreate` to load the updated environment variables.
  4. **Verification:** Audited logs inside Radarr and Jellyfin. Timestamps now align perfectly to local Paris time (`Europe/Paris`, currently CEST / UTC+2).

## Date: 28 May 2026

### Issue 27: skynet Transition from Proxmox Backup Server (PBS) to Native Proxmox Virtual Environment (PVE)
* **Symptoms:** skynet was running a legacy dedicated PBS setup. The user wanted to transition skynet into a fully native Proxmox Virtual Environment (PVE 9) compute/storage node while preserving the physical MergerFS media pool and ZFS cloud pool intact.
* **Diagnosis:** Upgrading/converting required a clean PVE installation on the primary OS NVMe drive (`nvme0n1`), followed by restoring full homelab custom configurations (1Password passwordless SSH-agent sudo authorization, MergerFS tiering, custom shell profiles, NFS exports, and the nightly storage mover script).
* **Fix Applied:** Formatted and installed PVE 9 natively on the NVMe system drive, safely preserved and imported ZFS and MergerFS pools, restored PAM SSH-agent auth permissions, and updated all system and shell profiles.
* **Implementation:**
  1. **Clean Installation:** Formatted the 1TB NVMe system drive and installed native PVE 9 (`pve-manager/9.2.3`, kernel `7.0.2-6-pve`).
  2. **Storage Reconstruction:** Imported the ZFS pool (`zpool import -f cloud_pool`), remounted the 4x 10TB Seagate Exos partitions via `LABEL=diskX`, and successfully reconstituted the 35TB MergerFS pool at `/mnt/skynet-pool`.
  3. **Network Configuration & Mounts:** Bound matrix's NFS mounts, configured `/etc/exports` to export `/mnt/skynet-pool` and `/mnt/cloud` back to matrix, and verified `systemd-automount` triggers.
  4. **PAM Sudo SSH-Agent Restoration:** Restored `pam_ssh_agent_auth.so` for passwordless sudo, adjusted the authorized keys ownership and permissions to `644` under `/etc/ssh/sudo_authorized_keys/tuco`, and preserved the `SSH_AUTH_SOCK` variable.
  5. **Shell Customization:** Set up Zsh profiles (`.zshrc`) for `root` (with `jellyfin` and `arr` LXC pct entrance shortcuts) and changed the default shell of `root` to `/bin/zsh`.

## Date: 29 May 2026

### Issue 28: Idle Clicking/Ticking Noise on skynet SAS Pool Drive (/dev/sda)
* **Symptoms:** An audible, periodic "clickety" or ticking sound was coming from the Jonsbo N5 chassis when the storage pool was idle, isolated specifically to `/dev/sda`. Later, it was observed that when waking up the pool, `/dev/sda` would perform a clicking/ticking calibration routine for approximately 1 minute before becoming quiet.
* **Diagnosis:** Checked the Extended Power Conditions (EPC) using `sdparm`. Originally, `/dev/sda` had `Idle_A` and `Idle_B` disabled (`0`), while the other drives had them enabled (`1`). Aligning `sda` to match the others resolved the initial idle clicking. However, on wake-up from the deep `Idle_B` state, `/dev/sda` still performed a 1-minute calibration. This is because `/dev/sda` is the only drive in the pool with remapped sectors in its Grown Defect List (G-List: 3 sectors, healthy and stable). Upon waking from deep idle, the drive firmware runs a Thermal Fly-height Control (TFC) and track-alignment sweep to verify physical boundaries for these remapped blocks. The other drives have 0 grown defects and therefore woke up silently.
* **Reversion / Final Resolution:** We attempted to disable `Idle_B` on all drives to force them into `Idle_A` (heads unparked), hoping to bypass the wake-up calibration noise. However, this forced the Seagate Exos firmware to keep the heads loaded in active tracking mode, which triggered rapid, continuous seeking cliquetis (multiple times per second) due to Preventive Wear Leveling (PWL) and active track alignment. Since the pool is only active once a day (at 3:00 AM for the nightly MergerFS mover), this high-frequency noise was unacceptable. All drives were reverted back to their original factory defaults (`sda` at `IDLE_A=0`/`IDLE_B=0`, and `sdb`/`sdc`/`sdd` at `IDLE_A=1`/`IDLE_B=1`), restoring silence when idle.
* **Implementation:**
  1. Gained SSH access to skynet (`192.168.1.200`).
  2. Reverted power conditions to original states:
     ```bash
     sdparm --set=IDLE_A=0 --save /dev/sda
     sdparm --set=IDLE_B=0 --save /dev/sda
     for dev in sdb sdc sdd; do
       sdparm --set=IDLE_A=1 --save /dev/$dev
       sdparm --set=IDLE_B=1 --save /dev/$dev
     done
     ```
  3. Silenced the active drive immediately: `sg_start --stop /dev/sda`.
  4. **Finalized on 30 May 2026**: Implemented a robust boot-time systemd service (`sas-power-management.service`) and helper script (`/usr/local/bin/sas-power-management.sh`) on skynet. This service dynamically discovers all Seagate Exos drives on boot and locks them in `Idle_B` deep idle (heads safely parked, spindles spinning) to achieve complete silence when not in use while avoiding mechanical spindle start/stop motor wear. Verified all four drives (`sda`, `sdb`, `sdc`, `sdd`) were successfully and flawlessly configured at runtime.

## Date: 30 May 2026

### Issue 29: Traefik Boot-Time Failure and CrowdSec LAPI Dependency Race
* **Symptoms:** Traefik always fails on reboot because it cannot download plugins (network/DNS not ready) or connect to CrowdSec LAPI. Even with `Restart=on-failure` in its systemd service, it doesn't restart. The user must manually restart CrowdSec first, then restart Traefik.
* **Diagnosis:** 
    1. **Disabled Plugins on Boot:** During startup, Traefik attempts to download its plugins (`crowdsec-bouncer`, `geoblock`) from `plugins.traefik.io`. Because the external network or DNS (AdGuard-115) is not fully stable, the download fails.
    2. **Systemd Silent Failure:** When plugins fail to load, Traefik disables all plugins globally, logs the error, and continues running. Since it never crashes or exits, systemd sees it as successfully `active (running)`. Therefore, the `Restart=on-failure` rule is never triggered, leaving the reverse proxy permanently crippled.
    3. **The CrowdSec Race:** CrowdSec LAPI (`LXC 114`) also suffers a boot network race. If external DNS is down, it fails watcher login, exits FATAL, and systemd sleeps for 60 seconds before retrying. Restarting CrowdSec manually wakes it up instantly; then restarting Traefik allows a clean connection.
* **Fix Applied:** Implemented a self-healing systemd verification script (`ExecStartPost`) inside Traefik's override to dynamically fail startup if plugins are disabled, forcing an automatic restart loop.
* **Implementation:**
    1. Modified `/etc/systemd/system/traefik.service.d/traefik_override.conf` inside `LXC 112` to append:
       ```ini
       # Self-Healing: If Traefik starts crippled, exit with failure to trigger systemd restart
       ExecStartPost=+/bin/bash -c "sleep 2 && if journalctl _SYSTEMD_INVOCATION_ID=\$\$INVOCATION_ID --no-pager | grep -E 'Plugins are disabled|invalid middleware'; then exit 1; fi"
       ```
    2. Reloaded and restarted: `systemctl daemon-reload && systemctl restart traefik`.
    3. Result: Traefik now boots perfectly, and if any transient network/LAPI error occurs, it will automatically restart itself every 5 seconds until healthy.

## Date: 3 June 2026

### Issue 30: Proxmox "Backup" Storage Activation Failure (Multi-Node Mount Expectation)
* **Symptoms:** Trying to activate a newly configured SSD (repurposed 1TB NVMe) as a directory storage (`Backup`) on both Proxmox nodes (`skynet` and `matrix`) failed on `matrix` with `TASK ERROR: could not activate storage 'Backup': unable to activate storage 'Backup' - directory is expected to be a mount point but is not mounted: '/mnt/pve/Backup'`. The Backup storage remained inactive in the WebGUI.
* **Diagnosis:** The storage was defined in `/etc/pve/storage.cfg` with `is_mountpoint 1` and restricted to `nodes skynet,matrix`. Because the physical SSD is plugged into `skynet`, Proxmox successfully mounted it there via systemd (`mnt-pve-Backup.mount`), but the directory `/mnt/pve/Backup` on `matrix` had no underlying mount, causing PVE's mount check to fail.
* **Fix Applied:** Exported `/mnt/pve/Backup` from `skynet` over NFS and mounted it on `matrix` via `/etc/fstab` using systemd automount. This ensures `/mnt/pve/Backup` is an active mount point on both nodes, resolving the Proxmox validation checks.
* **Implementation:**
    1. **NFS Export (skynet):** Added `/mnt/pve/Backup matrix(rw,sync,no_subtree_check,no_root_squash,fsid=104)` to `/etc/exports` and reloaded using `sudo exportfs -arv`. Note: `no_root_squash` is critical to allow Proxmox to run root-level `vzdump` backup tasks over NFS.
    2. **Mount Setup (matrix):** Created the target mount directory (`sudo mkdir -p /mnt/pve/Backup`) and appended the automount configuration to `/etc/fstab`:
       ```text
       skynet:/mnt/pve/Backup /mnt/pve/Backup nfs noauto,x-systemd.automount,x-systemd.device-timeout=5,hard,timeo=600,retrans=5,noatime,_netdev 0 0
       ```
    3. **Activation:** Reloaded systemd on matrix (`sudo systemctl daemon-reload`) and triggered the mount. Checked `pvesm status` to verify `Backup` storage is successfully active and operational across both nodes.

## Date: 07 June 2026

### Issue 31: Homelab Node Automatic Security Updates (unattended-upgrades)
* **Symptoms:** Homelab nodes (`matrix` and `skynet`) lacked an automated patching mechanism, requiring manual intervention to update base OS libraries against security vulnerabilities.
* **Diagnosis:** Debian packages can be automated using `unattended-upgrades`. However, Proxmox-specific packages (running in a no-subscription repository) contain hypervisor code (PVE manager, QEMU, ZFS, kernels) which can cause active service restarts, storage disruptions, or require unscheduled reboots. Standard settings also trigger DBus or power/battery check warnings when systemd is polled.
* **Fix Applied:** Configured `unattended-upgrades` to automatically install Debian Security, Base, and Stable updates daily, while explicitly pinning Proxmox repositories to a negative priority to exclude them from automated updates. Resolved system warnings by installing auxiliary packages (`python3-gi`, `powermgmt-base`) and configured automated cleanup of old kernels and unused packages while disabling automatic reboots.
* **Implementation:**
    1. **Ansible Playbook Creation:** Created `/home/tuco/scripts/ansible-updates/setup_unattended_upgrades.yml` to automate deployment.
    2. **Dependencies:** Installed `unattended-upgrades`, `python3-gi`, `powermgmt-base`, and `apt-listchanges` on both nodes.
    3. **Periodic Config:** Deployed `/etc/apt/apt.conf.d/20auto-upgrades` to trigger checks daily.
    4. **Safety Profile:** Deployed `/etc/apt/apt.conf.d/50unattended-upgrades` with `Unattended-Upgrade::Origins-Pattern` configured to allow automated updates, enabled auto-cleanup of unused dependencies, and configured staggered `Automatic-Reboot "true"` windows (04:30 AM on skynet, 05:00 AM on matrix) to ensure storage target priority.
    5. **Verification:** Ran `sudo unattended-upgrades --dry-run --debug` on both `matrix` and `skynet` to verify the rules and confirm no warnings or errors were present.

## Date: 07 June 2026

### Issue 32: Redundant SSD Trim Wear & Uncoordinated Cache Mover
* **Symptoms:** The daily `fstrim-cache.timer` triggered a trim on `/mnt/matrix-cache` at 04:00 AM regardless of whether any data had been migrated, leading to redundant write/erase wear on the 2TB NVMe SSD.
* **Diagnosis:** Trimming should follow file deletion immediately, but the `fusion_mover.sh` script runs as the unprivileged `tuco` user and cannot execute root-level commands like `fstrim`.
* **Fix Applied:** Modified the mover script to generate a RAM-backed flag (`/dev/shm/fusion_mover_moved`) only when data is moved. Updated the systemd service to intercept this flag and trigger `fstrim-cache.service` as root using systemd's privilege override prefix (`+`), and removed the redundant standalone timer.
* **Implementation:**
    1. **Script Update:** Modified `/home/tuco/scripts/fusion_mover.sh` to check for files older than 60 minutes, set `FILES_MOVED=1` upon rsync completion, and touch `/dev/shm/fusion_mover_moved`.
    2. **Service Chaining:** Added `ExecStartPost=+/bin/bash -c "if [ -f /dev/shm/fusion_mover_moved ]; then rm -f /dev/shm/fusion_mover_moved; /usr/bin/systemctl start fstrim-cache.service; fi"` to `/etc/systemd/system/fusion-mover.service`.
    3. **Cleanup:** Stopped, disabled, and deleted `/etc/systemd/system/fstrim-cache.timer`.
    4. **Timer Schedule Tuning:** Updated `/etc/systemd/system/fusion-mover.timer` to trigger at 07:00 AM to execute well after the early morning host reboot windows.

## Date: 09 June 2026

### Issue 33: Proxmox Cluster Crash (Systemd Boot Loop)
* **Symptoms:** The Proxmox cluster completely failed to form upon reboot. matrix reported `Cannot initialize CMAP service`, `corosync.service` was completely dead, and `pvestatd` locked the `/etc/pve` filesystem. skynet remained online but lost quorum.
* **Diagnosis:** A legacy systemd override (`/etc/systemd/system/zfs-import-cache.service.d/override.conf`) was forcing ZFS to wait for `open-iscsi.service`. This created an unbreakable systemd dependency loop: `zfs` -> `iscsi` -> `network-online.target` -> `networking` -> `local-fs` -> `zfs`. To break the loop, systemd's non-deterministic resolver arbitrarily killed the `network-online.target` startup job, causing the network-dependent `corosync.service` to abort.
* **Fix Applied:** Dismantled the dependency loop by deleting the rogue ZFS override, and established a completely resilient MergerFS mount topology using standard `fstab` ordering. Re-established the LXC container shutdown hook (`pve-guests`) to target the correct iSCSI fusion mount path.
* **Implementation:**
    1. **Broke the Loop:** Deleted `/etc/systemd/system/zfs-import-cache.service.d/override.conf`. ZFS cache imports will now safely fail early and be dynamically imported by `pvestatd` later.
    2. **Resilient Fstab:** Edited `/etc/fstab` on matrix. Changed MergerFS pool and fusion options to include `_netdev`, `nofail`, and `x-systemd.after=...` pointing to their respective underlying storage arrays. This enforces the correct mount order during a healthy boot but allows matrix to boot gracefully into an emergency-free state even if skynet is offline.
    3. **Container Shutdown Hook:** Recreated `/etc/systemd/system/pve-guests.service.d/override.conf` with `After=mnt-fusion.mount` to prevent Proxmox from hanging for 10 minutes by ensuring containers are cleanly stopped before the network backend is unmounted.

## Date: 16 June 2026

### Issue 34: Windows 1Password SSH Agent Forwarding & Debian VM Setup
* **Symptoms:** 
  1. The Windows OpenSSH client failed to connect to the 1Password SSH Agent, logging `get_agent_identities: ssh_get_authentication_socket: No such file or directory` and prompting for passwords on matrix and skynet.
  2. The newly created Debian VM (VM 1000, `Laptop` on skynet) was unreachable via SSH, lacked an IPv6 ULA, and did not support passwordless `sudo` via forwarded agent.
* **Diagnosis:**
  1. The Windows SSH config file (`C:\Users\tuco\.ssh\config`) contained the legacy directive `IdentityAgent "\\.\pipe\openssh-ssh-agent"`. Modern Windows OpenSSH interprets this as a UNIX domain socket filesystem path, failing to locate it, whereas it natively defaults to the Named Pipe without this directive.
  2. Sudo on the Debian VM stripped the `SSH_AUTH_SOCK` environment variable, preventing the `pam_ssh_agent_auth.so` PAM module from communicating with the forwarded 1Password agent.
* **Fix Applied:**
  1. Commented out the `IdentityAgent` directive in the Windows `.ssh/config`.
  2. Bootstrapped the SSH key (`Clé SSH T800`) on the Debian VM using the Proxmox guest agent.
  3. Added the permanent ULA IP `fddf::10/64` to the VM's network interface using NetworkManager.
  4. Installed `libpam-ssh-agent-auth` and configured `/etc/pam.d/sudo` and `/etc/sudoers.d/ssh_auth_sock` inside the VM to preserve `SSH_AUTH_SOCK` and authorize the key.
  5. Configured shell functions in the laptop's PowerShell profile to create shorthand commands (`t`, `m`, `s`, `p`) equivalent to the Zsh aliases.
* **Implementation:**
  1. **SSH Config Correction:** Commented out `IdentityAgent` in `C:\Users\tuco\.ssh\config`.
  2. **Debian VM Network Setup:** 
     ```bash
     sudo qm guest exec 1000 -- nmcli connection modify 'Wired connection 1' +ipv6.addresses 'fddf::10/64'
     sudo qm guest exec 1000 -- nmcli connection up 'Wired connection 1'
     ```
  3. **PAM Sudo SSH Auth Setup:** 
     Installed `libpam-ssh-agent-auth` on the VM. Injected key into `/etc/ssh/authorized_keys/tuco` and PAM rule into `/etc/pam.d/sudo`:
     ```pam
     auth sufficient pam_ssh_agent_auth.so file=/etc/ssh/authorized_keys/%u debug
     ```
     Created `/etc/sudoers.d/ssh_auth_sock` with `Defaults env_keep += "SSH_AUTH_SOCK"`.
  4. **PowerShell Profile Shortcuts:** Appended functions `t`, `m`, `s`, `p` to `$PROFILE`.

## Date: 12 July 2026

### Issue 35: LSI HBA Option ROM Boot Freeze & Linux Flash Bypass
* **Symptoms:** Motherboard POST hang (MSI debug code 73/92) and 2m30s boot delay caused by LSI SAS2308 HBA Option ROM (BIOS/UEFI BSD) on modern AMD AM5 (MSI X870E) platform.
* **Diagnosis:** 
    1. UEFI Shell v1.0 (UDK2014) is incompatible with newer BIOS GOP and freezes on boot (blinking cursor).
    2. UEFI Shell v2.0 prevents executing legacy `sas2flash.efi` due to the deprecated `EFI_SHELL_INTERFACE` protocol check (`InitShellApp` error).
    3. Linux `sas2flash` is blocked from executing raw MMIO chip erases (`-e 5`/`-e 6`) by kernel device memory protections (Lockdown/Strict DevMem).
* **Fix Applied:** Used the interactive 64-bit Linux utility `lsiutil` under Proxmox to perform a BIOS/FCode erase, which bypassed kernel restrictions and wiped the Option ROMs while keeping the active IT mode firmware (`20.00.07.00`) intact.
* **Implementation:**
    1. **Tool Acquisition:** Downloaded the static 64-bit binary:
       ```bash
       wget -O /tmp/lsiutil https://raw.githubusercontent.com/thomaslovell/LSIUtil/master/Binaries/LSIutil_1.70_release_binaries/linux/lsiutil.x86_64
       chmod +x /tmp/lsiutil
       ```
    2. **Execution & Erase:** Ran `sudo /tmp/lsiutil` and selected the MPT Port. Selected **Option 4** (*Download/erase BIOS and/or FCode*). Pressed **Enter** on the filename prompt, and answered **No** to preserving the x86 BIOS and EFI BIOS images. Confirmed with **Yes** to execute the erase.
    3. **Reset:** Selected **Option 99** to reset the port and quit the utility. Verified Option ROMs were wiped using `sudo sas2flash -list` (showing `BIOS Version: N/A` and `UEFI BSD Version: N/A`).

### Issue 36: matrix iSCSI Boot Race Condition during Cold Boot
* **Symptoms:** matrix (Mini-PC) boots significantly faster than skynet (ATX server backend) during a cold start, causing `open-iscsi` to exhaust its initial login retries too early, leading to ZFS/MergerFS mount failures.
* **Diagnosis:** The default timeout of `open-iscsi` was too short to wait for the storage server backend to finish its POST and start the iSCSI portal.
* **Fix Applied:** Increased the retry count in `/etc/iscsi/iscsid.conf` to extend the connection retry window during boot.
* **Implementation:**
    1. Edited `/etc/iscsi/iscsid.conf` on matrix.
    2. Increased `node.session.initial_login_retry_max` to `120` (extending the retry window to ~10 minutes).
    3. Restarted `iscsid` and verified the retry loop behavior during a cold boot test.

### Issue 37: skynet 10G SFP+ Interface and Storage Network Binding
* **Symptoms:** Storage replication and replication tasks between matrix and skynet suffered from performance drops and latency due to binding to the wrong physical port.
* **Diagnosis:** The IPv6 static storage configuration (`fddd::/64` direct link) was bound to `nic1` on skynet instead of `nic2`, which is the physical 10G SFP+ port.
* **Fix Applied:** Adjusted the network configuration of skynet to bind the `fddd::2/64` address to the correct physical adapter interface (`nic2`).
* **Implementation:**
    1. Modified `/etc/network/interfaces` on skynet.
    2. Swapped the static IPv6 configurations between `nic1` and `nic2` to align with physical wiring.
    3. Reloaded networking using `systemctl restart networking` and verified direct 10G link bandwidth using `iperf3`.

### Issue 38: Jellyfin Media Player (Windows) Direct Play Buffering and Latency Starvation
* **Symptoms:** High-bitrate 4K Direct Play micro-stutters and buffering in Jellyfin Media Player (Windows) on the control node.
* **Diagnosis:** Latency starvation caused by MergerFS `dropcacheonclose=true` combined with `mpv`'s default tiny HTTP chunk requests.
* **Fix Applied:** Configured aggressive local caching parameters inside the client's `mpv.conf` to buffer media files ahead of time.
* **Implementation:**
    1. Created `%LOCALAPPDATA%\JellyfinMediaPlayer\mpv.conf` on the Windows laptop.
    2. Added the following caching parameters to force a 1GB RAM buffer:
       ```ini
       cache=yes
       demuxer-max-bytes=1000MiB
       demuxer-readahead-secs=120
       ```

### Issue 39: Proxmox Memory Units CLI & UI Input Workarounds
* **Symptoms:** CLI friction due to Proxmox displaying and requiring memory inputs in MiB instead of GB.
* **Diagnosis:** PVE does not natively support changing the memory display/input unit due to ExtJS UI and QEMU/kernel alignment requirements.
* **Fix Applied:** Created a shell helper alias for CLI computations and a JavaScript bookmarklet for GUI input conversion.
* **Implementation:**
    1. **CLI Alias:** Added `alias mib='function _mib() { echo $(($1 * 1024)); }; _mib'` to shell profile.
    2. **GUI Bookmarklet:** Created a bookmarklet that automatically reads the active memory input field, converts the GB value to MiB, and updates the ExtJS state dynamically.

### Issue 40: NFS I/O Failures and Large File Transfer Crashes
* **Symptoms:** Large file transfers (e.g. 80GB Remuxes) crashed or stalled over the NFS network mount.
* **Diagnosis:** Network timeouts and packet loss under load caused the NFS mount to lock up due to standard soft mount timeouts.
* **Fix Applied:** Transitioned matrix's NFS mount parameters to use hard mounts with customized timeouts.
* **Implementation:**
    1. Edited `/etc/fstab` on matrix.
    2. Updated mount parameters to: `hard,timeo=600,retrans=5`.

### Issue 41: Purifying Unprivileged Proxmox Containers (Permission Restoration)
* **Symptoms:** Unprivileged containers (e.g. NZBGet) suffered from write failures and permission errors after removing custom `lxc.idmap` shifting.
* **Diagnosis:** Existing files inside the container's rootfs were owned by the shifting UID `1000` instead of the base `100000` container namespace.
* **Fix Applied:** Shifted container internal files back to the base namespace mapping from the host.
* **Implementation:**
    1. Obtained the container's PID from the host.
    2. Ran: `find /proc/<PID>/root/ -xdev \( -uid 1000 -o -gid 1000 \) -exec chown -h 101000:101000 {} +` from the Proxmox host.

### Issue 42: Terminal Keyboard Shortcuts and Escape Sequences Inconsistencies (CSI u Standard)
* **Symptoms:** Mapped shortcut keys like `Ctrl+Backspace`, `Ctrl+Delete`, `Alt+Backspace`, and `Alt+Delete` behaved inconsistently. In container environments entered via `pct enter`, `Shift+PageUp/Down` printed raw `2~` sequences.
* **Diagnosis:** Terminal emulators and shells had mismatching key translations. Specifically, `pct enter` overrides `TERM` to `linux`, forcing an obsolete console driver.
* **Fix Applied:** Deployed the **CSI u** terminal protocol standard and shifted container access from `pct enter` to native `lxc-attach` to preserve terminal capabilities (`TERM=xterm-256color`).
* **Implementation:**
    1. **Configuration:** Created a unified, clean `/etc/inputrc` template incorporating standard key bindings and CSI u sequences.
    2. **Distribution:** Overwrote `/etc/inputrc` on `matrix`, `skynet`, and all running LXC containers, creating backup `.orig` files.
    3. **Container Access:** Deployed `alias enter='sudo lxc-attach -n'` to root and standard users (`AI`, `tuco`) on `matrix` host to preserve the terminal environment.
    4. **Zsh Support:** Aligned the universal Zsh template in `04_Terminal_Environment_Setup.md` with matrix actuals (adding the `temps` alias, removing deprecated IP aliases) and deployed the updated `.zshrc` containing CSI u Zsh keybindings to root and `tuco` on both `matrix` and `skynet`.
    5. **Documentation:** Documented full technical architecture in [08_CSIu_Terminal_Standardization.md](file:///root/portfolio/3_Engineering_and_Troubleshooting/08_CSIu_Terminal_Standardization.md).

### Issue 43: Zsh Keypad Application Mode Scroll Lock & Clear Keybinding Optimization
*   **Symptoms:** `Shift+PageUp/Down` scrollback buffer navigation printed raw `;2~` sequences in Zsh instead of scrolling. The `clear` screen keybinding (`Alt+x`) was ergonomically suboptimal.
*   **Diagnosis:** Zsh's keypad application mode hooks (`smkx` / `rmkx`) intercept navigation keys and forward them to ZLE instead of allowing the local terminal emulator to scroll.
*   **Fix Applied:** Disabled Zsh keypad application mode by removing `smkx` / `rmkx` hooks and switching to static keyboard mappings (`Home`/`End`/`Delete`). Updated the `clear` screen keybinding from `Alt+x` to `Alt+<` and deployed it across hosts (Zsh) and containers (Bash).
*   **Implementation:**
    1. **Template Setup:** Modified the universal Zsh template in [04_Terminal_Environment_Setup.md](file:///root/portfolio/3_Engineering_and_Troubleshooting/04_Terminal_Environment_Setup.md) to bind `Home` -> `^[[H`, `End` -> `^[[F`, `Delete` -> `^[[3~`, and `clear` -> `^[<`.
    2. **Host Distribution:** Deployed the new `.zshrc` to `root` and `tuco` on `matrix` and `skynet` hosts.
    3. **Container Distribution:** Created and executed a deployment script that pulled the `.bashrc` files from all active LXC containers, replaced `bind '"\ex":"clear\n"'` with `bind '"\e<":"clear\n"'` using a Python string-matching helper, and pushed the updated files back.
    4. **Debian Template:** Attempted to modify the stopped base template `CT 100`, but its disk filesystem (`pve-base--100--disk--0`) is configured as a read-only Proxmox template base volume and is immutable.
    5. **Documentation:** Appended notes in [08_CSIu_Terminal_Standardization.md](file:///root/portfolio/3_Engineering_and_Troubleshooting/08_CSIu_Terminal_Standardization.md).

## Date: 15 July 2026

### Issue 44: IPv6 NDP Discovery Failure and Internet Cut with Proxmox Firewall
* **Symptoms:** 
  1. IPv6 ping from the Pi 4 (Wi-Fi) to Matrix containers/VMs (e.g. `AI-1111`) returned `Destination unreachable: Address unreachable`.
  2. Activating multicast snooping on `vmbr0` completely cut off IPv6 internet access and local routing for all containers.
* **Diagnosis:** 
  1. The Proxmox firewall (`firewall=1` on the vNIC) inserts intermediate virtual bridges (`fwbr*`) between the containers and `vmbr0`. By default, these bridges have `multicast_snooping=1` but no querier. Because the default Proxmox firewall ruleset blocks outgoing MLD reports and incoming MLD queries (due to dropping all multicast `ff00::/8` and lack of explicit rules for MLD), the bridges could not populate their multicast database (MDB) tables. This broke NDP (MAC resolution) for all firewalled containers, resulting in `Address unreachable`.
  2. The Freebox Pop (ISP router) does not act as an MLD querier and does not respond to MLD queries. Therefore, `vmbr0` (with snooping=1 and querier=1) never registered the physical gateway port `nic0` as a multicast router, dropping all outgoing NDP solicitations destined for the gateway.
* **Fix Applied:** 
  1. Added explicit `icmpv6` firewall rules to allow infrastructure local multicast and link-local discovery (MLD/NDP) through the Proxmox firewall, making snooping work natively without workarounds.
  2. Forced `mcast_router 2` (always forward multicast) on the physical bridge port `nic0` of both Matrix and Skynet.
  3. Configured `multicast_querier 1` (MLD querier) on the `vmbr0` bridge of both nodes for redundancy.
* **Implementation:**
  1. **Firewall Rules (GUI):** Created the following rules in the container firewall settings (or `ipv6-infra` group):
     * `IN ACCEPT` - Protocol: `icmp6` - Source: `fe80::/10` *(Allows host NDP/MLD Queries)*
     * `IN ACCEPT` - Protocol: `icmp6` - Source: `lan6` *(Allows local clients ping)*
     * `OUT ACCEPT` - Protocol: `icmp6` *(Allows outgoing MLD Reports/NDP)*
  2. **Matrix Networking:** Appended the following lines to `iface vmbr0 inet6 manual` in `/etc/network/interfaces`:
     ```text
             post-up ip link set dev nic0 type bridge_slave mcast_router 2
             post-up echo 1 > /sys/class/net/vmbr0/bridge/multicast_querier
     ```
     Applied immediately: `sudo ip link set dev nic0 type bridge_slave mcast_router 2 && echo 1 | sudo tee /sys/class/net/vmbr0/bridge/multicast_querier && echo 1 | sudo tee /sys/class/net/vmbr0/bridge/multicast_snooping`.
  3. **Skynet Networking:** Applied identical commands and persistent lines to `/etc/network/interfaces` on Skynet.

### Issue 45: Traefik Zombie Connections & Lack of Active Backend Health Checks
* **Symptoms:** After resolving the IPv6 NDP discovery block (Issue 44), Traefik (LXC 112) and Authelia (LXC 113) still returned `502/504 Bad Gateway` or `no available server` errors when trying to reach backends like Radarr or Seerr. Even after the firewall rules were corrected, Traefik required a manual restart to reconnect to the services.
* **Diagnosis:**
  1. **Zombie TCP Keep-Alives:** When the Proxmox firewall silently dropped NDP packets, Traefik's persistent TCP connections were broken without a `FIN` or `RST` signal. Traefik waited on dead sockets until the Linux kernel's default 15-minute TCP timeout expired.
  2. **Passive Routing:** Traefik was configured with default transport parameters. It did not actively ping its backends, so it could not autonomously detect when a backend became unreachable or when it recovered.
* **Fix Applied:**
  1. **Aggressive Transport Timeouts:** Configured a global `serversTransport` in `traefik.yaml` (`dialTimeout: 2s`, `idleConnTimeout: 30s`) so Traefik immediately destroys zombie connections upon silent network drops.
  2. **Active Dynamic HealthChecks:** Injected `healthCheck` blocks into all dynamic routing configurations (`conf.d/*.yaml`) with application-specific ping endpoints (e.g., `/api/health` for Authelia, `/ping` for Radarr/Sonarr, `/health` for Jellyfin, `/` for Seerr).
* **Implementation:**
  1. **Global Timeout Config:** Appended `serversTransport` to `/etc/traefik/traefik.yaml` on LXC 112 and restarted the `traefik` service to apply the static configuration.
  2. **Dynamic HealthCheck Injection:** Ran a Python script on the hypervisor to parse and append the `healthCheck` block into the `loadBalancer` section of every service's YAML file. Traefik's file watcher reloaded these dynamic rules instantly without downtime, making the proxy auto-healing.
