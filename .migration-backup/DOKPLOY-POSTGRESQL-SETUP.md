# Dokploy + PostgreSQL Setup Guide

Quick reference for deploying your MikroTik Config Builder with PostgreSQL on Dokploy.

## 🚀 Quick Start (5 Steps)

### 1️⃣ Generate Secure Keys

Run these commands on your server or local machine:

```bash
# Generate database password
echo "DB_PASSWORD=$(openssl rand -hex 32)"

# Generate JWT secret
echo "JWT_SECRET=$(openssl rand -hex 64)"

# Generate encryption key
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
```

Copy these values - you'll need them in step 3.

### 2️⃣ Push Code to Git Repository

```bash
git add .
git commit -m "Update Dokploy PostgreSQL configuration"
git push origin main
```

### 3️⃣ Create Application in Dokploy

1. **Go to:** Applications → New Application
2. **Source:** Git Repository
3. **Repository URL:** `https://github.com/your-username/your-repo.git`
4. **Branch:** `master`
5. **Build Type:** Docker Compose
6. **Docker Compose File:** `dokploy-compose.yml`

### 4️⃣ Add Environment Variables

In Dokploy → Your App → Environment Variables, add:

| Variable | Value | Description |
|----------|-------|-------------|
| `DB_PASSWORD` | *(from step 1)* | Database password |
| `JWT_SECRET` | *(from step 1)* | JWT authentication secret |
| `ENCRYPTION_KEY` | *(from step 1)* | Data encryption key |
| `CORS_ORIGIN` | `http://your-server-ip:3000` | Your app URL |

Optional (leave blank if not using):
- `AT_API_KEY` - Africa's Talking API key
- `MPESA_CONSUMER_KEY` - M-Pesa integration
- `WHATSAPP_ACCESS_TOKEN` - WhatsApp notifications

### 5️⃣ Deploy!

1. Click **Deploy**
2. Wait 2-5 minutes for build
3. Access your app at: `http://your-server-ip:3000`

---

## 📊 Architecture

```
┌─────────────────────────────────────┐
│         Dokploy Server              │
│                                     │
│  ┌──────────────┐  ┌─────────────┐ │
│  │   PostgreSQL │  │   App       │ │
│  │   Database   │◄─┤  Container  │ │
│  │  (Port 5432) │  │  (Port 80)  │ │
│  │              │  │             │ │
│  │  • pgdata    │  │  • Nginx    │ │
│  │    volume    │  │  • Node.js  │ │
│  └──────────────┘  └──────┬──────┘ │
│                           │        │
└───────────────────────────┼────────┘
                            │
                     Port 3000
                            │
                            ▼
                    User's Browser
```

---

## 🔧 What's Included

### PostgreSQL Database
- ✅ PostgreSQL 15 Alpine (lightweight)
- ✅ Persistent storage (pgdata volume)
- ✅ Automatic health checks
- ✅ Auto-restart on failure
- ✅ Memory limit: 512MB

### Application Server
- ✅ Nginx reverse proxy (frontend)
- ✅ Node.js API server (backend)
- ✅ Automatic database migrations
- ✅ Health monitoring
- ✅ Memory limit: 768MB

### Integration Features
- ✅ App waits for database before starting
- ✅ Auto-run migrations on deployment
- ✅ Deployment stops immediately if migrations or seed fail
- ✅ Internal Docker network (secure)
- ✅ Graceful error handling

---

## 🛠️ Common Commands

### View Logs

```bash
# Application logs
docker logs -f mikrotik-app

# Database logs
docker logs -f mikrotik-db

# Last 50 lines
docker logs --tail 50 mikrotik-app
```

### Database Management

```bash
# Access PostgreSQL shell
docker exec -it mikrotik-db psql -U postgres

# List all databases
docker exec -it mikrotik-db psql -U postgres -c "\l"

# Connect to database
docker exec -it mikrotik-db psql -U postgres -d mikrotik_config_builder

# View tables
docker exec -it mikrotik-db psql -U postgres -d mikrotik_config_builder -c "\dt"

# View database size
docker exec -it mikrotik-db psql -U postgres -c \
  "SELECT pg_size_pretty(pg_database_size('mikrotik_config_builder'));"
```

### Backup & Restore

```bash
# Backup database
docker exec mikrotik-db pg_dump -U postgres mikrotik_config_builder | gzip > db-backup.sql.gz

# Restore database
gunzip < db-backup.sql.gz | docker exec -i mikrotik-db psql -U postgres mikrotik_config_builder

# Backup with timestamp
docker exec mikrotik-db pg_dump -U postgres mikrotik_config_builder | gzip > \
  "backup-$(date +%Y%m%d_%H%M%S).sql.gz"
```

### Troubleshooting

```bash
# Check if services are running
docker ps | grep mikrotik

# Restart application
docker restart mikrotik-app

# Restart database (WARNING: may cause app restart too)
docker restart mikrotik-db

# Check database health
docker exec mikrotik-db pg_isready -U postgres

# Test database connection from app
docker exec mikrotik-app nc -zv postgres 5432

# View resource usage
docker stats mikrotik-app mikrotik-db
```

---

## 🐛 Troubleshooting

### App Won't Start

**Problem:** "ERROR: Database not available after 60 attempts"

**Solution:**
```bash
# Check if database is running
docker ps | grep mikrotik-db

# Check database logs
docker logs mikrotik-db

# Restart database
docker restart mikrotik-db

# Then restart app
docker restart mikrotik-app
```

### Database Connection Errors

**Problem:** "Database connection failed" or "pg_isready" fails

**Solution:**
```bash
# Verify database password matches
# In Dokploy: Check DB_PASSWORD environment variable

# Reset database (WARNING: deletes all data!)
docker stop mikrotik-app mikrotik-db
docker rm mikrotik-app mikrotik-db
docker volume rm mikrotik-config-builder_pgdata
# Then redeploy from Dokploy
```

### Migration Failures

**Problem:** Deployment stops after migration or seed step fails

**Solution:**
```bash
# Run migrations manually
docker exec -it mikrotik-app sh
cd /app/server
npm run db:migrate
npm run db:seed
exit

# Check migration logs
docker logs mikrotik-app | grep -i migrat
```

Dokploy now fails fast on these steps by design. That is safer for production because the app will not boot against a partially initialized database.

### Out of Memory

**Problem:** Container gets killed

**Solution:**
```bash
# Check memory usage
docker stats mikrotik-app mikrotik-db

# If app is using too much, increase limit in dokploy-compose.yml
# Change: memory: 768M → memory: 1024M

# If database is using too much, consider:
# - Reducing max connections
# - Running VACUUM: docker exec mikrotik-db psql -U postgres -d mikrotik_config_builder -c "VACUUM FULL;"
```

---

## 🔒 Security Checklist

- [x] Changed `DB_PASSWORD` from default
- [x] Changed `JWT_SECRET` from default
- [x] Changed `ENCRYPTION_KEY` from default
- [ ] Set `CORS_ORIGIN` to your domain (not *)
- [ ] Configured SSL/HTTPS (see DEPLOYMENT.md)
- [ ] Set up regular backups
- [ ] Restricted server access (firewall)
- [ ] Updated all dependencies

---

## 📈 Monitoring

### Health Check Endpoint

```bash
# Check API health
curl http://localhost:3000/api/health

# Expected response:
# {"status":"ok","timestamp":"...","database":"postgres"}
```

### Setup Automated Backups

Create a backup script on your server:

```bash
#!/bin/bash
# File: /opt/backup-mikrotik.sh

BACKUP_DIR="/backups/mikrotik-db"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

mkdir -p $BACKUP_DIR

# Backup database
docker exec mikrotik-db pg_dump -U postgres mikrotik_config_builder | gzip > \
  "$BACKUP_DIR/db-$DATE.sql.gz"

# Remove old backups
find $BACKUP_DIR -name "db-*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: db-$DATE.sql.gz"
```

Make executable and add to cron:

```bash
chmod +x /opt/backup-mikrotik.sh

# Daily backup at 2 AM
crontab -e
# Add: 0 2 * * * /opt/backup-mikrotik.sh >> /var/log/mikrotik-backup.log 2>&1
```

---

## 🎯 Next Steps

After successful deployment:

1. ✅ **Test the app** - Create a project and generate MikroTik scripts
2. 🔒 **Enable SSL** - Follow SSL section in DEPLOYMENT.md
3. 📧 **Configure notifications** - Add SMS/WhatsApp API keys
4. 🔄 **Set up backups** - Use the backup script above
5. 📊 **Monitor logs** - Check `docker logs -f mikrotik-app` regularly

---

## 📚 Resources

- [Main DEPLOYMENT.md](./DEPLOYMENT.md) - Full deployment guide
- [Dokploy Documentation](https://dokploy.com/docs) - Official Dokploy docs
- [PostgreSQL Documentation](https://www.postgresql.org/docs/) - Database reference

---

**Need help?** Check the troubleshooting section or run: `docker logs -f mikrotik-app`
