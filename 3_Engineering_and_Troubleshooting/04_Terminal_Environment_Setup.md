# Terminal Environment Setup: Homelab Synchronization (Zsh)

## Objective
To standardize the shell environment across the entire homelab (matrix, skynet, Pi4), ensuring identical aliases, prompt behaviors (Tuco/Root distinction), and modern productivity features while maintaining high performance.

## Architecture & Deployment Strategy
1. **Universal Template:** A single `.zshrc` template is maintained locally and synchronized across all nodes. This ensures that a new alias added to the template is instantly available everywhere after a deployment.
2. **Cross-Node Synchronization:** We utilize `scp` for secure file transfer and `ssh` for remote command execution (using `sudo tee` for root account access) to automate the deployment process.
3. **Environment Detection:** The template includes logic to detect the operating system (Arch vs Debian) and handle package manager differences (e.g., `bat` vs `batcat`) automatically.
4. **Visual Security (Root Alert):** The prompt is dynamically colored: **Green** for the standard user (`tuco`) and **Red** for `root`. This provides a critical visual cue to prevent accidental destructive commands in super-user mode.

## The Universal Template (`template_universal_zshrc`)
This template is the "Source of Truth" for the entire homelab.

```zsh
# Universal Zsh Configuration for Homelab
# Optimized for Matrix, Skynet, Pi4 and Root accounts

# --- Basic & Navigation Aliases ---
alias ls='ls --color=auto'
alias l='ls -la --color=auto'
alias la='ls -A --color=auto'
alias ll='ls -R --color=auto'
alias grep='grep --color=auto'
alias mounts='cat /etc/fstab'

# Handle both 'bat' (Arch) and 'batcat' (Debian)
alias cat='batcat --style=plain --paging=never'

# --- System & Package Management ---
alias update='sudo apt update && sudo apt upgrade'
alias add='sudo apt install'
alias added='apt-mark showmanual'
alias remove='sudo apt remove'
alias purge='sudo apt purge'
alias clean='sudo apt autoremove'
alias reboot='sudo reboot'
alias shutdown='sudo shutdown now'
alias temps='bash /home/tuco/scripts/check_skynet_temps.sh'

# Search with fzf (if available)
if command -v fzf >/dev/null 2>&1; then
    alias search='sudo apt-cache pkgnames | fzf --multi --preview "sudo apt-cache show {1}" | xargs -ro sudo apt-get install -y'
fi

# --- Proxmox & LXC Management ---
alias pct='sudo pct'
alias enter='sudo lxc-attach -n'
alias stop-quorum='pvecm expected 1'

# --- Network & SSH ---
alias wake-skynet='wakeonlan c4:62:37:09:8a:7f'
alias wake-matrix='wakeonlan 58:47:ca:7a:84:cc'
alias wake-pi='wakeonlan 2c:cf:67:59:5e:e3'

# --- Keybindings ---
# Esc+é to exit, Alt+< to clear
bindkey -s '^[<' 'clear\n'
bindkey -s '\eé' 'exit\n'

# Use emacs keybindings by default
bindkey -e

# [Home], [End], [Delete] and Arrows (Static Mode Normal)
bindkey "^[[H" beginning-of-line      # Home
bindkey "^[[F" end-of-line            # End
bindkey "^[[3~" delete-char           # Delete
bindkey "^[[1;5C" forward-word
bindkey "^[[1;5D" backward-word
bindkey '^H' backward-kill-word
bindkey "^[[A" history-search-backward
bindkey "^[[B" history-search-forward

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

# --- Prompt Configuration ---
# Use different colors for root vs. regular user
if [ "$EUID" -ne 0 ]; then
    # Regular user (Green user@host)
    PROMPT='%F{green}%n@%m%f:%F{blue}%~%f$ '
else
    # Root user (Red user@host)
    PROMPT='%F{red}%n@%m%f:%F{blue}%~%f# '
fi

# Zsh Autocompletion
autoload -Uz compinit
compinit

# --- History Configuration ---
HISTFILE=~/.zsh_history
HISTSIZE=10000
SAVEHIST=10000
setopt appendhistory
setopt sharehistory
setopt incappendhistory
setopt histignoredups

# --- Plugins ---
# Check common paths for Debian/Ubuntu and Arch
for plugin in \
    "/usr/share/zsh/plugins/zsh-autosuggestions/zsh-autosuggestions.zsh" \
    "/usr/share/zsh-autosuggestions/zsh-autosuggestions.zsh" \
    "/usr/share/zsh/plugins/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh" \
    "/usr/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh"
do
    [ -f "$plugin" ] && source "$plugin"
done
```
