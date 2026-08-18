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
Le routeur UCG Ultra est positionné en cascade (double NAT maîtrisé) derrière la Livebox FAI :
* **Liaison WAN :** Port LAN 4 (1 Gbps) de la Livebox vers le port WAN (2.5 Gbps) du UCG Ultra.
* **Adressage WAN (UCG) :** `192.168.1.254` (IP Statique configurée sur la Livebox, réseau `192.168.1.1`).
* **Configuration DMZ :** La Livebox est configurée avec une **DMZ pointant vers l'IP `192.168.1.254`** de l'UCG Ultra, transférant l'ensemble des flux entrants non sollicités directement au pare-feu UniFi.
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

---

## 💼 Chiffrage & Valorisation du Projet (Simulation Devis)

### 1. Valorisation de la Main d'Œuvre & Prestation Technique
| Poste d'Intervention | Description de la Prestation | Volume Horaire | Taux Horaire | Total HT |
| :--- | :--- | :---: | :---: | :---: |
| **Ingénierie & Sourcing** | Audit du site, dimensionnement matériel et plan d'architecture | 2.0 h | 60 € | 120 € |
| **Chantier Physique & Câblage** | Tirage Cat6, perçages muraux, pose des keystones et fixation des APs | 3.0 h | 60 € | 180 € |
| **Configuration & Optimisation** | Initialisation, VLANs, IPv6, Zones Firewall, RF Tuning & Teleport | 3.0 h | 60 € | 180 € |
| **Sous-total Prestation** | | **8.0 h** | | **480 €** |
| **Remise Formation / Famille (75%)** | *Application de la réduction pédagogique & cadre familial* | | | **-360 €** |
| **Total Prestation Main d'Œuvre** | | | | **120 €** |

### 2. Matériel & Équipements Déployés (Factures Réelles)
| Désignation Matériel | Fournisseur / Source | Rôle & Emplacement | Quantité | Prix Réel TTC |
| :--- | :--- | :--- | :---: | :---: |
| **UniFi Cloud Gateway Ultra** | Amazon (GETIC SIA) | Routeur / Contrôleur central (Garage) | 1 | 139,89 € |
| **UniFi Switch Ultra (USW-Ultra)** | Ubiquiti Store Europe | Switch PoE centralisé (Garage) | 1 | 176,40 € |
| **Ubiquiti U6-Pro** | eBay | Point d'accès Wi-Fi 6 MIMO 4x4 (Minivilla) | 1 | 119,69 € |
| **Ubiquiti U6+** | Amazon (BATNA Sp. z o.o.) | Point d'accès Wi-Fi 6 (Chambre en contrebas) | 1 | 120,09 € |
| **Ubiquiti U7-Lite** | Ubiquiti Store *(Estimatif)* | Point d'accès Wi-Fi 7 (Maison Principale) | 1 | 115,00 € |
| **4x Modules Keystone RJ45 Cat6a** | Amazon (HB-DIGITAL) | Terminaisons femelles blindées STP | 1 lot | 15,90 € |
| **Câblage Cat6 & Fixations** | Fournitures diverses | Consommables et visserie | Lot | 30,00 € |
| **Total Matériel & Fournitures** | | | | **716,97 €** |

### 📊 Synthèse Globale du Chantier
* **Investissement Matériel & Consommables :** **716,97 €** *(constaté sur factures)*
* **Prestation Technique Facturée (avec remise 75% formation/famille) :** **120,00 €** *(au lieu de 480,00 €)*
* **Coût Global Réel du Projet :** **836,97 € TTC** *(au lieu de 1 196,97 €)*

---

## 💡 Recommandations Techniques & Évolutions Stratégiques

### 🔄 Migration FAI Envisagée : Transition Orange (Livebox) vers Free (Freebox Pop / Ultra)
Pour optimiser et professionnaliser davantage l'infrastructure du domaine, une transition vers une offre Freebox (Pop ou Ultra) est recommandée pour les raisons techniques suivantes :
1. **Mode Bridge Natif & Suppression du Double-NAT :** Contrairement à la Livebox qui impose un double-NAT contourné par DMZ, la Freebox dispose d'un véritable **mode Bridge**. L'UCG Ultra obtient ainsi directement l'IP publique WAN sur son interface, assurant une délégation totale du routage et simplifiant grandement les tunnels VPN.
2. **Débit WAN 2.5 Gbps :** La présence d'un port **2.5 GbE** sur la Freebox (Pop/Ultra) permet d'exploiter pleinement le port WAN 2.5 GbE du UCG Ultra, levant le goulet d'étranglement de 1 Gbps imposé par la Livebox. Même avec un switch USW en 1 Gbps, l'agrégation de trafic multi-clients profitera de ce surplus de débit.
3. **Gain Thermique & Économie d'Énergie :** En mode bridge, la désactivation du Wi-Fi et des modules applicatifs de la box FAI réduit la chauffe et la consommation électrique au sein du garage.
4. **Cohérence Esthétique :** Le design blanc et épuré de la Freebox s'intègre parfaitement avec les équipements blancs UniFi.
5. **Optimisation Budgétaire :** Rationalisation du coût récurrent de l'abonnement FAI par rapport à l'offre Orange en cours.

---

## 🔮 Roadmap / Phase 2 (Extension Haute : Bergeries & Chalet)

### 1. Objectif de Couverture
Étendre la connectivité Wi-Fi vers les hauteurs du domaine en desservant :
* **Les Bergeries :** 2 logements détachés (2 chambres, 1 SdB).
* **Le Chalet / Cabane :** Bâtisse située environ **20 mètres plus loin et 3 mètres plus haut**, dans un environnement totalement dégagé (vue directe / Line-of-Sight).

### 2. Tracé & Travaux d'Acheminement Filaire
* **Cheminement :** Départ depuis le switch USW-Ultra dans le garage $\rightarrow$ traversée du garage $\rightarrow$ sortie en façade arrière au niveau de la **cuisine extérieure** $\rightarrow$ tranchée avec enfouissement d'une gaine technique étanche (câble Cat6a extérieur résistant aux UV / intempéries) montant jusqu'au niveau des bergeries.
* **Point de Fixation Stratégique :** Installation et fixation de l'AP extérieur sur l'**arbre situé directement en face des Bergeries**.

### 3. Choix Matériel & Ingénierie de Couverture (U7 Outdoor)
* **Équipement Prévu :** **Ubiquiti UniFi U7 Outdoor** (ou **U7 Pro Outdoor**) avec ses **antennes externes directionnelles / sectorielles**.
* **Rationale Technique :**
  * **Étanchéité & Résistance Climatique :** Châssis certifié IPX6 conçu pour les conditions extérieures méditerranéennes.
  * **Rayonnement Double Portée :** L'utilisation des antennes externes à fort gain permet d'arroser efficacement les Bergeries à courte distance tout en projetant un faisceau puissant et direct vers le Chalet situé 20 mètres plus haut en surplomb, éliminant ainsi le besoin d'une seconde tranchée coûteuse.
