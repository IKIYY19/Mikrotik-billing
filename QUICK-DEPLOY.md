# 🚀 Quick Deploy - MikroTik Config Builder

## Option 1: VPS (Easiest & Recommended)

### One-Command Deploy

```bash
# On your VPS (Ubuntu/Debian/CentOS)
git clone <your-repo-url>
cd mikrotik-config-builder
cp .env.example .env

# Generate secure keys
sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=$(openssl rand -hex 32)/" .env
sed -i "s/JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 64)/" .env  
sed -i "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$(openssl rand -hex 32)/" .env

# Deploy!
docker-compose -f docker-compose-simple.yml up -d
```

**Access:** `http://your-server-ip`

---

## Option 2: Fix Dokploy

### Issues Fixed ✅

1. ✅ **Database race condition** - Added retry loop with timeout (60 attempts)
2. ✅ **Better error handling** - Migrations won't crash the app if they fail
3. ✅ **Health checks** - Automatic monitoring of service status
4. ✅ **Improved logging** - Clear startup messages for debugging

### Dokploy Steps

1. **Create PostgreSQL database** in Dokploy
2. **Create Application** → Link your Git repo
3. **Set Docker Compose** to `dokploy-compose.yml`
4. **Add environment variables**:
   ```env
   JWT_SECRET=<generate: openssl rand -hex 64>
   ENCRYPTION_KEY=<generate: openssl rand -hex 32>
   CORS_ORIGIN=https://your-domain.com
   ```
5. **Link Database** to the app (Dokploy auto-injects DB_* vars)
6. **Deploy!**

---

## Common Commands

```bash
# View logs
docker-compose -f docker-compose-simple.yml logs -f

# Restart services
docker-compose -f docker-compose-simple.yml restart

# Check status
docker-compose -f docker-compose-simple.yml ps

# Update to latest
git pull && docker-compose -f docker-compose-simple.yml up -d --build

# Backup database
docker exec mikrotik-db pg_dump -U postgres mikrotik_config_builder > backup.sql
```

---

## Files Overview

| File | Purpose |
|------|---------|
| `docker-compose-simple.yml` | **VPS Deploy** - Everything in one file |
| `dokploy-compose.yml` | **Dokploy Deploy** - Fixed version |
| `Dockerfile.dokploy` | **Dokploy Image** - Improved build |
| `.env.example` | **Environment template** - Copy to .env |
| `deploy.sh` | **Auto-deploy script** - One-liner |
| `DEPLOYMENT.md` | **Full guide** - Detailed docs |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Database won't connect | Wait 30s, then `docker-compose restart server` |
| Port 80 in use | Change port: `- "8080:80"` in compose file |
| Blank page | Check browser console, verify API is running |
| Memory errors | Reduce limits in compose file for small VPS |

### Check Logs
```bash
docker-compose -f docker-compose-simple.yml logs server
docker-compose -f docker-compose-simple.yml logs postgres
docker-compose -f docker-compose-simple.yml logs client
```

---

## Server Requirements

- **RAM:** 2GB minimum (1GB works with tuning)
- **CPU:** 1 core minimum
- **Storage:** 10GB minimum
- **OS:** Ubuntu 20.04+, Debian 11+, CentOS 8+

---

## Need Help?

```bash
# Full documentation
cat DEPLOYMENT.md

# Check API health
curl http://localhost/api/health

# Manual database migration
docker exec mikrotik-server npm run db:migrate
```
