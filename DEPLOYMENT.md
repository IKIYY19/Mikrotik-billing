# Deployment Guide

Two deployment options are available: **VPS Docker Compose** (recommended) or **Dokploy**.

---

## Option 1: VPS Docker Compose (Recommended)

This is the simplest and most reliable method. Everything runs with one command.

### Prerequisites

- Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- Docker & Docker Compose installed
- At least 2GB RAM

### Step 1: Install Docker & Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Add your user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### Step 2: Clone & Configure

```bash
# Clone your repository
git clone <your-repo-url>
cd mikrotik-config-builder

# Copy environment template
cp .env.example .env

# Generate secure keys
echo "DB_PASSWORD=$(openssl rand -hex 32)" >> .env
echo "JWT_SECRET=$(openssl rand -hex 64)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env

# Review the .env file
nano .env
```

### Step 3: Deploy!

```bash
# Build and start all services
docker-compose -f docker-compose-simple.yml up -d

# Check status
docker-compose -f docker-compose-simple.yml ps

# View logs
docker-compose -f docker-compose-simple.yml logs -f
```

### Step 4: Access Your App

Open browser: `http://your-server-ip`

**That's it!** Your app is now running with:
- ✅ PostgreSQL database
- ✅ Backend API on port 5000 (internal only)
- ✅ Frontend on port 80 (public)
- ✅ Auto-restart on failure
- ✅ Database migrations run automatically

### Useful Commands

```bash
# View logs
docker-compose -f docker-compose-simple.yml logs -f server

# Restart services
docker-compose -f docker-compose-simple.yml restart

# Stop everything
docker-compose -f docker-compose-simple.yml down

# Update to latest version
git pull
docker-compose -f docker-compose-simple.yml up -d --build

# Backup database
docker run --rm -v pgdata:/data -v $(pwd):/backup alpine tar czf /backup/db-backup.tar.gz -C /data .

# Restore database
docker run --rm -v pgdata:/data -v $(pwd):/backup alpine tar xzf /backup/db-backup.tar.gz -C /data
```

---

## Option 2: Dokploy Deployment (with PostgreSQL)

Complete self-contained deployment with integrated PostgreSQL database.

### Prerequisites

1. Push your code to GitHub/GitLab
2. Ensure Dokploy is installed and running on your server
3. At least 1GB RAM available

### Step 1: Prepare Your Repository

1. Go to **Applications** → **New Application** in Dokploy
2. Select **Git Repository**
3. Enter your repository URL
4. Branch: `main` (or your branch)

### Step 2: Configure Build Settings

**Build Type:** Docker Compose

**Docker Compose File:** `dokploy-compose.yml`

The compose file includes both:
- PostgreSQL 15 database (persistent storage)
- Application server (frontend + backend)

### Step 3: Set Environment Variables

In Dokploy's environment variables section, add these required variables:

```env
# Database Password (generate: openssl rand -hex 32)
DB_PASSWORD=your_secure_database_password_here

# Security Keys (generate: openssl rand -hex 64)
JWT_SECRET=your_jwt_secret_key_change_this_to_random_64_chars

# Encryption Key (generate: openssl rand -hex 32)
ENCRYPTION_KEY=your_encryption_key_change_this_to_32_chars

# CORS - set to your domain (or http://your-server-ip)
CORS_ORIGIN=http://your-server-ip:3000
```

Optional integrations (leave blank if not using):

```env
# Africa's Talking SMS
AT_API_KEY=
AT_USERNAME=sandbox
AT_SENDER_ID=MyISP

# M-Pesa Payment
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=174379
MPESA_PASSKEY=

# WhatsApp Notifications
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
```

### Step 4: Deploy

1. Click **Deploy**
2. Wait for build to complete (~2-5 minutes)
3. Check logs for any errors
4. Access your app at: `http://your-server-ip:3000`

### How PostgreSQL Integration Works

The `dokploy-compose.yml` includes a complete PostgreSQL setup:

- **Database Service**: PostgreSQL 15 Alpine (lightweight)
- **Persistent Storage**: Data stored in `pgdata` volume (survives restarts)
- **Health Checks**: App waits for database to be ready before starting
- **Auto-Migrations**: Database schema created automatically on startup
- **Network Isolation**: Services communicate via internal Docker network

### Database Management Commands

```bash
# Access PostgreSQL shell
docker exec -it mikrotik-db psql -U postgres

# List databases
docker exec -it mikrotik-db psql -U postgres -c "\l"

# View database size
docker exec -it mikrotik-db psql -U postgres -c "SELECT pg_size_pretty(pg_database_size('mikrotik_config_builder'));"

# Backup database
docker exec mikrotik-db pg_dump -U postgres mikrotik_config_builder > backup.sql

# Restore database
docker exec -i mikrotik-db psql -U postgres mikrotik_config_builder < backup.sql

# View database logs
docker logs -f mikrotik-db
```

---

## SSL/HTTPS Setup (Recommended for Production)

### With Nginx Proxy Manager (Easiest)

```bash
# Install Nginx Proxy Manager
docker run -d \
  --name nginx-proxy-manager \
  -p 80:80 \
  -p 81:81 \
  -p 443:443 \
  -v npm-data:/data \
  -v npm-letsencrypt:/etc/letsencrypt \
  jc21/nginx-proxy-manager:latest

# Access admin panel: http://your-server-ip:81
# Default credentials: admin@example.com / changeme
```

Then configure:
1. Add Proxy Host: `your-domain.com` → `http://localhost:80`
2. Enable SSL and request certificate
3. Force HTTPS redirect

### With Certbot (Manual)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot certonly --standalone -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 3 * * * certbot renew --quiet
```

---

## Troubleshooting

### Database Connection Fails

```bash
# Check if database is running
docker-compose -f docker-compose-simple.yml ps postgres

# View database logs
docker-compose -f docker-compose-simple.yml logs postgres

# Test database connection
docker exec -it mikrotik-db psql -U postgres -d mikrotik_config_builder -c "SELECT 1"
```

### Server Won't Start

```bash
# Check server logs
docker-compose -f docker-compose-simple.yml logs server

# Common issues:
# 1. Database not ready - wait 30 seconds and restart
# 2. Port already in use - check with: sudo lsof -i :5000
# 3. Missing environment variables - check .env file
```

### Frontend Shows Blank Page

```bash
# Check if client is running
docker-compose -f docker-compose-simple.yml ps client

# View client logs
docker-compose -f docker-compose-simple.yml logs client

# Rebuild client
docker-compose -f docker-compose-simple.yml up -d --build client
```

### Migration Errors

```bash
# Run migrations manually
docker exec -it mikrotik-server npm run db:migrate

# Reset database (WARNING: deletes all data)
docker-compose -f docker-compose-simple.yml down -v
docker-compose -f docker-compose-simple.yml up -d
```

---

## Performance Tuning

### For Low-RAM Servers (1GB)

Edit `docker-compose-simple.yml` and reduce memory limits:

```yaml
deploy:
  resources:
    limits:
      memory: 384M  # instead of 512M
```

### Add Reverse Proxy Caching

```nginx
# Add to nginx config
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m;

location /api {
    proxy_cache api_cache;
    proxy_cache_valid 200 10m;
    proxy_pass http://localhost:5000;
}
```

---

## Monitoring & Backups

### Health Check Endpoints

```bash
# API Health
curl http://your-server-ip/api/health

# Expected response:
# {"status":"ok","timestamp":"...","database":"postgres"}
```

### Automated Backup Script

Create `backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/backups/mikrotik-builder"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
docker exec mikrotik-db pg_dump -U postgres mikrotik_config_builder | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: db_$DATE.sql.gz"
```

Add to crontab for daily backups:

```bash
crontab -e
# Add: 0 2 * * * /path/to/backup.sh
```

---

## Next Steps

1. ✅ **Test the app** - Create a project and generate scripts
2. 🔒 **Secure your installation** - Change default passwords
3. 📧 **Configure notifications** - Set up email/SMS integrations
4. 🔄 **Set up backups** - Don't lose your data!
5. 📊 **Monitor logs** - Check for errors regularly

---

## Support

For issues:
- Check logs: `docker-compose -f docker-compose-simple.yml logs -f`
- Review this guide's troubleshooting section
- Check MikroTik's official documentation for RouterOS syntax
- Open an issue on GitHub

---

**Deployment completed!** 🎉
