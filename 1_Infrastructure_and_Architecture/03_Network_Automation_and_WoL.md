# Network Automation: Multi-Node Wake-on-LAN (WoL)

## Objective
To enable remote power management for the homelab nodes, allowing servers to be powered off when not in use and woken up remotely by other nodes (e.g., Pi4 waking up matrix or skynet) via "Magic Packets".

## Architecture
- **Sender:** Any node with the `wakeonlan` package installed (matrix, skynet, Pi4).
- **Receivers:** matrix and skynet (configured to listen for WoL signals).
- **Communication:** Standard UDP Magic Packets sent to the broadcast address of the local network.

## Implementation Details

### 1. OS-Level Configuration (Ethtool)
The network interfaces must be explicitly told to remain powered in a "listening" state after shutdown. We use `ethtool` to set the `wol g` (Magic Packet) flag.

- **matrix Target Interface:** `nic0`
- **skynet Target Interface:** `nic0`

### 2. Persistence via Proxmox Networking
To ensure WoL survives reboots, the configuration is injected into the `/etc/network/interfaces` file using a `post-up` directive. This ensures that every time the physical interface is brought up, the WoL capability is re-enabled.

**Example Configuration (`/etc/network/interfaces`):**
```text
iface nic0 inet manual
    post-up /usr/sbin/ethtool -s nic0 wol g
```

### 3. Automation via Terminal Aliases
User-friendly aliases are added to the universal `.zshrc` template to simplify the wake-up process:

```zsh
alias wake-skynet='wakeonlan 34:5a:60:ba:86:5b'
alias wake-matrix='wakeonlan 58:47:ca:7a:84:cc'
```

## Hardware Prerequisites
- **BIOS/UEFI:** "Wake-on-LAN" or "Power On By PCI-E" must be enabled in the firmware settings of the Minisforum (matrix) and the MSI MAG X870E TOMAHAWK WIFI (skynet).
- **Physical Connectivity:** WoL only works over a wired Ethernet connection.

## Limitations
- **Pi4:** The Raspberry Pi 4 hardware does not support being woken up via WoL. It can only act as a sender.
