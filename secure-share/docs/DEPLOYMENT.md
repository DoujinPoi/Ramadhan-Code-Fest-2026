# SecureShare Deployment Guide

Complete guide for deploying SecureShare on a VPS using Docker with domain configuration.

---

## Prerequisites

### VPS Requirements
| Minimum | Recommended |
|---------|-------------|
| 1 CPU | 2+ CPU |
| 1GB RAM | 2GB+ RAM |
| 20GB Storage | 40GB+ SSD |
| Ubuntu 22.04/24.04 | Ubuntu 24.04 LTS |

### Required
- Domain name (e.g., `yourdomain.com`)
- VPS with root/sudo access
- Domain DNS pointing to your VPS IP

---

## Initial VPS Setup

### Connect to your VPS
```bash
ssh root@your-vps-ip
```

### Update system
```bash
apt update && apt upgrade -y
```

### Install required packages
```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Add current user to docker group
usermod -aG docker $USER

# Install other utilities
apt install -y git curl wget nano ufw
```

### Configure firewall
```bash
# Allow SSH
ufw allow 22/tcp

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw enable
```

---

## Clone and Configure

### Clone the repository
```bash
# Create app directory
mkdir -p /opt/secureshare
cd /opt/secureshare

# Clone your repository (or upload files)
git clone 
```

### Create environment file
```bash
# Copy example to .env
cp .env.production .env

# Edit the file
nano .env
```

### Generate secrets
```bash
# Generate CLEANUP_SECRET
echo "CLEANUP_SECRET=\"$(openssl rand -base64 32)\"" >> .env
```

### Update Caddyfile with your domain
```bash
# Replace 'yourdomain.com' with your actual domain
sed -i 's/share.yourdomain.com/share.YOURACTUALDOMAIN.com/g' Caddyfile
```

---

## DNS Configuration

### Add DNS Records

Go to your domain registrar (Cloudflare, Namecheap, GoDaddy, etc.) and add:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | share | YOUR_VPS_IP | Auto |
| A | www.share | YOUR_VPS_IP | Auto |

**Example:**
| Type | Name | Value |
|------|------|-------|
| A | share | 123.45.67.89 |
| A | www.share | 123.45.67.89 |

### Verify DNS propagation
```bash
# Check if DNS is working
dig share.yourdomain.com +short

# Should return your VPS IP
```

---

## Deploy with Docker

### Build and start containers
```bash
cd /opt/secureshare

# Build and start all services
docker compose up -d --build
```

### Check container status
```bash
docker compose ps
```

### View logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f app
docker compose logs -f caddy
```

### Initialize database
```bash
# Run Prisma migrations inside container
docker compose exec app npx prisma db push
```

---

## SSL Certificate (Automatic)

Caddy automatically obtains and renews SSL certificates via Let's Encrypt!

### Verify SSL
```bash
# Check if certificate is obtained
docker compose logs caddy | grep -i certificate

# Test your site
curl -I https://share.yourdomain.com
```

---

## Maintenance Commands

### Update deployment
```bash
cd /opt/secureshare

# Pull latest changes
git pull

# Rebuild and restart
docker compose up -d --build
```

### Restart services
```bash
docker compose restart
```

### Stop services
```bash
docker compose down
```

### View resource usage
```bash
docker stats
```

### Backup database
```bash
# Create backup directory
mkdir -p /opt/backups

# Backup database
docker compose exec app cp /app/db/production.db /app/db/backup.db
docker cp secureshare-app:/app/db/backup.db /opt/backups/secureshare-$(date +%Y%m%d).db
```

---

## Monitoring & Logs

### Set up log rotation
```bash
# Create logrotate config
cat > /etc/logrotate.d/secureshare << 'EOF'
/var/log/secureshare/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 root root
    sharedscripts
    postrotate
        docker compose -f /opt/secureshare/docker-compose.yml restart caddy
    endscript
}
EOF
```

### Health check script
```bash
# Create health check script
cat > /opt/secureshare/healthcheck.sh << 'EOF'
#!/bin/bash
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://share.yourdomain.com/api/files)
if [ "$RESPONSE" != "200" ]; then
    echo "Health check failed! Response: $RESPONSE"
    # Send notification (configure your webhook)
    # curl -X POST -H 'Content-Type: application/json' \
    #   -d '{"text":"SecureShare is down!"}' \
    #   YOUR_WEBHOOK_URL
    exit 1
fi
echo "Health check passed!"
EOF

chmod +x /opt/secureshare/healthcheck.sh

# Add to crontab (check every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/secureshare/healthcheck.sh >> /var/log/secureshare/health.log 2>&1") | crontab -
```

---

## Security Hardening

### Additional firewall rules
```bash
# Rate limit connections
ufw limit 22/tcp

# Block common attack ports
ufw deny 23
ufw deny 25
ufw deny 3389
```

### Install fail2ban
```bash
apt install -y fail2ban

# Enable and start
systemctl enable fail2ban
systemctl start fail2ban
```

### Secure SSH
```bash
# Edit SSH config
nano /etc/ssh/sshd_config

# Recommended changes:
# Port 2222 (change default port)
# PermitRootLogin no
# PasswordAuthentication no
# PubkeyAuthentication yes

# Restart SSH
systemctl restart sshd
```

---

## Cloudflare Turnstile Setup (Recommended)

### Get Turnstile keys
1. Go to [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile)
2. Click "Add site"
3. Enter your domain: `share.yourdomain.com`
4. Copy Site Key and Secret Key

### Add to environment
```bash
nano /opt/secureshare/.env

# Add these lines:
NEXT_PUBLIC_TURNSTILE_SITE_KEY="your-site-key-here"
TURNSTILE_SECRET_KEY="your-secret-key-here"
```

### Restart containers
```bash
docker compose restart
```

---

## Troubleshooting

### Container won't start
```bash
# Check logs
docker compose logs app

# Common issues:
# - Port already in use: lsof -i :3000
# - Permission issues: docker compose down && docker compose up -d
```

### SSL certificate issues
```bash
# Check Caddy logs
docker compose logs caddy

# Force certificate renewal
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

### Database issues
```bash
# Reset database (WARNING: deletes all data)
docker compose exec app npx prisma db push --force-reset
```

### DNS not resolving
```bash
# Check DNS
nslookup share.yourdomain.com
dig share.yourdomain.com

# Wait for propagation (can take up to 48 hours)
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Start | `docker compose up -d` |
| Stop | `docker compose down` |
| Restart | `docker compose restart` |
| Logs | `docker compose logs -f` |
| Update | `git pull && docker compose up -d --build` |
| Status | `docker compose ps` |
| Shell | `docker compose exec app sh` |
| Backup | `docker cp secureshare-app:/app/db/production.db ./backup.db` |

---

## One-Command Deploy Script

Create a deployment script:

```bash
cat > /opt/secureshare/deploy.sh << 'EOF'
#!/bin/bash
set -e

echo " Deploying SecureShare..."

cd /opt/secureshare

# Pull latest changes
echo " Pulling latest changes..."
git pull

# Rebuild and restart
echo " Rebuilding containers..."
docker compose down
docker compose up -d --build

# Wait for health check
echo " Waiting for application to start..."
sleep 10

# Health check
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://share.yourdomain.com/api/files)
if [ "$RESPONSE" = "200" ]; then
    echo "Deployment successful!"
else
    echo "Warning: Health check returned $RESPONSE"
fi

echo " Done!"
EOF

chmod +x /opt/secureshare/deploy.sh
```

---

##  Checklist

- [ ] VPS provisioned and accessible
- [ ] Docker installed
- [ ] Firewall configured (ports 22, 80, 443)
- [ ] Domain DNS pointing to VPS IP
- [ ] Repository cloned to `/opt/secureshare`
- [ ] `.env` file configured
- [ ] Caddyfile updated with domain
- [ ] Cloudflare Turnstile configured (optional)
- [ ] SSL certificate obtained
- [ ] Health check working
- [ ] Backup script configured

---

