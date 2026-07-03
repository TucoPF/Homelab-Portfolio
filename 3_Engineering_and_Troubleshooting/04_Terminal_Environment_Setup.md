# Terminal Environment Setup: Homelab Synchronization (Zsh)

## Objective
To standardize the shell environment across the entire homelab (Matrix, Skynet, Pi4), ensuring identical aliases, prompt behaviors (Tuco/Root distinction), and modern productivity features while maintaining high performance.

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
if command -v batcat >/dev/null 2>&1; then
    alias cat='batcat --style=plain --paging=never'
elif command -v bat >/dev/null 2>&1; then
    alias cat='bat --style=plain --paging=never'
fi

# --- System & Package Management ---
alias update='sudo apt update && sudo apt upgrade'
alias add='sudo apt install'
alias remove='sudo apt remove'
alias clean='sudo apt autoremove'
alias reboot='sudo reboot'
alias shutdown='sudo shutdown now'
alias added='apt-mark showmanual'

# Search with fzf (if available)
if command -v fzf >/dev/null 2>&1; then
    alias search='sudo apt-cache pkgnames | fzf --multi --preview "sudo apt-cache show {1}" | xargs -ro sudo apt-get install -y'
fi

# --- Proxmox & LXC Management ---
alias pct='sudo pct'
alias jellyfin='sudo pct enter 101'
alias arr='sudo pct enter 103'
alias nzb='sudo pct enter 102'

# --- Network & SSH (Wake-on-LAN) ---
alias matrix='ssh matrix'
alias skynet='ssh skynet'
alias pi='ssh pi'
alias wake-skynet='wakeonlan 34:5a:60:ba:86:5b'
alias wake-matrix='wakeonlan 58:47:ca:7a:84:cc'

# --- Keybindings ---
bindkey -s '^[x' 'clear\n'
bindkey -s '\eé' 'exit\n'
bindkey -e
bindkey "${terminfo[khome]}" beginning-of-line
bindkey "${terminfo[kend]}"  end-of-line
bindkey "${terminfo[kdch1]}" delete-char
bindkey "^[[1;5C" forward-word
bindkey "^[[1;5D" backward-word
bindkey '^H' backward-kill-word
bindkey "^[[A" history-search-backward
bindkey "^[[B" history-search-forward

# --- Prompt Configuration ---
if [ "$EUID" -ne 0 ]; then
    PROMPT='%F{green}%n@%m%f:%F{blue}%~%f$ '
else
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
for plugin in \
    "/usr/share/zsh/plugins/zsh-autosuggestions/zsh-autosuggestions.zsh" \
    "/usr/share/zsh-autosuggestions/zsh-autosuggestions.zsh" \
    "/usr/share/zsh/plugins/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh" \
    "/usr/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh"
do
    [ -f "$plugin" ] && source "$plugin"
done
```
