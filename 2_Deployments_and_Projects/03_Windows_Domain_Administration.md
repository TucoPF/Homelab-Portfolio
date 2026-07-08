# 🏆 Windows Administration Project - skynet Homelab (COMPLETED & DECOMMISSIONED)

> [!NOTE]
> **Status: Course Project Completed & Decommissioned**
> The complete 23-step Windows Active Directory lab curriculum has been successfully completed, and the active VMs (Windows Server 2025 - VM 220 and Tiny11 Client - VM 221) have been deleted/decommissioned from Proxmox to reclaim server resources. Only standard stopped Linux templates remain. This file serves as a complete operational archive.

## Environment Details (skynet Node)
- **Host:** skynet (192.168.1.200)
- **Network Architecture:**
  - `vmbr0` (Home Network): `192.168.1.0/24` (Internet access, RDP Jumpbox)
  - `vmbr2` (Private Lab Network): `10.10.10.0/24` (Isolated for VMs)
- **Domain Controller 1 (DC1):** `WinServer2025` (VM 201) - `192.168.1.201` (WAN) / `10.10.10.1` (LAN)
- **Domain Controller 2 (DC2):** `winserver2025v2` - `192.168.1.207` (WAN) / `10.10.10.3` (LAN)
- **Client:** `WinEnterprise` (VM 202) - `10.10.10.2` (DHCP Reserved)

## Completed Tasks
- [x] **Network Isolation & DHCP:**
  - Segregated the lab environment into a private network (`vmbr2` / `10.10.10.0/24`).
  - Configured DHCP Server on DC1 with a reservation for the Win11 VM (ensuring correct MAC formatting without colons/dashes).
- [x] **Routing & NAT (RRAS):**
  - Installed and configured Routing and Remote Access (RRAS) on DC1 to act as a NAT router, providing internet access to the isolated `10.10.10.x` network.
- [x] **High Availability (AD/DNS/DHCP):**
  - Deployed a second Domain Controller (`winserver2025v2` / DC2).
  - Configured AD/DNS replication across the private lab network (pointing DC2's DNS to DC1's private IP).
  - Authorized DHCP on DC2 and configured **DHCP Failover (Load Balance mode)** between DC1 and DC2 for the `10.10.10.0` scope.
- [x] **Proxmox Hardware & Headless Optimization:**
  - CPU cores adjusted to **4** (even number for better Windows scheduling).
  - **I/O Thread** enabled on the SCSI controller for better disk responsiveness.
  - Removed display device (**vga: none**) for Win11 VM to save resources (RAM/CPU), relying entirely on RDP.
- [x] **DNS Administration & Filtering:**
  - Configured a **Static Authoritative Zone** for `google.com` to test granular domain access without using global forwarders.
  - Verified the requirement for `www` host records in authoritative zones to ensure full client resolution.
- [x] **RDP Centralized Management (GPO):**
  - Created GPO to add `Domain Users` to the local `Remote Desktop Users` group.
  - Verified RDP access for user `stud` via Remmina (Arch Laptop).
- [x] **Admin Rights Delegation (GPO):**
  - Used "Restricted Groups" / "Local Users and Groups" GPO to force `Domain Admins` into the local `Administrators` group on the Win11 VM.
- [x] **Network Connectivity (Ping/ICMP):**
  - Successfully configured GPO `GPO_Workstation_Standard` to allow ICMPv4 (Ping) across all profiles (Domain, Private, Public).
  - Verified WinServer2025 can ping WinEnterprise (192.168.1.202).
- [x] **RDP Connectivity Fixed:** Resolved keyboard input issues by restarting the Remmina session.
- [x] **Remote Shadowing Prep:** Configured GPO for "Remote Control" (Shadowing) without user consent.

## Issues & Pending Tasks
- [ ] **DNS Limitations:** The static zone method for `google.com` works for the main domain but "breaks" sub-resources (images/CSS) hosted on other Google domains (e.g., `gstatic.com`). Consider switching to **Conditional Forwarders**.
- [ ] **Remote Shadowing "Access Denied":** Command `mstsc /shadow` from server is still refused. Likely requires `LocalAccountTokenFilterPolicy` registry tweak or a full reboot to refresh security tokens.

## Next Steps
1. Transition from Static DNS Zones to **Conditional Forwarders** to allow full functionality for specific sites like Google.
2. Troubleshoot the "Access Denied" for Shadowing (verify UAC remote restrictions and Registry `LocalAccountTokenFilterPolicy`).
3. Begin setting up **Network Shares** on the Windows Server and mapping them via GPO (Drive Maps) for the `stud` user.

---

# Phase 2: Complete AD Infrastructure Setup (March 23, 2026)

## Current Status
Starting a fresh AD infrastructure deployment for the final course project. All previous VMs (201, 202, 207) have been deleted to make room for a cleaner, final architecture.

## New Environment Details
- **Primary Domain Controller (DC1):** `WinServer` (VM 220) - `192.168.1.220`
- **Client 1:** `TinyEnt11` (VM 221) - IP: TBD (Tiny Windows 11 Enterprise)
- **Primary Domain:** `dom.tuco.com`

## Tasks
- [ ] **DC1 Initialization (VM 220):**
  - [ ] Configure Static IP.
  - [ ] Promote to Domain Controller.
- [ ] **TinyEnt11 Deployment (VM 221):**
  - [ ] Install Tiny Win11 Enterprise.
  - [ ] Join to domain `dom.tuco.com`.

---

# Phase 3: Final Course Project Implementation (March 24, 2026)

## Progress Tracker (23-Step Curriculum)
- [x] **Step 1:** Création d'une machine virtuelle Windows Server
- [x] **Step 2:** Création d'un réseau (vmbr2 / 10.10.10.0/24)
- [x] **Step 3:** Configuration et installation de Windows Server
- [x] **Step 4:** Configuration du serveur local (Name, RDP, Static IP)
- [x] **Step 5:** Installation du rôle ADDS
- [x] **Step 6:** Installation de l'Active Directory
- [x] **Step 7:** Configuration de l'Active Directory (Current: `tuco.lan`)
- [x] **Step 8:** Configuration du DNS
- [x] **Step 9:** Installation du rôle DHCP
- [x] **Step 10:** Configuration du DHCP (Scope 10.10.10.2 - 10.10.10.202)
- [x] **Step 11:** Modification des propriétés de la carte réseau
- [x] **Step 12:** Création de dossiers d'ordinateurs et d'utilisateurs (OUs)
- [x] **Step 13:** Création de groupes d'employés
- [x] **Step 14:** Paramétrage des droits et permissions par groupe
- [x] **Step 15:** Création de pools de stockage puis de volumes (`F:` Drive initialized)
- [x] **Step 16:** Installation des stratégies de groupe (GPO)
- [x] **Step 17:** Configuration des stratégies de groupe (GPO)
- [x] **Step 18:** Dépannage des stratégies de groupe (GPO)
- [x] **Step 19:** Sauvegarde et restauration d'un annuaire Active Directory
- [x] **Step 20:** Suppression du serveur DHCP et connexion en accès par pont
- [x] **Step 21:** Installation d'un serveur d'impression
- [x] **Step 22:** Gestion d'un serveur d'impression
- [x] **Step 23:** Déploiement des imprimantes

## Troubleshooting Log

### March 24, 2026
- **Current Server State:** Verified AD DS, DNS, and DHCP are operational on `WinServer` (VM 220).
- **Client Configuration:**
    - `Client-Template` (VM 221) set to Static IP `10.10.10.203` (outside DHCP scope).
    - `Client-1` successfully joined `tuco.lan` domain.
    - `Client-1` received DHCP IP `10.10.10.3`.
    - Verified DNS resolution via `nslookup`.
    - Successful login for domain user `Jack Black`.
- **Pending:** No internet access on clients yet. 
- **Next Task:** Configure RRAS (NAT) on `WinServer` to route traffic from `vmbr2` (10.10.10.0/24) to `vmbr0` (Internet).
- **Print Management:** Started installation of the Print Server role on `WinServer`.

### Troubleshooting Log - March 24, 2026 (Continued)
- **Issue: WinServer not visible in Network Discovery on Client-1.**
    - *Symptoms:* JackBlack (Client-1) enabled discovery but cannot see `WinServer`.
    - *Troubleshooting Steps:*
        1. Check Network Profile (must be Domain/Private).
        2. Verify "Function Discovery Resource Publication" service is running on WinServer. (Crucial for visibility)
        3. Ensure "Network Discovery" firewall rules (SSDP, WSD, UPnP) are allowed on WinServer for the Domain profile.
        4. Test direct access via UNC path `\\WinServer`.
    - *Update:* Direct UNC access via `\\10.10.10.1` works. Issue confirmed as a discovery/broadcast limitation.


