# Configuration et Mode de Fonctionnement — Lofree Flow Lite 84

Ce document détaille l'architecture interne, les raccourcis firmware et la gestion du remappage matériel du clavier mécanique low-profile **Lofree Flow Lite 84** (layout 75%).

---

## 1. Compréhension du Fonctionnement Interne (MCU & Firmware)

Le Lofree Flow Lite 84 se distingue des claviers standards par son architecture de traitement des signaux :

### A. L'isolation de la touche Fn (Hardware Layer)
* **Comportement standard :** La touche `Fn` ne génère aucun code de touche (*scancode*) HID ou USB standard transmissible au système d'exploitation (Windows/macOS/Linux).
* **Traitement local :** C'est le microcontrôleur (MCU) interne du clavier qui intercepte l'état de la touche `Fn`. Lorsque vous appuyez sur une combinaison (ex: `Fn + F2`), le clavier n'envoie pas les événements *"Touche Fn pressée"* puis *"Touche F2 pressée"*. À la place, le MCU traduit directement la combinaison en interne et transmet le code final d'action de la couche secondaire (ex: `Brightness_Down`).
* **Implication système :** Aucun utilitaire de remappage côté OS (comme Autohotkey ou PowerToys) ne peut détecter l'état physique de la touche `Fn`.

### B. Mappage et Persistance (EEPROM)
* **WebHID Configuration :** Les modifications de mappage effectuées via la plateforme WebHID (**[lofree.tech/home](https://www.lofree.tech/home/)**) modifient directement la table de correspondance stockée dans l'EEPROM (mémoire non volatile) du clavier.
* **Bascule de couches (Layers) :** Le clavier expose deux couches distinctes :
  1. **Base Layer :** S'applique lorsque les touches sont pressées seules.
  2. **Fn Layer :** S'applique lorsque les touches sont pressées tout en maintenant la touche `Fn` enfoncée.

---

## 2. Guide de Configuration du Fn-Lock pour l'Accès Direct Multimédia

Pour obtenir un comportement où les touches F1-F12 contrôlent par défaut la luminosité ou le volume sans maintenir `Fn`, tout en préservant l'accès aux touches F1-F12 standards :

### Étape 1 : Programmation des Couches (via le Lofree Key Mapper)
1. Connectez le clavier à l'ordinateur en mode filaire (**USB-C**).
2. Utilisez un navigateur compatible WebHID (Chrome, Edge ou Opera) et accédez à **[lofree.tech/home](https://www.lofree.tech/home/)**.
3. Associez votre périphérique en cliquant sur **Connect**.
4. Sur la couche principale (**Base Layer**), modifiez les touches physiques de la rangée F pour leur attribuer leurs raccourcis multimédias correspondants (ex : F2 $\rightarrow$ *Brightness Down*, F3 $\rightarrow$ *Brightness Up*, etc.).
5. Sur la couche de fonction (**Fn Layer**), réattribuez les touches de fonction standard (ex : F2 $\rightarrow$ *F2*, F3 $\rightarrow$ *F3*, etc.).

### Étape 2 : Comportement de Boot et BIOS/UEFI (Crucial)
* **Pourquoi c'est important :** Puisque le remappage est stocké de manière persistante sur le microcontrôleur du clavier, la touche F2 enverra par défaut le code multimédia *Brightness Down* dès la mise sous tension de la machine, y compris pendant la phase de Post/Boot.
* **Conséquence :** Si vous devez appuyer sur F2 ou F12 pour entrer dans le BIOS, une pression simple sur ces touches échouera car le BIOS n'interprète pas ces codes multimédias HID.
* **Action corrective :** Vous devez obligatoirement maintenir **`Fn` + la touche correspondante** (ex : `Fn + F2` ou `Fn + F12`) pour forcer le contrôleur à envoyer le scancode F-standard attendu par la carte mère.

---

## 3. Raccourcis Firmware Natifs

Ces raccourcis sont codés de manière rigide au niveau du firmware et permettent de piloter les fonctionnalités matérielles du clavier.

### Gestion de l'OS et Mode
* **`Fn + N`** : Active le mode **Windows / Android** (intervertit `Cmd/Alt` et `Opt/Win` pour correspondre au layout PC standard).
* **`Fn + M`** : Active le mode **macOS / iOS**.

### Appairage et Flux Sans-fil
* **`Fn + 1` / `Fn + 2` / `Fn + 3` (Maintien de 3 secondes)** : Lance le mode d'appairage Bluetooth sur le canal sélectionné (la LED bleue clignotera rapidement).
* **`Fn + 1` / `Fn + 2` / `Fn + 3` (Pression brève)** : Bascule vers l'hôte associé sur le canal Bluetooth correspondant.
* **`Fn + 4` (Pression brève)** : Bascule sur la connexion sans fil 2.4 GHz (nécessite le dongle RF connecté).

### Rétroéclairage Principal (Backlight)
* **`Fn + F7`** : Allume ou éteint complètement le rétroéclairage blanc des touches.
* **`Fn + F5` / `Fn + F6`** : Diminue ou augmente la luminosité des LED de touches.
* **`Fn + Flèche Droite (→)`** : Fait défiler les modes d'effets lumineux prédéfinis.

### Rétroéclairage des Tranches (Side RGB Lights)
* **`Fn + Flèche Gauche (←)`** : Fait défiler les modes de couleurs des LED RGB latérales (ou les éteint).

### Commande de Volume
* **Rotation de la molette** : Ajustement linéaire du volume.
* **Pression sur la molette** : Commute l'état Muet (Mute / Unmute).

### Sécurité et Réinitialisation
* **`Fn + Delete`** : Verrouille la session active sur l'OS hôte.
* **`Fn + Esc + Backspace` (Maintien prolongé)** : Réinitialisation d'usine complète. Conservez la pression jusqu'à ce que le rétroéclairage clignote **3 fois**.

---

## 4. Codes d'État des LED

Le clavier utilise des codes lumineux spécifiques pour indiquer son état opérationnel :

| Indicateur | Comportement LED | Signification |
| :--- | :--- | :--- |
| **Batterie** | Blanc pulsé | En charge (câble connecté) |
| **Batterie** | Blanc fixe | Charge terminée (câble connecté) |
| **Batterie** | Rouge pulsé | Niveau de charge faible (< 20%) |
| **Batterie** | Rouge clignotant | Niveau de charge critique (< 5%) |
| **Bluetooth** | Bleu clignotant rapide | Appairage en cours |
| **Bluetooth** | Bleu fixe (bref) | Connexion établie |
| **Caps Lock** | Blanc fixe | Majuscules verrouillées |
