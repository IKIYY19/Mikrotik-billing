# Dokploy Deployment Troubleshooting Guide

## 🚨 Common Errors & Fixes

---

### ❌ Error 1: Build Fails with "vite: command not found"

**Problem:** Frontend build can't find vite

**Solution:**
```dockerfile
# In Dockerfile.dokploy, change:
RUN cd client && npm ci --omit=dev

# To:
RUN cd client && npm ci
```

**Why:** `npm ci --omit=dev` skips dev dependencies, but `vite` is a dev dependency needed for build.

---

### ❌ Error 2: Database Connection Timeout

**Problem:** "Database not available after X attempts"

**Possible Causes & Solutions:**

#### A. Database not starting
```bash
# Check database logs
docker logs mikrotik-db

# If you see permission errors:
docker exec mikrotik-db ls -la /var/lib/postgresql/data
```

#### B. Network issue
```bash
# Test if database is reachable from app
docker exec mikrotik-app nc -zv postgres 5432
```

#### C. Database health check failing
```bash
# Check database health
docker inspect --format='{{.State.Health.Status}}' mikrotik-db

# If unhealthy, restart it
docker restart mikrotik-db
```

---

### ❌ Error 3: Migration Failures

**Problem:** "npm run db:migrate failed"

**Solution:**
```bash
# Run migrations manually
docker exec -it mikrotik-app sh
cd /app/server
node src/db/migrate.js
node src/db/seed.js
exit
```

---

### ❌ Error 4: App Crashes on Startup

**Problem:** Container keeps restarting

**Debug Steps:**

1. **Check server logs:**
   ```bash
   docker logs mikrotik-app
   # OR
   docker exec mikrotik-app cat /var/log/server.err.log
   ```

2. **Check for missing environment variables:**
   ```bash
   docker exec mikrotik-app env | grep -E "DB_|JWT|ENCRYPTION"
   ```

3. **Test database connection:**
   ```bash
   docker exec -it mikrotik-app sh
   cd /app/server
   node -e "const db = require('./src/db'); db.query('SELECT 1').then(() => console.log('OK'))"
   ```

---

### ❌ Error 5: Permission Denied Errors

**Problem:** "Permission denied" in logs

**Solution:**
```bash
# Fix file permissions in Dockerfile (add before COPY):
RUN chown -R node:node /app
USER node
```

---

### ❌ Error 6: Out of Memory

**Problem:** Container killed by OOM killer

**Solution:** Increase memory limits in `dokploy-compose.yml`:
```yaml
deploy:
  resources:
    limits:
      memory: 1536M  # Increase from 1024M
```

---

### ❌ Error 7: Port Already in Use

**Problem:** "EADDRINUSE: address already in use"

**Solution:**
```bash
# Check what's using port 3000
sudo lsof -i :3000

# Change port in dokploy-compose.yml:
ports:
  - "8080:80"  # Use 8080 instead of 3000
```

---

## 🔍 How to Debug Dokploy Deployments

### 1. View Build Logs
In Dokploy dashboard → Your App → Build Logs

### 2. View Runtime Logs
```bash
# App logs
docker logs -f mikrotik-app

# Database logs
docker logs -f mikrotik-db

# Last 100 lines
docker logs --tail 100 mikrotik-app
```

### 3. Check Container Status
```bash
docker ps -a | grep mikrotik
```

### 4. Enter Container for Debugging
```bash
docker exec -it mikrotik-app sh
```

---

## ✅ Complete Working Configuration

### Required Environment Variables

| Variable | Required | Example |
|----------|----------|---------|
| `DB_PASSWORD` | ✅ Yes | `abc123def456...` (32+ chars) |
| `JWT_SECRET` | ✅ Yes | `xyz789...` (64+ chars) |
| `ENCRYPTION_KEY` | ✅ Yes | `key123...` (32+ chars) |
| `CORS_ORIGIN` | ✅ Yes | `http://your-server-ip:3000` |
| `DB_HOST` | Auto-set | `postgres` (don't change) |
| `DB_PORT` | Auto-set | `5432` (don't change) |

### Generate Secure Keys

```bash
# Database password
openssl rand -hex 32

# JWT secret
openssl rand -hex 64

# Encryption key
openssl rand -hex 32
```

---

## 🚀 Fresh Deploy Steps

If your deployment is broken, start fresh:

### 1. Stop Everything
```bash
docker stop mikrotik-app mikrotik-db
docker rm mikrotik-app mikrotik-db
```

### 2. Clear Old Data (WARNING: Deletes everything!)
```bash
docker volume rm mikrotik-config-builder_pgdata
```

### 3. Redeploy from Dokploy
1. Go to Dokploy dashboard
2. Click "Redeploy" or push a new commit
3. Wait for build to complete

### 4. Check Logs
```bash
docker logs -f mikrotik-app
```

Look for:
```
✅ Using PostgreSQL database
✅ Core migrations done
✅ Billing migrations done
✅ Default admin created: admin@example.com
🚀 Server running on port 5000
```

---

## 📊 Health Check URLs

```bash
# API Health
curl http://localhost:3000/api/health

# Expected Response:
# {"status":"ok","timestamp":"...","database":"postgres"}
```

---

## 🐛 Common Build Errors

### "ENOENT: no such file or directory"

**Cause:** Missing files in Docker context

**Fix:** Ensure these files exist:
```
.
├── server/
│   ├── package.json
│   └── src/
├── client/
│   ├── package.json
│   └── src/
├── Dockerfile.dokploy
├── dokploy-compose.yml
└── supervisord.conf
```

### "npm ERR! code ERESOLVE"

**Cause:** Dependency conflicts

**Fix:** Add to Dockerfile before npm install:
```dockerfile
RUN cd server && npm ci --omit=dev --legacy-peer-deps
RUN cd client && npm ci --legacy-peer-deps
```

### "Cannot find module './routes/auth'"

**Cause:** Missing or corrupted files

**Fix:** 
```bash
git status
git diff server/src/routes/auth.js
git checkout server/src/routes/auth.js
```

---

## 💡 Tips for Success

1. **Always check logs first** - 90% of issues are visible in logs
2. **Use environment variables** - Don't rely on defaults in production
3. **Test locally first** - Run `docker-compose -f dokploy-compose.yml up` locally
4. **One change at a time** - Don't change multiple things at once
5. **Document your changes** - Keep track of what you modified

---

## 🆘 Still Not Working?

### Collect This Info:

1. **Build logs** (from Dokploy dashboard)
2. **Runtime logs** (`docker logs mikrotik-app`)
3. **Environment variables** (redact sensitive values)
4. **Docker Compose file** (`dokploy-compose.yml`)
5. **Error messages** (exact text)

### Then Check:

```bash
# Is database running?
docker ps | grep mikrotik-db

# Is app running?
docker ps | grep mikrotik-app

# Can app reach database?
docker exec mikrotik-app nc -zv postgres 5432

# Database health?
docker inspect --format='{{.State.Health.Status}}' mikrotik-db
```

---

**Need more help?** Share your exact error message and logs!
