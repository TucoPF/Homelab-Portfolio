# Automated LXC & Docker Container Updates

*Date: June 28, 2026*

This document outlines the architecture, scripts, and systemd scheduling used to automatically update all running Proxmox LXC containers and their internal Docker compose stacks on the **Matrix** compute node.

## 🏗️ Architecture & Mechanism

The auto-update system runs centrally on the Proxmox host (**Matrix**) to maintain all active workloads without requiring individual update configurations inside each container:

1. **Host-Level Script:** A bash script at `/home/tuco/scripts/update_containers.sh` handles orchestration.
2. **Container Discovery:** The script queries Proxmox for all currently running LXC containers.
3. **LXC System Updates:** For each running container, it performs non-interactive system package updates (`apt-get update && apt-get dist-upgrade`).
4. **Docker Stack Updates:** If Docker is running inside a container, the script scans common application directories (`/root`, `/home`, `/opt`, `/var/www`) for any `docker-compose.yml` or `docker-compose.yaml` files. It automatically pulls new images, recreates changed containers, and prunes unused images to save disk space.
5. **Systemd Automation:** The process is scheduled and managed via a host-level systemd service and timer.

---

## 🛠️ Implementation Details

### 1. Update Orchestration Script (`/home/tuco/scripts/update_containers.sh`)
```bash
#!/bin/bash
# ==============================================================================
# Container Auto-Update Script (LXC & Docker)
# Runs on Matrix host (Proxmox VE) to update system packages in all running LXC 
# containers and update any Docker compose stacks running inside them.
# ==============================================================================

# Ensure standard binaries are in the path
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

LOG_FILE="/home/tuco/scripts/update_containers.log"

# Setup logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log "============================================================="
log "Auto-Update starting..."

# 1. Gather running LXC container IDs
RUNNING_CONTAINERS=$(pct list 2>/dev/null | awk 'NR>1 && $2=="running" {print $1}')

if [ -z "$RUNNING_CONTAINERS" ]; then
    log "No running LXC containers found. Exiting."
    exit 0
fi

# 2. Iterate through each container
for vmid in $RUNNING_CONTAINERS; do
    name=$(pct list 2>/dev/null | awk -v id="$vmid" '$1==id {print $3}')
    log "--- Processing LXC ${vmid} (${name}) ---"
    
    # 2a. Update LXC system packages (Debian-based)
    log "LXC ${vmid} (${name}): Running apt-get update..."
    if pct exec "$vmid" -- env DEBIAN_FRONTEND=noninteractive apt-get update -y >> "$LOG_FILE" 2>&1; then
        log "LXC ${vmid} (${name}): Running apt-get dist-upgrade..."
        if pct exec "$vmid" -- env DEBIAN_FRONTEND=noninteractive apt-get dist-upgrade -y -o Dpkg::Options::="--force-confold" -o Dpkg::Options::="--force-confdef" >> "$LOG_FILE" 2>&1; then
            log "LXC ${vmid} (${name}): System packages upgraded successfully."
            
            # Run cleanup
            log "LXC ${vmid} (${name}): Cleaning up packages..."
            pct exec "$vmid" -- env DEBIAN_FRONTEND=noninteractive apt-get autoremove -y >> "$LOG_FILE" 2>&1
            pct exec "$vmid" -- env DEBIAN_FRONTEND=noninteractive apt-get clean >> "$LOG_FILE" 2>&1
        else
            log "LXC ${vmid} (${name}): ERROR - dist-upgrade failed."
        fi
    else
        log "LXC ${vmid} (${name}): ERROR - apt-get update failed."
    fi

    # 2b. Check if Docker is installed and running inside this container
    if pct exec "$vmid" -- systemctl is-active docker >/dev/null 2>&1; then
        log "LXC ${vmid} (${name}): Docker is active. Scanning for docker-compose stacks..."
        
        # Find all docker-compose configurations in common directory paths
        COMPOSE_FILES=$(pct exec "$vmid" -- find /root /home /opt /var/www -name "docker-compose.yml" -o -name "docker-compose.yaml" 2>/dev/null || true)
        
        if [ -n "$COMPOSE_FILES" ]; then
            echo "$COMPOSE_FILES" | while read -r compose_file; do
                [ -z "$compose_file" ] && continue
                compose_dir=$(dirname "$compose_file")
                log "LXC ${vmid} (${name}): Found Docker compose stack at ${compose_dir}. Updating..."
                
                # Pull new images
                log "LXC ${vmid} (${name}): docker compose pull in ${compose_dir}..."
                if pct exec "$vmid" -- bash -c "cd ${compose_dir} && docker compose pull" >> "$LOG_FILE" 2>&1; then
                    # Apply changes
                    log "LXC ${vmid} (${name}): docker compose up -d in ${compose_dir}..."
                    if pct exec "$vmid" -- bash -c "cd ${compose_dir} && docker compose up -d --remove-orphans" >> "$LOG_FILE" 2>&1; then
                        log "LXC ${vmid} (${name}): Docker compose stack updated successfully."
                        # Clean up dangling images
                        pct exec "$vmid" -- docker image prune -f >> "$LOG_FILE" 2>&1
                    else
                        log "LXC ${vmid} (${name}): ERROR - Failed to bring up Docker containers."
                    fi
                else
                    log "LXC ${vmid} (${name}): ERROR - Failed to pull Docker images."
                fi
            done
        else
            log "LXC ${vmid} (${name}): No docker-compose configurations found."
        fi
    fi
done

log "Auto-Update completed."
log "============================================================="
```

### 2. Systemd Service Unit (`/etc/systemd/system/container-update.service`)
Defines the execution context and links the script to Proxmox startup constraints:
```ini
[Unit]
Description=Automatic Update of LXC Containers and Docker Stacks
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=root
ExecStart=/home/tuco/scripts/update_containers.sh
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### 3. Systemd Timer Unit (`/etc/systemd/system/container-update.timer`)
Triggers the update process weekly at off-peak hours (Sunday at 2:00 AM CEST), ensuring it does not overlap with the daily `fusion_mover.sh` storage mover run at 7:00 AM:
```ini
[Unit]
Description=Run Container Update Script Weekly (Sunday at 2 AM)

[Timer]
OnCalendar=Sun *-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

---

## 🛠️ Operation & Troubleshooting

### Check Job Logs
System package updates, docker compose pulls, and container recreations are logged with timestamps:
```bash
tail -n 100 /home/tuco/scripts/update_containers.log
# OR query systemd journal directly:
journalctl -u container-update.service
```

### Trigger a Manual Run
To update all running containers immediately, run:
```bash
sudo systemctl start container-update.service
```

### Check Next Scheduled Run
To see when the timer will next fire:
```bash
systemctl list-timers --all | grep container-update
```
