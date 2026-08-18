# Déploiement Réseau UniFi - Domaine ViaMare (Palombaggia)

## 📌 Vue d'Ensemble & Contexte
Déploiement complet d'une infrastructure réseau et Wi-Fi basée sur l'écosystème **Ubiquiti UniFi** pour le **Domaine ViaMare** situé à Palombaggia (Corse). L'objectif est de fournir une couverture réseau fiable, segmentée et performante sur un terrain en restanques comprenant plusieurs bâtis (Maison Principale, Chambre en contrebas, Minivilla de 70m², et extensions futures).

---

## 🛠️ Choix Matériel & Rationale Technique
*Pour les lecteurs novices, chaque équipement a été sélectionné pour répondre à un besoin d'ingénierie précis :*
* **UniFi Cloud Gateway Ultra (UCG-Ultra) :** Cœur de routage compact et puissant intégrant directement le contrôleur UniFi OS. Idéal pour une gestion autonome à distance avec une très faible consommation électrique.
* **UniFi Switch Ultra (USW-Ultra 60W) :** Switch manageable compact capable d'alimenter tous les points d'accès directement en **PoE** (Power over Ethernet) sans multiplier les injecteurs et blocs d'alimentation encombrants.
* **Ubiquiti U7-Lite (`AP-Maison`) :** Positionné dans la pièce de vie centrale pour pérenniser l'installation avec la prise en charge des futurs terminaux Wi-Fi 7.
* **Ubiquiti U6-Pro (`AP-Bungalow` / Minivilla) :** Équipé d'un meilleur gain d'antenne (MIMO 4x4 en 5GHz) pour assurer une couverture optimale à travers les 70m² et les murs épais de la Minivilla.
* **Ubiquiti U6+ (`AP-Chambre`) :** Point d'accès Wi-Fi 6 compact et discret, parfaitement dimensionné pour couvrir la chambre en contrebas.

---

## 🏗️ Chantier Physique & Infrastructure de Câblage

### 1. Réutilisation & Rénovation de l'Existant
* **Liaisons Longue Distance :** Exploitation de 2 câbles extérieurs préexistants (Cat6 noir) reliant le garage (cœur réseau) à la **Maison Principale** et à la **Minivilla**.
* **Modernisation des Terminaisons :** Remplacement des anciennes fiches mâles RJ45 rigides par des **embases femelles (Keystone)** à chaque extrémité. Cette approche professionnelle permet d'utiliser des cordons de brassage souples et facilement remplaçables sans risquer d'endommager les câbles de structure.
* **Capacité d'Évolution :** Avec une distance maximale estimée à ~50 mètres, ces liaisons Cat6 garantissent un débit supporté d'au moins **2.5 Gbps (voire 10 Gbps)** pour les futures évolutions.

### 2. Nouveaux Tirages & Travaux Réalisés
* **Tirage de Câbles :** Tirage de 2 nouveaux câbles Cat6+ depuis le switch du garage vers l'**AP-Chambre** et vers la **Smart TV**.
* **Cheminement & Traversées :** Passage des câbles à nu le long des parois du garage avec perçage d'un trou traversant dans chaque mur concerné pour l'acheminement intérieur.

### 3. Pose & Fixation Mécanique des APs
* **`AP-Maison` (U7-Lite) :** Fixé au plafond avec une légère inclinaison dans l'angle de la pièce centrale (Bureau / Salon).
* **`AP-Chambre` (U6+) :** Fixé sur le coffre en bois du volet roulant dans l'angle de la chambre en contrebas.
* **`AP-Bungalow` (U6-Pro) :** Fixé dans la Minivilla (70m²).
*(Note d'extension : Les Bergeries détachées et le Chalet ne sont pas équipés de réseau pour le moment et constituent une phase ultérieure du projet).*

---

## 🔌 Topologie WAN & Adressage
Le routeur UCG Ultra est positionné en cascade (double NAT) derrière la Livebox FAI :
* **Liaison WAN :** Port LAN 4 (1 Gbps) de la Livebox vers le port WAN (2.5 Gbps) du UCG Ultra.
* **Adressage WAN (UCG) :** `192.168.1.254` (IP Statique configurée sur la Livebox, réseau `192.168.1.1`).
* **Support IPv6 :** Délégation de préfixe active depuis la Livebox vers le VLAN principal du UCG (`2a01:cb1c:xxxx:xxxx::/64` [Masqué]).

---

## ⚙️ Configuration Logique (VLANs & SSIDs)
Le réseau interne est rigoureusement segmenté en 4 réseaux (VLANs) distincts :

### 1. Default (Management) - `10.0.0.0/24`
* **Rôle :** Administration de l'infrastructure matérielle.
* **Équipements avec IPs statiques / réservées :**
  * UCG Ultra : `10.0.0.1`
  * USW Ultra : `10.0.0.10`
  * AP-Bungalow : `10.0.0.20`
  * AP-Chambre : `10.0.0.30`
  * AP-Maison : `10.0.0.40`

### 2. VLAN 10 ("Lan-Maison") - `10.10.10.0/24`
* **IPv6 :** `2a01:cb1c:xxxx:xxxx::/64` (Bénéficie de la délégation de préfixe).
* **Zone :** Interne (Réseau de confiance).
* **Diffusion Wi-Fi :** SSID `ViaMare`.
* **Points d'Accès Assignés :** `AP-Maison` et `AP-Chambre`.
* **Périphérique Filaire :** Port switch dédié à la **Smart TV** taggé sur ce VLAN (permettant le Cast/AirPlay direct depuis les appareils de la maison).

### 3. VLAN 20 ("Lan-Bungalow" / "Minivilla") - `20.20.20.0/24`
* **Zone :** Hotspots (Isolation des hôtes).
* **Diffusion Wi-Fi :** SSID `ViaMare`.
* **Point d'Accès Assigné :** `AP-Bungalow` uniquement.
*(Note architecturale : L'utilisation du même SSID "ViaMare" sur ce point d'accès spécifique permet de placer de façon transparente les locataires de la Minivilla dans un VLAN complètement isolé sans perturber leur expérience de connexion).*

### 4. VLAN 30 ("Lan-Invité") - `30.30.30.0/24`
* **Zone :** Hotspots (Isolation totale).
* **Diffusion Wi-Fi :** SSID `Invité`.
* **Points d'Accès Assignés :** Diffusé sur tous les APs du domaine.

---

## 📻 Ingénierie Radio & Optimisation RF (Fréquences & Canaux)
Le paramétrage des canaux et des largeurs de bande a été calibré pour concilier débit maximal, pénétration du signal et compatibilité domotique :

### 🌐 Bande 2.4 GHz (Standardisée sur tout le domaine)
* **Configuration (`AP-Bungalow`, `AP-Maison`, `AP-Chambre`) :** Largeur **20 MHz**, Canal **6**.
* **Rationale Technique :**
  * **Pénétration & Portée :** La largeur de 20 MHz maximise le rapport signal/bruit (SNR) et optimise la traversée des murs épais (notamment dans la bâtisse de 70m² de la Minivilla).
  * **Compatibilité IoT / Domotique :** Assure une interopérabilité universelle et sans faille avec l'ensemble des modules domotiques et objets connectés (IoT) du domaine.

### 🚀 Bande 5 GHz (Calibrée selon les zones)
* **`AP-Bungalow` (Minivilla - U6-Pro) :** Largeur **40 MHz**, Canal **100 (DFS)**.
  * *Rationale :* Une largeur resserrée à 40 MHz sur la bande DFS 100 privilégie la traversée des obstacles et cloisons tout en préservant un débit très confortable.
* **`AP-Maison` (U7-Lite) & `AP-Chambre` (U6+) :** Largeur **160 MHz**, Canal **100 (DFS)**.
  * *Rationale :* Exploitation de la largeur maximale de 160 MHz sur bande DFS pour délivrer des débits de pointe Wi-Fi 6/7 extrêmes dans les espaces de vie principaux.

---

## 🛡️ Sécurité & Routage (Zones de Pare-Feu)
* **Zone "Interne" (VLAN 10) :** Réseau de confiance. Autorise la sortie vers Internet, le VPN, et l'accès à la passerelle (Gateway).
* **Zone "Hotspots" (VLAN 20 & VLAN 30) :** Règles restrictives automatiques (*Drop*). Bloque strictement toutes les communications initiées depuis ces clients en direction de la Gateway, des réseaux de la zone "Interne", ou des tunnels VPN. Seul l'accès sortant vers Internet est autorisé.

---

## 🌍 Accès Distant & Secours (Out-of-Band)
* **Accès Primaire (Intégration Homelab) :** Client VPN WireGuard configuré sur l'UCG Ultra pour initier un tunnel persistant vers le serveur `CT111` central. Cela contourne le NAT de la Livebox et permet un accès sécurisé aux réseaux d'administration depuis l'extérieur.
* **Solution de Secours (Fallback) :** Le service **UniFi Teleport** est activé et rattaché au Cloud UniFi (`unifi.ui.com`), garantissant un accès d'urgence Out-of-Band via smartphone si la liaison principale est coupée.
