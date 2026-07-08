# IPv6 Zero-Trust VPN & Remote Access Architecture

## Architecture Overview
This document details the remote access architecture implemented for the homelab, designed to bypass restrictive ISP firewalls (Freebox Pop) while maintaining a strict zero-trust security posture.

The solution relies on **IPv6 Prefix Delegation**, **WireGuard**, and **automated DDNS** to establish a stealthy, persistent management overlay network.

### Key Components
1.  **ISP Router (Freebox Pop):** 
    *   IPv6 Firewall is enabled for the Primary Prefix (`::0/64`) to protect local devices.
    *   IPv6 Firewall is **disabled** for Secondary Prefixes (e.g., `::1/64`).
    *   **Next Hop Delegation:** The Secondary Prefix is delegated to the Link-Local Address (LLA) of the WireGuard LXC container.

2.  **Edge Gateway (CT 111 - WireGuard LXC on matrix):**
    *   Runs on an unprivileged Proxmox LXC container.
    *   **Public Interface (eth0):** Holds a static IPv6 Global Unicast Address (GUA) from the Secondary Prefix (e.g., `...:29e1::111`) to bypass the ISP firewall.
    *   **Internal Gateway (eth0):** Holds a static Unique Local Address (ULA) (`fddf::111/64`) acting as the gateway for internal routing.
    *   **VPN Tunnel (wg0):** WireGuard interface providing point-to-point connections (`fdfd::a/128`).
    *   **Security:** Proxmox firewall drops all traffic to the container except **UDP Port 11111** (WireGuard Handshake). TCP 22 (SSH) is strictly limited to traffic originating from within the VPN tunnel (`fdfd::/64`).

3.  **Internal Servers (matrix & skynet):**
    *   Assigned static ULAs (`fddf::1/64` and `fddf::2/64`).
    *   Configured with static routes pointing VPN traffic (`fdfd::/64`) back to the CT 111 Gateway (`fddf::111`).
    *   Protected by Proxmox Node firewalls, allowing access only from the trusted `admin` IPSET (which includes the specific VPN client IPs).

4.  **Client (Laptop):**
    *   Connects to the VPN via the Cloudflare-managed DDNS domain.
    *   Routes traffic for both the tunnel (`fdfd::/64`) and the internal LAN (`fddf::/64`) through the WireGuard interface.

## Automation & Persistence
To ensure the architecture survives reboots and ISP prefix changes without manual intervention:

*   **Network Interfaces:** Physical hosts use `inet6 manual` to allow kernel SLAAC for public outbound traffic while persisting static ULA assignments and routes.
*   **Container IP Persistence:** A systemd service (`secondary-ipv6.service`) runs on boot in CT 111 to re-apply the Secondary GUA and Internal ULA, followed by a post-start ping to the Freebox LLA to refresh the router's hardware neighbor cache.
*   **DDNS Auto-Healing (`2update-vpn-dns.sh`):** A script runs hourly via a systemd timer on CT 111. It calculates the correct Secondary Prefix dynamically by performing hex math on its primary SLAAC address (adding 1 to the 4th block), applies the IP to `eth0`, and updates the `vpn.example-homelab.com` AAAA record via the Cloudflare API.

---

## 🌐 Implemented Reverse Proxy & Routing (Traefik-112)

The public service routing layer is fully operational and integrated with our zero-trust architecture.

### 🛡️ Traefik Edge Proxy (LXC 112)
*   **Deployment:** Runs on a dedicated, lightweight unprivileged container (`Traefik-112`, IP `192.168.1.112`).
*   **SSL Termination:** Automates the retrieval and renewal of Let's Encrypt wildcard certificates (`*.example-homelab.com`) using Cloudflare DNS-01 API challenges. This completely avoids exposing any open HTTP validation ports to the public internet.
*   **Dynamic IPv6 Routing:** Handles SNI termination and dynamically proxies incoming public traffic down to inner node ULAs in the `fddf::/64` space.
    *   *Example:* Requests to `jellyfin.example-homelab.com` hit Traefik on port 443 and are securely routed to `http://[fddf::101]:8096` over the internal network.
    *   *Example:* Requests to request/media stacks route seamlessly to their corresponding Docker endpoints.

---

## 🔒 Implemented Security Hardening
We have successfully hardened our public-facing Traefik edge proxy (LXC 112) against brute-force attacks, information disclosure, and protocol vulnerabilities.

### 1. HTTP Security Headers (`headers.yaml`)
To prevent common web application vulnerabilities at the client browser level, we injected premium HTTP headers:
*   **HSTS Enforced**: Strict-Transport-Security (`max-age=31536000; includeSubDomains; preload`) forces all client browsers to communicate only over HTTPS for 1 year.
*   **Clickjacking Protection**: `X-Frame-Options` bound to `SAMEORIGIN` to prevent clickjacking overlays.
*   **MIME Sniffing Blocked**: `X-Content-Type-Options` locked to `nosniff`.
*   **XSS Mitigation**: `X-XSS-Protection` active (`1; mode=block`).
*   **Referrer Policy**: Restricted to `same-origin`.
*   **Info Disclosure Stripped**: Suppressed system identification headers (`Server`, `X-Powered-By`).

### 2. Multi-Tiered Rate Limiting (`rate-limit.yaml`)
To protect publicly exposed routes from scanning or automated brute-force attacks, we deployed two separate rate-limiting tiers:
*   **Standard Tier (`rate-limit`)**: Enforces **150 average / 75 burst** requests per second. Applied to lightweight services (Radarr, Sonarr, Seerr, Traefik Dashboard).
*   **Heavy Media Tier (`jellyfin-rate-limit`)**: Specifically tuned to **600 average / 300 burst** requests per second. This accommodates the massive asynchronous poster-image loading demands of Jellyfin without dropping packets.

### 3. Hardened TLS Options (`tls.yaml`)
Enforces secure cipher configurations at the handshake layer:
*   **Minimum Protocol version**: Forced to **TLS 1.2** (TLS 1.0 and 1.1 handshakes are immediately dropped).
*   **High-Grade Ciphers**: Restricts TLS 1.2 to secure ECDHE ciphers (e.g. `ECDHE-ECDSA-AES-128-GCM-SHA256`) and supports native TLS 1.3 curve preferences.
*   **SNI Strictness**: Enabled `sniStrict: true` to prevent generic IP handshake scans.

### 4. Identity Provider & Forward Auth Integration
Enforces Single Sign-On (SSO) at the proxy level:
*   All internal management interfaces (Traefik Dashboard, Sonarr, Radarr, Prowlarr, Bazarr, NZB) and media frontends (Jellyfin) are chained behind the Authelia ForwardAuth middleware (`authelia-auth@file`) on Traefik.
*   Seerr remains open to allow native local and Jellyfin OIDC authentication, fully protected by the standard Rate Limiting and Secure Headers layers.
*   **Passkey-Only Admins**: The admin account has been hardened by rotating its database password to a forgotten 128-character random string, forcing authentication exclusively via registered WebAuthn Passkeys.

### 5. Intrusion Prevention & Hypervisor Firewall Integration (Decoupled CrowdSec LAPI & PVE Bouncer)
Integrates deep Layer 7 threat defense and hypervisor-level packet filtering:
*   **Decoupled Control Plane**: CrowdSec LAPI, database, and engine are isolated inside a dedicated unprivileged security container (`LXC 114`).
*   **Host-Level Drop Bouncer**: A systemd timer (`sync-crowdsec.timer`) and service (`sync-crowdsec.service`) run every 5 minutes directly on the **matrix Host**. It executes a synchronization bash script (`/usr/local/bin/sync-crowdsec.sh`) that pulls active bans from the CrowdSec LAPI inside `LXC 114` via Proxmox's `pct exec` tool. The script populates two host-level kernel IPsets (`crowdsec-bans-v4` and `crowdsec-bans-v6`) and enforces packet drop rules in the **`raw` table `PREROUTING` chain** of the host's `iptables` / `ip6tables`. This discards all traffic from blacklisted IPs at the absolute network boundary (including physical interface `nic0`), saving hypervisor resources and protecting all local nodes and gateways globally.
*   **Lightweight Forwarder Agent**: The Traefik edge proxy (`LXC 112`) runs strictly as a decoupled log-parsing agent that forwards security alerts to the remote LAPI over the private IPv6 ULA network (`fddf::/64`).
*   **Administrative Whitelist**: Explicitly excludes internal management scopes (`192.168.1.0/24`, `fddf::/64`, `fdfd::/64`) from alerting to eliminate administrative lockout risks.

### 6. Sovereign Offline Geoblocking & Systemd Updater
Performs high-speed geo-restricting entirely offline at the ingress threshold:
*   **Geoblock Middleware**: Registered the `nscuro/traefik-plugin-geoblock` plugin, returning a `403 Forbidden` for blocked countries: US, CN, RU, Middle East (`IR`, `IQ`, `SY`, `YE`, `SA`), and North Korea (`KP`).
*   **Automated Monthly Updater**: A bash script and monthly systemd timer (`update-geoip.timer` with `Persistent=true` self-healing catchup) automatically fetch monthly database updates directly from the official IP2Location LITE CDN and reload Traefik dynamically.

---

## 🚀 Future Security Work
1.  **Host Kernel Escape Mitigation**: Enforce custom AppArmor/Seccomp profiles on the Proxmox host for `LXC 112` and `LXC 114` to block low-level system call families.
