# Arch Linux : Optimisations et correctifs Intel BE200 (Wi-Fi 7)
*Date : Mars 2026*

Ce document trace les résolutions de bugs matériels rencontrés sur l'installation Arch Linux du laptop (Poste de contrôle), équipés de la puce **Intel Wi-Fi 7 BE200** avec le pilote `iwlwifi`.

## 1. Crash du firmware en sortie de veille profonde (D3cold)
**Symptôme :** Perte totale de la connexion Wi-Fi après un cycle de mise en veille.
**Solution :** Hook Systemd de rechargement.
**Fichier :** `/usr/lib/systemd/system-sleep/wifi-reset.sh`
```bash
#!/bin/sh
case $1/$2 in
  pre/*)
    modprobe -r iwlmld iwlwifi
    ;;
  post/*)
    modprobe iwlwifi
    ;;
esac
```

## 2. Dérèglement du "Regulatory Domain" (LAR)
**Symptôme :** La puce reste en `country 00`.
**Solution :** Désactivation du LAR Intel via `/etc/modprobe.d/iwlwifi-lar.conf` :
```conf
options iwlwifi lar_disable=1
```

## 3. Gestion du nom d'interface (wlan0)
**Observation :** Un rechargement partiel des modules entraînait une incrémentation du nom (`wlan0` -> `wlan1`). 
**Solution :** Un déchargement complet de `iwlmld` et `iwlwifi` permet au noyau de libérer l'index et de réattribuer systématiquement `wlan0` au rechargement, sans avoir besoin de règles udev complexes.
