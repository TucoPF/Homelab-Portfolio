# Reverse Engineering & Patch C++ : Le Bug de l'Authentification SMB IPv6 sous KDE

## 1. Contexte et Symptôme
Dans une infrastructure cloud entièrement basculée en **IPv6 Unique Local Address (ULA)** (`fddf::/64`), l'accès aux partages de fichiers Samba depuis le gestionnaire de fichiers KDE Dolphin (`kio-extras`) présentait un comportement anormal :
* La connexion via ligne de commande (`smbclient //fddf::133/Cloud -U tuco`) fonctionnait parfaitement.
* La connexion via l'interface graphique Dolphin (`smb://[fddf::133]/Cloud`) se bloquait dans une **boucle infinie de demande de mot de passe**, rendant l'accès impossible.

## 2. Analyse et Investigation
L'analyse des logs du serveur Samba (`smbd`) a révélé que malgré la saisie du bon mot de passe, le client KDE tentait systématiquement de se connecter en mode **Invité** (Guest/Anonymous), ce que le serveur rejetait avec une erreur `NT_STATUS_ACCESS_DENIED`.

En plongeant dans le code source de KDE (`kio-extras`), j'ai découvert que la bibliothèque sous-jacente (`libsmbclient`) ne gère pas nativement le format standard des adresses IPv6 entre crochets. Pour contourner cela, KDE transforme temporairement les adresses comme `[fddf::133]` en un pseudo-hostname au format Windows : `fddf--133.ipv6-literal.net`.

### L'Origine du Bug
La faille se situait dans la méthode de récupération des mots de passe depuis **KWallet** (le coffre-fort de KDE). 
* KWallet enregistre le mot de passe sous la clé de l'adresse originale : `[fddf::133]`.
* Cependant, le module `kio_smb` interrogeait KWallet avec le pseudo-hostname `fddf--133.ipv6-literal.net`.
* Résultat : **Cache Miss systématique**. Sans mot de passe trouvé en mémoire, KIO forçait une tentative de connexion anonyme, échouait, et redemandait le mot de passe à l'utilisateur, créant la boucle infinie.

## 3. Développement du Correctif C++
Pour résoudre ce problème à la racine de l'OS, j'ai développé un patch en C++ injecté directement dans le fichier `smbauthenticator.cpp` du module `kio_smb`.

L'algorithme intercepte les requêtes de recherche de mot de passe. Si le nom d'hôte cible se termine par `.ipv6-literal.net`, il effectue une **rétro-traduction** (Reverse Translation) pour recréer l'adresse IPv6 standard avant d'interroger KWallet.

```cpp
// ==== DEBUT DU PATCH D'INJECTION (KWallet IPv6 Fix) ====
QString hostForWallet = url.host();

// Si l'hôte est une adresse IPv6 transformée en pseudo-hostname
if (hostForWallet.endsWith(QLatin1String(".ipv6-literal.net"))) {
    // 1. On retire le suffixe
    hostForWallet.chop(17);
    // 2. On remplace les tirets '-' par des ':'
    hostForWallet.replace(QLatin1Char('-'), QLatin1Char(':'));
    // 3. On reformate avec les crochets standards IPv6
    hostForWallet = QStringLiteral("[%1]").arg(hostForWallet);
}

// Interrogation de KWallet avec la VRAIE adresse IPv6
Wallet::AuthInfo authInfo;
authInfo.setHost(hostForWallet);
// ==== FIN DU PATCH ====
```

## 4. Validation et Déploiement
La procédure de validation a suivi les standards de l'ingénierie système :
1. **Isolation :** Déploiement d'une Machine Virtuelle Fedora KDE jetable.
2. **Compilation :** Résolution des dépendances (`qcoro`, `kdsoap-ws-discovery`) et compilation locale du code source modifié via `cmake` et `make`.
3. **Injection :** Remplacement chirurgical de la bibliothèque partagée native (`/usr/lib64/qt6/plugins/kf6/kio/smb.so`) par la version recompilée.
4. **Diagnostic Réseau :** Résolution d'un problème transitoire de cache NDP (Neighbor Discovery Protocol) sur le pont réseau virtuel pour assurer le routage.
5. **Résultat :** Le montage SMB IPv6 s'effectue désormais de manière instantanée, KWallet retourne correctement le jeton d'authentification, éliminant définitivement la boucle infinie.

Un rapport de bug complet accompagné du fichier `.patch` a été formaté pour soumission au projet KDE open-source.
