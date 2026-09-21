# Deploying Workspace in Demo Mode on a VPS

This guide explains how to deploy **Workspace** in **Demo Mode** on your VPS.

Demo Mode is specially engineered for public demonstrations, client walkthroughs, and portfolio showcases. It gives visitors a live interactive sandbox while keeping your server secure and isolated.

---

## 🌟 Demo Mode Highlights

- **1-Click Demo Login:** Visitors don’t need to remember or type credentials. A clean **"Enter"** button lets anyone sign in immediately with one click.
- **Pre-Seeded Sample Data:** First launch automatically seeds realistic reminders, expenses, pinned notes, and encrypted project environment secrets.
- **Interactive Sandbox:** Visitors can create, edit, pause, or delete items to test the full product surface.
- **Top Banner with Instant Reset:** A persistent banner lets visitors or admins click **"Reset Demo Data"** at any time to return the workspace to its clean initial state.
- **Zero Third-Party Dependency:** Email and Telegram notifications are safely simulated in the background worker and provider test endpoints. No SMTP accounts or Telegram bot tokens are required, and no outbound spam is sent.
- **Restoration Guard:** Arbitrary backup uploads are blocked in Demo Mode to prevent visitors from overwriting or corrupting the database.

---

## 🚀 Quickstart: Deploy on your VPS

### Step 1: Connect to your VPS and install Docker

Ensure your VPS has Docker Engine and Docker Compose v2 installed (e.g. on Ubuntu 24.04 / 22.04):

```bash
sudo apt update && sudo apt install -y curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
```

### Step 2: Clone the repository

```bash
git clone <your-repo-url> workspace
cd workspace
```

### Step 3: Configure Demo Mode

Copy the pre-configured demo environment template:

```bash
cp .env.demo.example .env
```

Open `.env` in your editor (`nano .env`):

```bash
nano .env
```

Key values to review:

- `DEMO_MODE=true` _(Enables demo mode)_
- `APP_BASE_URL`: Set to your public domain or VPS IP (e.g. `https://demo.yourdomain.com` or `http://198.51.100.25:1234`).
- `APP_HOST`:
  - Keep `0.0.0.0` if you want to access the app directly via `http://<YOUR_VPS_IP>:1234` without a reverse proxy.
  - Set to `127.0.0.1` if you are using Caddy or Nginx as a reverse proxy.

### Step 4: Build and start the stack

```bash
docker compose up --build -d
```

Check service status:

```bash
docker compose ps
```

Verify health endpoints:

```bash
curl http://localhost:1234/api/health/ready
```

You should receive `{"ok":true,"database":"connected","migrations":"current"}`.

Visit your VPS IP or domain in your browser:

- Open `http://<YOUR_VPS_IP>:1234`
- Click **"Enter"** on the login screen.
- You are now inside the interactive Workspace demo!

---

## 🔒 Domain & HTTPS (Reverse Proxy)

For a production-grade public demo on a domain (e.g. `https://demo.yourdomain.com`), use Caddy or Nginx with Let's Encrypt TLS.

### Option A: Caddy (Recommended — Zero Config HTTPS)

1. Set `APP_HOST=127.0.0.1` and `APP_BASE_URL=https://demo.yourdomain.com` in `.env`.
2. Install Caddy on the VPS:
   ```bash
   sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt update && sudo apt install -y caddy
   ```
3. Edit `/etc/caddy/Caddyfile`:
   ```caddy
   demo.yourdomain.com {
       reverse_proxy 127.0.0.1:1234
   }
   ```
4. Reload Caddy:
   ```bash
   sudo systemctl reload caddy
   ```

Caddy will automatically provision and renew a free Let's Encrypt SSL certificate.

---

### Option B: Nginx + Certbot

1. Edit `/etc/nginx/sites-available/demo`:
   ```nginx
   server {
       server_name demo.yourdomain.com;

       location / {
           proxy_pass http://127.0.0.1:1234;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
2. Enable site and get SSL:
   ```bash
   sudo ln -s /etc/nginx/sites-available/demo /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d demo.yourdomain.com
   ```

---

## 🔄 Automated Periodic Demo Reset (Cron)

If you want the demo data to reset automatically (e.g. every night at midnight or every 6 hours) so test data left by visitors doesn't accumulate:

Add a cron job on your VPS:

```bash
crontab -e
```

Add this line to reset demo data daily at midnight:

```cron
0 0 * * * cd /path/to/workspace && docker compose exec -T web node /app/runtime/db/dist/seed-demo-cli.js > /dev/null 2>&1
```

Or reset every 6 hours:

```cron
0 */6 * * * cd /path/to/workspace && docker compose exec -T web node /app/runtime/db/dist/seed-demo-cli.js > /dev/null 2>&1
```

You can also run it manually anytime directly on the VPS:

```bash
docker compose exec web node /app/runtime/db/dist/seed-demo-cli.js
```

---

## 🛠️ Switching Back to Private Production Mode

To turn this deployment into your private personal instance:

1. In `.env`:
   - Change `DEMO_MODE=false`
   - Set a strong, private `AUTH_PASSWORD` (min 8 characters)
   - Add your real SMTP and Telegram credentials if notifications are desired.
2. Restart the stack:
   ```bash
   docker compose down
   # Optional: wipe demo volume if you want a fresh private start
   # docker volume rm workspace_workspace_db_data
   docker compose up -d
   ```
