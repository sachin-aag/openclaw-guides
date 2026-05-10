# 04 · Deploy on a Hostinger VPS

Where you put OpenClaw when you want it always-on, cron actually fires, and you control the box. Hostinger's KVM plans are the cheapest sane option in the EU.

> **Time:** ~30–60 minutes (first time)
> **Cost:** KVM 1 ≈ €4.99/mo, KVM 2 ≈ €6.99/mo
> **Best for:** personal always-on agents, small team deployments, anyone wanting an EU-hosted box.

## Prerequisites

- A Hostinger account ([hostinger.com/vps-hosting](https://www.hostinger.com/vps-hosting))
- An SSH key pair on your laptop (`ssh-keygen -t ed25519` if you don't have one)
- Your model API key
- A domain name (optional but recommended for TLS)

## 1 · Provision the VPS

In the Hostinger dashboard:

1. **Plan** → KVM 1 (1 vCPU, 4 GB RAM, 50 GB SSD) is enough for a personal agent. KVM 2 if you'll run multiple agents or use a heavier model.
2. **OS** → **Ubuntu 24.04 LTS**.
3. **Datacenter** → pick the one closest to your users (Frankfurt for most EU readers).
4. **SSH key** → upload your public key during setup. **Don't use password auth.**
5. Wait ~3 minutes for provisioning. You'll get an IP address.

## 2 · First login + harden

```bash
ssh root@<your-ip>
```

Run the basics:

```bash
# create a non-root user
adduser openclaw
usermod -aG sudo openclaw

# copy your SSH key to that user
rsync --archive --chown=openclaw:openclaw ~/.ssh /home/openclaw

# disable root SSH + password auth
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh

# basic firewall
apt update && apt install -y ufw fail2ban
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
systemctl enable --now fail2ban
```

Log out, log back in as `openclaw`:

```bash
ssh openclaw@<your-ip>
```

## 3 · Install Docker + Docker Compose

```bash
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker openclaw
# log out + back in to pick up the group
exit
ssh openclaw@<your-ip>
docker --version
```

## 4 · Pull the OpenClaw image

```bash
mkdir -p ~/openclaw && cd ~/openclaw
```

Create `docker-compose.yml`:

```yaml
services:
  openclaw:
    image: ghcr.io/openclaw/openclaw:latest   # or pin a version
    container_name: openclaw
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"   # bind to localhost; nginx fronts it
    env_file: .env
    volumes:
      - ./workspace:/app/workspace
      - ./sessions:/app/sessions
```

Create `.env` (same keys as the local install — see [02-install-local.md › step 3](02-install-local.md)):

```bash
OPENCLAW_PROVIDER=anthropic
OPENCLAW_MODEL=claude-sonnet-4-6
ANTHROPIC_API_KEY=sk-ant-...
WORKSPACE_DIR=/app/workspace
OPENCLAW_HOST=0.0.0.0
```

Start it:

```bash
docker compose up -d
docker compose logs -f
```

You should see the gateway boot. Hit `Ctrl-C` to stop tailing logs (the container keeps running).

## 5 · Front it with nginx + TLS

Skip if you only want to use SSH tunneling. Recommended if you want a real URL.

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Point a DNS A record (`agent.yourdomain.com`) at the VPS IP. Then:

```bash
sudo nano /etc/nginx/sites-available/openclaw
```

```nginx
server {
    listen 80;
    server_name agent.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/openclaw /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d agent.yourdomain.com
```

You now have HTTPS at `https://agent.yourdomain.com`.

> ⚠ **Do not** put OpenClaw on the public internet without auth in front of it. Either restrict by IP, or add basic auth in the nginx block, or use a reverse proxy with OAuth (Authelia, Pomerium, Cloudflare Zero Trust).

## 6 · Backups

Memory files are the only thing that's hard to recreate. Back them up nightly:

```bash
sudo apt install -y restic
restic init --repo /var/backups/openclaw   # local
# ...or to B2 / S3 / SFTP — see restic docs
```

```bash
# /etc/cron.daily/openclaw-backup
#!/bin/bash
restic --repo /var/backups/openclaw backup /home/openclaw/openclaw/workspace
restic --repo /var/backups/openclaw forget --keep-daily 7 --keep-weekly 4 --prune
```

```bash
sudo chmod +x /etc/cron.daily/openclaw-backup
```

## Updating OpenClaw

```bash
cd ~/openclaw
docker compose pull
docker compose up -d
```

## Cost ceiling

KVM 1 plus an EU TLD is ~€60/year. Model API on top of that depends on usage; budget €5–20/mo for personal use. Set a hard cap in your provider dashboard.

## Where to next

- GCP instead of Hostinger? → [05-deploy-vps-gcp.md](05-deploy-vps-gcp.md)
- Add a messaging channel? → [07-channels-messaging.md](07-channels-messaging.md)
- Things break? → [10-troubleshooting.md](10-troubleshooting.md)
