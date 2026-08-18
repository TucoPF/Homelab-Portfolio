# Déploiement Réseau UniFi - Domaine ViaMare (Palombaggia)

## 📌 Vue d'Ensemble
Déploiement complet d'une infrastructure réseau basée sur l'écosystème **Ubiquiti UniFi** pour le **Domaine ViaMare** situé à Palombaggia. L'objectif de ce projet est de fournir une couverture Wi-Fi et réseau unifiée et performante à travers l'ensemble des bâtiments (Maison Principale, Bergeries, Chalet) répartis sur le domaine en restanque.

## 🏘️ Topologie Physique & Matérielle
* **Passerelle FAI :** LiveBox 4 / 5
* **Routeur / Contrôleur :** UniFi Cloud Gateway (UCG) Ultra
* **Switching :** UniFi Switch (USW) Ultra avec alimentation 60W
* **Points d'Accès (APs) :**
  * `AP-Maison` (Maison Principale) : Modèle à confirmer (U6-Pro / U6+ / U7-Lite)
  * `AP-Chambre` (Bergeries / Chambres) : Modèle à confirmer (U6-Pro / U6+ / U7-Lite)
  * `AP-Bungalow` (Chalet / Bungalow) : Modèle à confirmer (U6-Pro / U6+ / U7-Lite)
* **Périphériques Filaires :** 1x Smart TV connectée en RJ45 sur le USW Ultra.

## 🔌 Topologie Logique & Adressage WAN
Le routeur UCG Ultra est positionné en cascade (double NAT) derrière la LiveBox, mais le trafic est structuré pour maximiser la connectivité :
* **Liaison Physique :** Port LAN 4 (1Gbps) de la LiveBox relié au port WAN (2.5Gbps) du UCG Ultra.
* **Adressage WAN (UCG) :** `192.168.1.254` (IP Statique assignée par la LiveBox, réseau `192.168.1.1`).
* **Support IPv6 :** Délégation de préfixe active depuis la LiveBox vers le VLAN principal du UCG (`2a01:cb1c:xxxx:xxxx::/64` [Masqué]).

## ⚙️ Configuration Réseau UniFi (VLANs & SSIDs)
Le réseau interne est rigoureusement segmenté en 4 réseaux (VLANs) distincts afin de garantir l'isolation et la performance :

### 1. Default (Management) - `10.0.0.0/24`
* **Fonction :** Gestion et infrastructure matérielle UniFi.
* **Équipements avec IPs statiques/réservées :**
  * UCG Ultra : `10.0.0.1`
  * USW Ultra : `10.0.0.10`
  * AP-Bungalow : `10.0.0.20`
  * AP-Chambre : `10.0.0.30`
  * AP-Maison : `10.0.0.40`

### 2. VLAN 10 ("Lan-Maison") - `10.10.10.0/24`
* **IPv6 :** `2a01:cb1c:xxxx:xxxx::/64` (Bénéficie de la délégation de préfixe).
* **Type de Zone :** Réseau Interne (Corporate).
* **Réseaux Wi-Fi Diffusés :** `ViaMare`
* **Groupes d'APs assignés :** `AP-Maison` et `AP-Chambre`.

### 3. VLAN 20 ("Lan-Bungalow") - `20.20.20.0/24`
* **Type de Zone :** Hotspots (Isolation des hôtes).
* **Réseaux Wi-Fi Diffusés :** `ViaMare`
* **Groupes d'APs assignés :** `AP-Bungalow` uniquement.
*(Note architecturale : L'utilisation du même SSID "ViaMare" sur un groupe d'APs spécifique permet de placer de façon transparente les locataires du Bungalow dans un VLAN complètement isolé).*

### 4. VLAN 30 ("Lan-Invité") - `30.30.30.0/24`
* **Type de Zone :** Hotspots (Isolation complète des invités).
* **Réseaux Wi-Fi Diffusés :** `Invité`
* **Groupes d'APs assignés :** Tous les APs du domaine.

## 🛡️ Sécurité & Routage (Zones de Pare-Feu)
Le routage inter-VLAN et la sécurité sont gérés de manière automatisée par les "Zones" de l'UCG Ultra :
* **Zone "Interne" (VLAN 10) :** Réseau de confiance. Autorise la sortie vers Internet, le VPN, et l'accès à la passerelle (Gateway).
* **Zone "Hotspots" (VLAN 20 & VLAN 30) :** Applique un ensemble de règles de pare-feu restrictives. Bloque strictement toutes les communications initiées depuis ces clients en direction de la Gateway, des réseaux de la zone "Interne", ou des tunnels VPN. Seul l'accès sortant vers Internet est autorisé.

## 🌍 Accès Distant & Secours (Out-of-Band)
* **Accès Primaire (Intégration Homelab) :** Client VPN WireGuard configuré sur l'UCG Ultra pour initier un tunnel persistant vers le serveur `CT111` central. Cela contourne le NAT de la LiveBox et permet un accès sécurisé aux réseaux (Management `10.0.0.0/24`, Lan-Maison `10.10.10.0/24`) depuis les périphériques itinérants du Homelab.
* **Solution de Secours (Fallback) :** Le service **UniFi Teleport** est activé et rattaché au Cloud UniFi (`unifi.ui.com`). Cela garantit un accès de secours "Out-of-Band" via smartphone si le tunnel WireGuard principal venait à échouer.
