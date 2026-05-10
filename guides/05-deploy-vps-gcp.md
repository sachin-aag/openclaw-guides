# 05 · Deploy on Google Cloud (Compute Engine)

GCP is the right call if you already use Google Cloud, want IAM/Secret Manager integration, or want to start on the [free tier](https://cloud.google.com/free) `e2-micro` instance.

> **Time:** ~45 minutes (first time)
> **Cost:** `e2-micro` free tier in `us-west1`/`us-central1`/`us-east1`; ~€5–8/mo otherwise
> **Best for:** teams already on GCP, anyone wanting Secret Manager + Cloud Logging out of the box.

## Prerequisites

- A GCP project with billing enabled
- `gcloud` CLI installed locally ([install](https://cloud.google.com/sdk/docs/install))
- Authenticated: `gcloud auth login` and `gcloud config set project <YOUR_PROJECT>`

## 1 · Create the VM

```bash
gcloud compute instances create openclaw \
  --zone=us-central1-a \
  --machine-type=e2-micro \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB \
  --tags=openclaw-web
```

Add a firewall rule for HTTPS only (no plain HTTP — TLS via Caddy below):

```bash
gcloud compute firewall-rules create openclaw-https \
  --allow=tcp:443 \
  --target-tags=openclaw-web \
  --description="OpenClaw HTTPS"
```

## 2 · SSH in

```bash
gcloud compute ssh openclaw --zone=us-central1-a
```

## 3 · Install Docker

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
exit  # log out and back in
gcloud compute ssh openclaw --zone=us-central1-a
```

## 4 · Store secrets in Secret Manager

This is the GCP-flavored move. Don't paste API keys into `.env` on the VM.

On your **laptop**, create the secrets:

```bash
echo -n "sk-ant-..." | gcloud secrets create anthropic-api-key --data-file=-
gcloud secrets add-iam-policy-binding anthropic-api-key \
  --member="serviceAccount:$(gcloud compute instances describe openclaw \
    --zone=us-central1-a --format='value(serviceAccounts[0].email)')" \
  --role="roles/secretmanager.secretAccessor"
```

On the **VM**, fetch them at startup:

```bash
sudo apt install -y google-cloud-cli
gcloud secrets versions access latest --secret=anthropic-api-key
```

## 5 · docker-compose with secret injection

```bash
mkdir -p ~/openclaw && cd ~/openclaw
```

`docker-compose.yml`:

```yaml
services:
  openclaw:
    image: ghcr.io/openclaw/openclaw:latest
    container_name: openclaw
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      OPENCLAW_PROVIDER: anthropic
      OPENCLAW_MODEL: claude-sonnet-4-6
      WORKSPACE_DIR: /app/workspace
      OPENCLAW_HOST: 0.0.0.0
    env_file: .env
    volumes:
      - ./workspace:/app/workspace
      - ./sessions:/app/sessions
```

A start script that pulls the key fresh each boot:

```bash
cat > start.sh <<'EOF'
#!/bin/bash
set -e
ANTHROPIC_API_KEY=$(gcloud secrets versions access latest --secret=anthropic-api-key)
echo "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY" > .env
docker compose up -d
EOF
chmod +x start.sh
./start.sh
```

## 6 · TLS with Caddy

Caddy auto-provisions Let's Encrypt certs. Less to remember than nginx + certbot.

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

`/etc/caddy/Caddyfile`:

```
agent.yourdomain.com {
    reverse_proxy 127.0.0.1:3000
}
```

Point a DNS A record at the VM's external IP, then:

```bash
sudo systemctl reload caddy
```

## 7 · Logs into Cloud Logging

Install the Ops Agent so container logs flow to Cloud Logging:

```bash
curl -sSO https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh
sudo bash add-google-cloud-ops-agent-repo.sh --also-install
```

Tail container logs:

```bash
docker compose logs -f
# or in Cloud Console: Logging → Logs Explorer
```

## 8 · Make it survive reboots

`/etc/systemd/system/openclaw.service`:

```ini
[Unit]
Description=OpenClaw
After=docker.service network.target
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/<your-user>/openclaw
ExecStart=/home/<your-user>/openclaw/start.sh
ExecStop=/usr/bin/docker compose down
User=<your-user>

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now openclaw
```

## 9 · Cost ceiling

`e2-micro` is free tier eligible in `us-west1`, `us-central1`, `us-east1` (one instance per project). Outside those: ~€5–8/mo. Set a [billing budget alert](https://cloud.google.com/billing/docs/how-to/budgets) at €20/mo so a runaway log fire doesn't surprise you.

## Where to next

- Hostinger if you want EU + cheaper → [04-deploy-vps-hostinger.md](04-deploy-vps-hostinger.md)
- Add cron heartbeats → [09-cron-and-heartbeat.md](09-cron-and-heartbeat.md)
- Production checklist → [10-troubleshooting.md](10-troubleshooting.md)
