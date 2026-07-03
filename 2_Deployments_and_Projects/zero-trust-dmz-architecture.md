# The Hybrid DMZ Architecture Plan

## 1. Background & Motivation
The Proxmox hypervisor firewall contains a hardcoded safety mechanism that forcefully allows the local `192.168.1.x` LAN to access management ports, rendering standard firewall GUI rules ineffective for isolating the host. Furthermore, forcing all IPv6 traffic through a central NAT gateway creates unnecessary overhead and breaks the fundamental end-to-end routing design of IPv6. 

This "Hybrid DMZ" architecture solves both problems. It leverages pure, un-NATted IPv6 Global Unicast Addresses (GUAs) for high-performance container internet access, while maintaining a strict, isolated IPv4 black hole (`10.10.10.x`) to securely hide the Proxmox host and provide legacy IPv4 internet access via a central gateway.

## 2. Architectural Blueprint

### The Subnets
*   **The Black Hole (`vmbr0`):** An isolated virtual bridge (MTU 9000). Uses `10.10.10.0/24` (IPv4) and `fdfd::/64` (IPv6 ULA).
*   **The Public Highway (`vmbr1`):** The physical connection to the Freebox. Uses `192.168.1.0/24` (IPv4) and `2001:db8:.../64` (IPv6 GUA).

### The Node Configurations
1.  **Matrix (Proxmox Host): Maximum Isolation**
    *   `vmbr1`: NO IP ADDRESSES. Physically connected to the Freebox but logically invisible.
    *   `vmbr0`: `10.10.10.1/24` and `fdfd::1/64`. 
    *   *Security:* Completely unreachable from the LAN. Must be accessed via VPN or Edge Proxy.
2.  **Skynet (Backup Server): Dual-Homed**
    *   `eth0` (to `vmbr0`): `10.10.10.50/24` and `fdfd::50/64`.
    *   `eth1` (to `vmbr1`): IPv6 SLAAC (GUA) only.
    *   *Security:* Secured by strict `ufw` rules dropping all unsolicited internet traffic.
3.  **Gateway Container (CT 254): The Dual-Stack Translator**
    *   `eth0` (to `vmbr0`): `10.10.10.254/24` and `fdfd::254/64`.
    *   `eth1` (to `vmbr1`): `192.168.1.254/24` (Static) and IPv6 SLAAC.
    *   *Security:* Runs `nftables` to `snat` outbound `10.10.10.x` IPv4 traffic, and `masquerade` outbound `fdfd::/64` IPv6 ULA traffic so Matrix retains internet access. Set to Boot Priority 1.
4.  **Standard Containers (Media, DBs, Apps): Dual-Homed**
    *   `eth0` (to `vmbr0`): `10.10.10.x/24` and `fdfd::x/64` (Default IPv4 Gateway: `10.10.10.254`).
    *   `eth1` (to `vmbr1`): IPv4 Disabled. IPv6 SLAAC (GUA).
    *   *Security:* Proxmox CT Firewalls **ON**.

## 3. Implementation Steps

### Phase 1: The Gateway Engine
1.  Verify the Gateway CT (254) has `eth0` on `vmbr0` (`10.10.10.254`) and `eth1` on `vmbr1` (`192.168.1.254`).
2.  Install `nftables` and configure the routing script to `snat` IPv4 traffic from `10.10.10.0/24` and `masquerade` IPv6 traffic from `fdfd::/64` out through `eth1`.
3.  Set Gateway CT to Proxmox Boot Order 1.

### Phase 2: Skynet Security
1.  Configure `ufw` on Skynet to explicitly allow management/backup ports (22, 8007) ONLY from trusted IPs (Laptop, Matrix, VPN subnet). Set default incoming policy to `DENY`.
2.  Move Skynet's IPv4 address from `vmbr1` to `vmbr0` (`10.10.10.50`).

### Phase 3: Container Micro-Segmentation
1.  For each container, configure `eth0` on `vmbr0` with a static `10.10.10.x` address (Gateway: `10.10.10.254`).
2.  Configure `eth1` on `vmbr1` to use IPv6 SLAAC, and completely clear its IPv4 settings.
3.  Activate the Proxmox Firewall for each container to drop incoming internet traffic.

### Phase 4: The Matrix Lockdown (Point of No Return)
1.  Connect to Matrix via the WireGuard VPN (which routes through the Gateway CT into the `10.10.10.x` network).
2.  In the Proxmox Network GUI, assign `10.10.10.1` and `fdfd::1` to `vmbr0`.
3.  Completely delete the `192.168.1.99` address from `vmbr1`.
4.  Apply Configuration. Matrix will vanish from the Wi-Fi network and exist securely in the DMZ.

## 4. Project Conclusion & Abandonment
This architectural plan was ultimately abandoned in favor of a simpler "Host-Hardened" architecture. 

**Reasoning:**
While mathematically secure, isolating the hypervisor into a black hole routing DMZ introduced massive single points of failure (e.g., if the Gateway CT crashed, the hypervisor became permanently inaccessible from the LAN, requiring physical console intervention). Furthermore, attempting to bypass the hardcoded Proxmox firewall "Allow LAN" rules via complex network routing negated the primary benefit of a homelab: operational simplicity.

**Final Adopted Architecture:**
*   All containers and hosts returned to the native Freebox LAN (`192.168.1.x`).
*   Containers are secured individually by enabling the built-in Proxmox CT Firewalls (Default DROP).
*   The `Matrix` host is secured at the application level using strict Access Control Lists in `/etc/default/pveproxy` and `AllowUsers` in `/etc/ssh/sshd_config`, mathematically dropping the LAN traffic that the hypervisor firewall stubbornly allows.