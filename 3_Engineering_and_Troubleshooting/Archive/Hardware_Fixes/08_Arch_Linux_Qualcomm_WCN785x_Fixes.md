# Arch Linux : Optimisations et correctifs Qualcomm WCN785x (Wi-Fi 7)
*Date : Avril 2026*

Ce document trace les résolutions de bugs matériels rencontrés sur l'installation Arch Linux du laptop (Poste de contrôle), équipé de la puce **Qualcomm Technologies, Inc WCN785x Wi-Fi 7 (FastConnect 7800)** avec le pilote `ath12k`.

## 1. Échecs d'allocation DMA et erreurs de firmware (-71)
**Symptôme :** Messages `ath12k_pci ... failed to pull fw stats: -71` et `qmi dma allocation failed`. Déconnexions aléatoires lors du roaming.
**Cause :** Le pilote `ath12k` nécessite de larges blocs de mémoire contiguë (jusqu'à 7 Mo) pour charger les statistiques et le firmware. Sans pool réservé, la fragmentation de la RAM empêche ces allocations après quelques heures d'utilisation.
**Solution :** Réservation d'un pool CMA (Contiguous Memory Allocator) via le kernel command line.
**Action :** Ajouter `cma=256M` dans `/etc/kernel/cmdline` (ou la config UKI) et régénérer l'image.

## 2. Handshake Timeout lors du Roaming (4WAY_HANDSHAKE_TIMEOUT)
**Symptôme :** Déconnexion immédiate lors du passage d'une borne Wi-Fi à une autre, même avec un signal fort.
**Cause :** La gestion agressive de l'énergie via PCIe ASPM (`powersave`) crée des latences de réveil qui font échouer le timing critique du handshake WPA2/WPA3.
**Solution :** Désactivation de la politique ASPM forcée.
**Action :** Supprimer `pcie_aspm.policy=powersave` des paramètres du noyau.

## 3. Configuration iwd (Roaming)
**Observation :** Pour éviter que le client ne bascule trop facilement sur le réseau 2.4 GHz alors que le 5 GHz est stable, les seuils suivants sont recommandés dans `/etc/iwd/main.conf` :
```ini
[General]
RoamThreshold=-70
RoamThreshold5G=-74

[Network]
EnableFT=false
```
*Note : `EnableFT=false` est maintenu pour éviter des transitions "opportunistes" vers le 2.4 GHz malgré les thresholds.*

## 4. Contexte Technique
- **Kernel :** 6.19.11-arch1-1 (ou supérieur)
- **Image :** Unified Kernel Image (UKI) via `mkinitcpio`
- **Gestionnaire :** `iwd` (IWD: Internet Wireless Daemon)
