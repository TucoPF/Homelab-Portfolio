# Référentiel Compétences, Apprentissages et Cas Pratiques - Apprenti Technicien IT

## 1. Administrateur Systèmes (Virtualisation, Hyperviseurs & OS)
*   **Compétences techniques acquises :**
    *   *Hyperviseur Proxmox VE :* Administration de nœuds (PVE 9), configuration de cluster, gestion du quorum (`pvecm expected 1`), configuration de stockage centralisé (`storage.cfg`).
    *   *Virtualisation GPU & SR-IOV :* Configuration de fonctions virtuelles Intel iGPU (`i915-sriov-dkms` sous DKMS) et gestion de la survie des modules out-of-tree lors des mises à jour de kernel PVE via l'installation des en-têtes Proxmox (`proxmox-default-headers`).
    *   *Conteneurs LXC & ID Mapping :* Différence entre LXC privilégié/non-privilégié, montage de dossiers hôtes (bind mounts `mp0` avec options `noatime,backup=0`), isolation et mappage de groupes spécifiques (ex: mappage GID `44`/`993` pour l'accélération matérielle QuickSync sans casser l'isolation globale).
    *   *Active Directory & Services Windows :* Déploiement d'une infrastructure ADDS complète (`tuco.lan`), configuration de GPO (sécurisation RDP, déploiement d'imprimantes, gestion des droits des groupes locaux par Restricted Groups), administration de serveurs d'impression et de rôles de routage de transit (RRAS/NAT).
    *   *Automatisation et Scripts Systèmes :* Écriture de scripts d'orchestration pour automatiser les mises à jour non-interactives (`apt-get dist-upgrade`) des LXC et des stacks Docker internes (`docker compose pull/up --remove-orphans`) avec timer systemd hebdomadaire.
*   **Méthodes d'apprentissage :**
    *   Réalisation du cursus complet en 23 étapes d'intégration Active Directory (Windows Server 2025 / Tiny11 Enterprise) simulé en environnement isolé (`vmbr2` / `10.10.10.0/24`).
    *   Mise en place de conteneurs de services (Jellyfin, Arr-Stack, Vaultwarden decommissionné pour migration 1Password).
*   **Cas pratiques de Troubleshooting :**
    *   *Le cycle de mort systemd au boot :* Blocage de corosync et du système `/etc/pve` suite à une boucle de dépendance (`zfs-import-cache` $\rightarrow$ `open-iscsi` $\rightarrow$ `network`). Résolu en cassant l'override systemd et en durcissant `/etc/fstab` (`_netdev,nofail,x-systemd.after`).
    *   *Proxmox Guests Extinction Hangs :* Correction d'un gel de 10 minutes à l'arrêt du nœud en forçant l'arrêt des conteneurs LXC *avant* la coupure de la couche de stockage réseau MergerFS/NFS (`pve-guests` systemd override).
    *   *Saturations de disque LXC :* Purge de 12 Go de couches d'images Docker orphelines bloquant l'Arr-Stack, résolu par timer systemd de prune hebdomadaire.
    *   *Décalage de timezone global :* Réalignement temporel des conteneurs partagés via liens `/etc/localtime` vers `Europe/Paris` et injection de variables d'environnement `TZ`.

## 2. Administrateur Réseaux & Sécurité (IPv6, VPN & reverse proxy)
*   **Compétences techniques acquises :**
    *   *Routage IPv6 Dual-Stack :* Gestion d'adresses Global Unicast (GUA) déléguées par le FAI, adressage local Unique Local Addresses (ULA en `fddf::/64`) pour l'isolation locale et VPN (WireGuard en `fdfd::/64`).
    *   *Sécurité & Zero-Trust :* Routage inter-VLANs filtré par pare-feu (routeur Weidmüller isolé reliant la découpeuse laser `192.168.100.0/24` au réseau principal). VPN maillé IPv6 (tunnels WireGuard sécurisant les accès d'administration).
    *   *Proxy Inverse & Certificats SSL :* Configuration de Traefik avec challenge DNS Cloudflare (évite d'ouvrir le port 80 pour Let's Encrypt), routage dynamique vers les adresses IPv6 ULA internes, injection de headers de sécurité HTTPS (HSTS, CSP, suppression des signatures serveurs).
    *   *Sécurité Périmétrique & Filtrage :* Configuration de pare-feu applicatifs (`firewalld` avec zones différenciées sous Arch Linux), segmentation de sous-réseaux (pont isolé `vmbr2` et routage via passerelle logicielle nftables).
    *   *Détection d'Intrusion (IPS) :* Déploiement découplé de CrowdSec LAPI (`LXC 114`) avec agent de collecte sur Traefik (`LXC 112`) et bouncer au niveau de la table `raw` `PREROUTING` d'iptables sur l'hôte Proxmox (mise à jour d'IPsets par script toutes les 5 minutes).
*   **Méthodes d'apprentissage :**
    *   Routage inter-sous-réseau pour l'accès de la découpeuse laser isolée (`192.168.100.101`) vers le NAS.
    *   Configuration d'un script de mise à jour DNS dynamique DDNS IPv6 (`2update-vpn-dns.sh`) recalculant le préfixe dynamique par masque hexadécimal et l'envoyant à l'API Cloudflare.
    *   Mise en place d'un système de blocage géographique (Geoblocking) hors-ligne via intégration de bases de données IP2Location mensuelles.
*   **Cas pratiques de Troubleshooting :**
    *   *Échec de découverte de voisins IPv6 (NDP/MLD) :* blocage du trafic ping suite à l'activation du multicast snooping de la Freebox Pop. Résolu en forçant le paramètre `mcast_router 2` sur l'interface physique esclave du pont et en configurant les règles ICMPv6 requises dans le pare-feu PVE.
    *   *Race condition Traefik / CrowdSec au boot :* Traefik démarrant sans réseau/LAPI disponible coupait ses middlewares de sécurité et restait actif mais hors-service. Résolu par vérification de journal dans `ExecStartPost` pour forcer le redémarrage automatique en boucle.
    *   *Panique Kernel Wi-Fi 7 (ath12k) :* Crashes système au réveil de veille causés par des micro-sommeils PCIe (ASPM). Résolu par udev rule désactivant l'ASPM sur le chipset spécifique et script de désactivation de l'économie d'énergie radio.

## 3. Administrateur Stockage & Architectures SAN/NAS
*   **Compétences techniques acquises :**
    *   *Protocoles SAN/NAS :* Configuration de cibles block iSCSI LIO via `targetcli` sur lien direct 10G SFP+ (`fddd::/64`), mise en œuvre de ZFS (Zpool local en mirror), exports NFS v4.2 avec options `no_root_squash` pour les sauvegardes inter-nœuds.
    *   *Stockage Hiérarchisé (MergerFS) :* Agrégation de disques mécaniques SAS (skynet-pool) et de caches NVMe rapides (matrix-cache) sous un point de montage MergerFS unique (`/mnt/fusion`).
    *   *Optimisation de l'usure Flash (Trim) :* Gestion intelligente du fstrim du cache NVMe asservie à l'activité réelle du script de déplacement de fichiers (`fusion_mover.sh`) via indicateur RAM (`/dev/shm`).
*   **Méthodes d'apprentissage :**
    *   Migration de la machine physique de stockage `skynet` de PBS à PVE 9 tout en réimportant les partitions labellisées et le pool ZFS sans perte de données.
*   **Cas pratiques de Troubleshooting :**
    *   *Timing iSCSI au démarrage à froid (Cold Boot) :* matrix démarrait plus vite que le backend skynet, provoquant des échecs de montage. Résolu en augmentant `node.session.initial_login_retry_max` à `120` dans `iscsid.conf`.
    *   *Ticking mécanique & Calibration SAS Seagate Exos :* Diagnostic de cliquetis périodiques. Alignement des conditions d'énergie EPC (`Idle_A`, `Idle_B` via `sdparm`) et écriture d'un script systemd au boot (`sas-power-management.service`) pour forcer les disques dans l'état de veille souhaité afin d'éviter l'usure mécanique des moteurs de broche.
    *   *Trim SSD Redondant :* Alignement du fstrim du cache NVMe avec le script `fusion_mover.sh` via un flag RAM (`/dev/shm/fusion_mover_moved`) pour éviter l'usure prématurée des cellules flash.
    *   *NFS I/O Errors (EIO) sur gros fichiers (80Go+) :* Résolution des plantages de transferts en remplaçant l'option de montage NFS `soft` par `hard,timeo=600,retrans=5`.
    *   *Optimisation d'espace utile :* Récupération de ~550 Go d'espace disque en réduisant l'espace bloc réservé d'EXT4 de 5% à 1% sur l'ensemble des disques durs (`tune2fs -m 1`).

## 4. Analyste en Pentesting & Audit de Sécurité
*   **Compétences techniques acquises :**
    *   *Audit de Vulnérabilités externe :* Simulation de vecteurs d'attaque WAN via déploiement de VPS externe à facturation horaire (Hetzner Cloud), rédaction de déclarations d'activité AUP pour éviter les lockouts.
    *   *Outils de scan :* Utilisation de Rustscan pour la cartographie rapide des ports TCP sur IPv6, Nmap pour la détection de version/OS, et Nuclei pour le scanning de vulnérabilités applicatives basé sur des templates YAML.
    *   *Analyse des cibles TLS :* Test d'abus d'en-tête d'hôte (Host Header / SNI spoofing) pour s'assurer que le reverse proxy rejette les connexions n'entrant pas dans le scope autorisé.
*   **Méthodes d'apprentissage :**
    *   Audit de sécurité sur les points d'entrée du Homelab (`vpn.example-homelab.com` et `example-homelab.com`) depuis une instance Debian externe.
*   **Cas pratiques de Troubleshooting :**
    *   *Validation de la chaîne d'IPS (CrowdSec / PVE Firewall) :* Scan agressif lancé depuis le VPS externe $\rightarrow$ détection par l'agent Traefik $\rightarrow$ génération de décision CrowdSec $\rightarrow$ blocage instantané au niveau du pare-feu natif PVE de l'hôte $\rightarrow$ vérification de la présence de l'IP du VPS dans l'ipset noyau `crowdsec-bans`.

## 5. Support Technique, Maintenance & Outillage Matériel
*   **Compétences techniques acquises :**
    *   *Maintenance Disques :* Lecture brute des rapports de télémétrie NVMe (`smartctl` et `nvme-cli`), extraction de binaires firmware depuis des ISO propriétaires Samsung et flash direct par CLI Linux (`nvme fw-download / fw-commit`).
    *   *Intégration d'outillage réseau (WDS / PXE) :* Injection de pilotes tiers (réseau `NetKVM` et stockage `vioscsi` / `viostor` VirtIO) dans des images de boot Windows PE (`boot.wim`) pour permettre l'installation d'OS sur réseau 10G isolé. Contournement de l'obsolescence de WDS pour Windows 11 en utilisant un moteur d'installation Windows 10 PE modifiée.
    *   *Gestion de Clavier Mécanique (MCU & Couches physiques) :* Compréhension des limitations de mappage matériel (EEPROM) sous protocole WebHID, remappage de couches secondaires (Fn Layer) et implications sur la phase de boot (POST BIOS/UEFI demandant l'interception Fn physique).
*   **Méthodes d'apprentissage :**
    *   Flasheur de microprogramme de disques Samsung 990 PRO et PM9A1.
    *   Remappage de clavier mécanique Lofree Flow Lite 84 (layout 75%) avec WebHID.
*   **Cas pratiques de Troubleshooting :**
    *   *LSI HBA Option ROM POST Hang :* Gel de la phase de boot sur plateforme AM5 AMD causé par le module d'option ROM de l'HBA LSI SAS2308. Blocage de `sas2flash` par la sécurité kernel (Lockdown / Strict DevMem). Résolu en exécutant l'utilitaire interactif 64 bits statique `lsiutil` sous Linux Proxmox pour effacer l'Option ROM sans toucher au micrologiciel IT-mode actif.
