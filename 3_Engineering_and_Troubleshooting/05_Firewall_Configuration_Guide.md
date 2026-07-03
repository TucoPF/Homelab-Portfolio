# Firewall Configuration Guide (Arch Linux Laptop)

## Overview
This document tracks the setup and configuration of `firewalld` on the Arch Linux laptop. It relies on the modern `nftables` backend (while maintaining `iptables` compatibility) to manage network security zones.

## Concepts Learned
- **iptables vs. nftables:** `nftables` is the modern filtering engine in the Linux kernel. `iptables` remains installed as a compatibility layer for tools like Docker or Tailscale that expect its syntax.
- **Firewalld & Zones:** `firewalld` is a frontend manager that assigns network interfaces to "zones" (e.g., `public`, `home`, `trusted`) based on how much the network is trusted.
- **Read vs. Write Permissions:** Checking firewall status (e.g., listing rules) can be done by a regular user because Polkit allows "read" operations. Modifying rules requires `sudo` because it alters system-wide security ("write" operations).

## Current Configuration Progress

### 1. Installation and Enablement
- Installed `firewalld` via `yay`.
- Enabled and started the service: `sudo systemctl enable --now firewalld`

### 2. Tailscale Configuration (Trusted Zone)
Tailscale traffic is fully trusted to allow seamless communication with the homelab (Matrix, Skynet, Pi4, etc.).
- Assigned `tailscale0` to the `trusted` zone:
  `sudo firewall-cmd --zone=trusted --add-interface=tailscale0 --permanent`

### 3. Public Network Hardening (Public Zone)
The default zone for unknown networks (like coffee shop Wi-Fi) is `public`.
- Removed SSH access to prevent unauthorized connection attempts on untrusted networks:
  `sudo firewall-cmd --zone=public --remove-service=ssh --permanent`

### 4. Home Network Configuration (Home Zone)
The home Wi-Fi network ("Maison") is assigned to the `home` zone to allow local discovery (mDNS, Samba, etc.) while still blocking unknown traffic.
- Configured NetworkManager to assign "Maison" to the `home` zone:
  `sudo nmcli connection modify Maison connection.zone home`

## Next Steps / To Do
The configuration has been saved in NetworkManager, but the connection needs to be restarted to apply the zone change. 

**Run this command to apply the "Maison" zone change:**
```bash
sudo nmcli connection up Maison
```
After running it, verify the active zones with:
```bash
sudo firewall-cmd --get-active-zones
```