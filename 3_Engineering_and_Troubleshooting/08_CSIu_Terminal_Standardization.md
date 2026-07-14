# Terminal Standardization: CSI u Protocol & Container Access

## Objective
To enforce a robust, consistent, and modern terminal environment across the entire homelab (matrix, skynet, and all LXC containers) by deploying the **CSI u** keyboard protocol standard and optimizing how container consoles are attached.

---

## 1. Technical Context: The "Double-Escape" & `TERM` Issue

### The Legacy Problem
Historically, terminal emulators sent inconsistent, hardware-dependent escape sequences for modified keys (like `Ctrl+Backspace` or `Ctrl+Delete`). 
Furthermore, Proxmox's high-level tool `pct enter` overrides the terminal environment to `TERM=linux` before running `lxc-attach`. This forces the shell inside the container to assume it is running on a raw physical Linux virtual console, resulting in:
1. Stripped or mismatched escape sequences (e.g., `Shift + PageUp/Down` printing `2~`).
2. Loss of 256-color and truecolor support.
3. Mismapped word deletion/navigation shortcuts.

### The Modern Solution
1. **lxc-attach**: Bypassing `pct enter` in favor of native `sudo lxc-attach -n <vmid>` preserves the host's terminal type (`TERM=xterm-256color`), allowing advanced terminal capabilities to propagate to the container.
2. **CSI u Protocol**: Standardizes all keypress events into clear, parseable sequences of the format `\e[<key_code>;<modifier>u`.
3. **Unified `/etc/inputrc`**: A single, clean configuration file distributed to all servers and containers, defining keybindings for both legacy and CSI u sequences.

---

## 2. Standardized `/etc/inputrc` Template

This configuration has been deployed globally to `/etc/inputrc` on all hosts and containers:

```readline
# /etc/inputrc - Configuration globale standardisée (CSI u & Legacy)

# =========================================================================
# 1. PARAMÈTRES DU MOTEUR READLINE
# =========================================================================
set input-meta on
set output-meta on
set convert-meta off
set bell-style none
set show-all-if-ambiguous on

# =========================================================================
# 2. NAVIGATION ET TOUCHES SYSTEME STANDARDS
# =========================================================================
# Flèches de direction pour l'historique (Haut/Bas) et déplacement (Gauche/Droite)
"\e[A": previous-history
"\e[B": next-history
"\e[C": forward-char
"\e[D": backward-char

# Touches Home / End (Début / Fin de ligne)
"\e[1~": beginning-of-line
"\e[4~": end-of-line
"\e[H": beginning-of-line
"\e[F": end-of-line

# Touches Delete / Insert
"\e[3~": delete-char
"\e[2~": quoted-insert

# =========================================================================
# 3. RACCOURCIS UNIFORMISÉS CSI u (Ctrl / Alt + Mots)
# =========================================================================
# Déplacement par mot (Ctrl + Flèche Gauche / Droite)
# Codes CSI u : 'd'=100 (Gauche), 'c'=99 (Droite)
"\e[100;5u": backward-word
"\e[99;5u": forward-word

# Déplacement par mot (Alt + Flèche Gauche / Droite)
"\e[100;3u": backward-word
"\e[99;3u": forward-word

# Suppression de mot arrière (Ctrl + Backspace)
# Code CSI u : DEL=127, Ctrl=5
"\e[127;5u": backward-kill-word

# Suppression de mot arrière (Alt + Backspace)
# Code CSI u : DEL=127, Alt=3
"\e[127;3u": backward-kill-word

# Suppression de mot avant (Ctrl + Delete)
# Codes CSI u & xterm : Del_Key=3, Ctrl=5
"\e[3;5u": kill-word
"\e[3;5~": kill-word

# Suppression de mot avant (Alt + Delete)
# Codes CSI u & xterm : Del_Key=3, Alt=3
"\e[3;3u": kill-word
"\e[3;3~": kill-word
```

---

## 3. Host-Side and Zsh Configuration

### Container Access Alias (`matrix`)
To bypass Proxmox's automatic `TERM=linux` override, the following alias has been deployed to the host shells:
```bash
alias enter='sudo lxc-attach -n'
```
This alias is configured in:
*   `/root/.bashrc` (root user)
*   `/home/AI/.bashrc` (user `AI`)
*   `/home/tuco/.bashrc` (user `tuco`)

### Zsh Keybindings (`matrix` & `skynet`)
Since Zsh uses ZLE (Zsh Line Editor) instead of GNU Readline, `/etc/inputrc` is bypassed. The standardized CSI u bindings are injected into the universal Zsh template in `/root/portfolio/3_Engineering_and_Troubleshooting/04_Terminal_Environment_Setup.md` and deployed to the following files:
*   **matrix**: `/root/.zshrc` and `/home/tuco/.zshrc`
*   **skynet**: `/root/.zshrc` and `/home/tuco/.zshrc`

The following keybindings were configured:
```zsh
# Esc+é to exit, Alt+< to clear (Normal Mode)
bindkey -s '^[<' 'clear\n'
bindkey -s '\eé' 'exit\n'

# [Home], [End], [Delete] and Arrows (Static Mode Normal)
# Application Mode (smkx/rmkx) was removed to prevent blocking terminal viewport scrolling.
bindkey "^[[H" beginning-of-line      # Home
bindkey "^[[F" end-of-line            # End
bindkey "^[[3~" delete-char           # Delete

# Ctrl+Delete / Alt+Delete (Legacy fallbacks)
bindkey "^[[3;5~" kill-word           # Ctrl + Delete
bindkey "^[[3;3~" kill-word           # Alt + Delete

# CSI u Raccourcis clavier (Ctrl / Alt + Mots)
bindkey "\e[100;5u" backward-word       # Ctrl + Flèche Gauche
bindkey "\e[99;5u"  forward-word        # Ctrl + Flèche Droite
bindkey "\e[127;5u" backward-kill-word  # Ctrl + Backspace
bindkey "\e[127;3u" backward-kill-word  # Alt + Backspace
bindkey "\e[3;5u"   kill-word           # Ctrl + Delete
bindkey "\e[3;3u"   kill-word           # Alt + Delete
```

### Bash Keybindings (LXC Containers)
For the LXC containers running Bash, the `Alt+<` keybinding for clearing the screen is bound directly in `/root/.bashrc` and `/home/tuco/.bashrc` using:
```bash
bind '"\e<":"clear\n"'
bind '"\eé": "exit\n"'
```

---

## 4. Verification and Troubleshooting

### Test the Keyboard Input
To verify that the current shell is decoding CSI u properly:
1. Run `cat`.
2. Press `Ctrl + Backspace`.
3. If it outputs `^[[127;5u` (or maps to deletion in normal typing), the terminal is sending the correct CSI u sequence.
4. Press `Ctrl + C` to exit.

### Reload Readline Configuration
To apply updates to `/etc/inputrc` in a running shell session, trigger a reload:
*   In Bash: Press `Ctrl + X` followed by `Ctrl + R` (or run `bind -f /etc/inputrc`).
*   In Zsh: Zsh uses its own line editor (ZLE), so its keybindings must be managed via `bindkey` in `.zshrc`.
