# Documentation Ingénierie : Optimisation Matérielle et Logicielle du Client Léger (Raspberry Pi 4 / Moonlight)

**Date d'audit :** Juillet 2026
**Cible :** Raspberry Pi 4 (Client Moonlight) vers VM Workstation (KDE Plasma 6 Wayland)
**Problématique initiale :** Latence extrême du curseur ("souris flottante"), image floue sur un moniteur TV 768p, interférences radio 2.4 GHz.

---

## 1. Topologie Radio et Électromagnétique (Le problème du 2.4 GHz)

Le Raspberry Pi 4 souffre d'un défaut matériel natif : son contrôleur USB 3.0 émet un bruit électromagnétique à large bande ("Broadband Noise") dans les fréquences 2.4 GHz, détruisant la fiabilité des connexions Wi-Fi et Bluetooth à proximité.

**L'architecture matérielle validée et mise en place :**
*   **Dongle Souris (Logitech G305) -> Port USB 2.0 (Noir) :** Branché directement sur la carte mère sur un port silencieux (USB 2.0) pour minimiser la latence d'entrée.
*   **Dongle Clavier -> Port USB 2.0 (Noir) :** Branché à côté de la souris sur le second port silencieux.
*   **Antenne Wi-Fi (Fenvi AX1800) -> Port USB 3.0 (Bleu) via Rallonge USB :** La puce Wi-Fi a été déportée au bout d'une rallonge USB blanche (2.0) branchée sur le port USB 3.0. 
    *   *Raisonnement :* Éloigne l'antenne réceptrice de la bulle de bruit de la carte mère. Le fait d'utiliser une rallonge USB 2.0 dans un port 3.0 désactive les broches haute vitesse, tuant le bruit à la source. Le bridage à ~300 Mbps est sans impact pour un flux Moonlight de 35 Mbps.
*   **Suppression du Hub USB 3.0 :** Élimine le relais matériel (Hop), la consommation fantôme et une source additionnelle de bruit électromagnétique.

---

## 2. Optimisation de la Souris (Logitech G305)

La sensation de lag lourd ou de flottement de la souris n'était pas due au réseau, mais à la saturation du processeur du client (Pi 4) et à une erreur de DPI.

*   **Le piège du Polling Rate (1000 Hz) :** La G305 est une souris "Lightspeed" (sans Bluetooth). Par défaut, elle envoie 1000 interruptions USB par seconde au Pi 4, étouffant le CPU sous Linux.
*   **Mode Endurance (LED Verte) :** En pressant le bouton physique central jusqu'à allumer la LED en **Vert**, la souris bascule en mode Endurance (125 Hz). Le CPU du Pi est libéré, supprimant instantanément le flottement logiciel du curseur sous Moonlight.
*   **Sweet Spot DPI (LED Orange) :** Le DPI matériel a été configuré sur la couleur **Orange (1600 DPI)**. C'est l'équilibre parfait de sensibilité pour la bureautique et le passthrough.

---

## 3. Paramétrage KDE Plasma 6 (Wayland) et Moonlight

La configuration réseau et système pour garantir un rendu "Pixel-Perfect" avec la latence la plus basse possible (au ras du métal).

### A. Flux Moonlight (Pi 4)
*   **Bitrate :** Réduit à **30-35 Mbps**. Assure une qualité mathématiquement sans perte ("Lossless") pour du 768p/1080p tout en allégeant le temps de décodage matériel H.265.
*   **V-Sync et Frame Pacing :** **Désactivés**. L'objectif bureautique priorise la réactivité brute du pointeur sur la fluidité parfaite des défilements. Le sacrifice (léger Tearing occasionnel) permet d'économiser jusqu'à 30 millisecondes de délai d'affichage (particulièrement critique sur une TV non-"Mode Jeu").

### B. Scalabilité KDE et Résolution (VM Workstation)
*   **Résolution Forcée :** Au lieu de faire un "downscaling" réseau (1080p envoyé sur TV 768p = image floue), la VM a été scriptée (via `kscreen-doctor` dans `sunshine.conf`) pour générer directement une image native (ex: `1368x768`).
*   **Abandon du Wayland Scale (Fractional Scaling) :** L'échelle d'affichage de KDE est gérée manuellement par l'utilisateur. Le script d'automatisation de Sunshine ne force plus le Scale à 1.0. 
*   **Remplacement du DPI ("Force Font DPI") :** L'option historique X11 de DPI forcé étant morte sous Wayland, l'interface est agrandie proprement (sans aucun flou de redimensionnement) en modifiant l'option `Taille` dans les paramètres de polices KDE (ex: 12pt à 16pt).

### C. La Souris sous Wayland (kcminputrc)
*   **Profil Plat (Flat) :** L'accélération de la souris `Mouse passthrough` (et `absolute`) a été paramétrée sur Plat avec vitesse réduite.
*   **Le Bug Visuel KDE :** L'interface graphique des paramètres KDE remet systématiquement la liste déroulante matérielle sur `QEMU USB Tablet` lors de sa réouverture. Ceci est un bug visuel cosmétique. Les variables injectées pour Moonlight sont rigoureusement sauvegardées et appliquées en dur dans le fichier `~/.config/kcminputrc` sous la clé `[Libinput][...][Mouse passthrough]`.

---
*Ce document sert de référence d'architecture standardisée pour le déploiement de terminaux légers Raspberry Pi vers la Workstation.*
