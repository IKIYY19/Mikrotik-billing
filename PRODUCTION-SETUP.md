# 🚀 Production Setup Guide - Railway.app

## ✅ Current Status

Your app is now deployed and the **frontend is working**! Here's what's running:

```
┌─────────────────────────────────────────┐
│  Railway Deployment                     │
├─────────────────────────────────────────┤
│  ✅ Frontend (React) - Working!         │
│  ✅ Backend API - Running on same port  │
│  ⚠️  Database - Need to connect PG      │
└─────────────────────────────────────────┘
```

---

## 🔗 How Frontend + Backend Are Combined

Your app uses a **single-service architecture**:

```
Request → Railway Port (5000)
    ↓
Express Server (server/src/index.js)
    ↓
    ├─ Serves React files (static)
    ├─ Handles /api/* routes (backend)
    └─ SPA routing (/* → index.html)
```

**This is already working!** The server:
1. Serves your React app from `client/dist`
2. Handles all `/api/*` requests
3. Supports React Router (SPA routing)

---

## 🗄️ Connect PostgreSQL Database

### Step 1: Add PostgreSQL in Railway

1. Go to your Railway project dashboard
2. Click **"+ New"** button
3. Select **"Database"** → **"Add PostgreSQL"**
4. Railway will provision a database (takes ~1 min)

### Step 2: Verify Database Connection

Railway automatically injects these environment variables:
- `DATABASE_URL` (full connection string)
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`

**Your app already supports these!** No code changes needed.

### Step 3: Run Database Migrations

The migrations need to run manually since Railway doesn't auto-run them:

**Option A: Via Railway Shell (Recommended)**
1. Go to your service → **Shell** tab
2. Run:
   ```bash
   cd server
   npm run db:migrate
   npm run db:seed
   ```

**Option B: Via Railway CLI**
```bash
railway run -- bash -c "cd server && npm run db:migrate && npm run db:seed"
```

### Step 4: Verify Database

Check Railway logs for:
```
✅ Using PostgreSQL database
```

Instead of:
```
⚠️ PostgreSQL not available, using in-memory storage
```

---

## ⚙️ Environment Variables Setup

Go to your service → **Variables** tab and set:

### Required Variables:
```env
# Database - Railway auto-injects these (don't manually set)
# DATABASE_URL - auto-set by Railway
# PGHOST, PGPORT, etc. - auto-set by Railway

# Security - GENERATE NEW ONES!
JWT_SECRET=<run-in-shell: openssl rand -hex 64>
ENCRYPTION_KEY=<run-in-shell: openssl rand -hex 32>

# CORS - Your Railway domain
CORS_ORIGIN=https://your-domain.railway.app
```

### Optional Integrations:
```env
# SMS (Africa's Talking)
AT_API_KEY=
AT_USERNAME=sandbox
AT_SENDER_ID=MyISP

# Payments (M-Pesa)
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=174379
MPESA_PASSKEY=

# WhatsApp
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
```

**⚠️ Important:** 
- Generate secure keys using the Railway shell or locally with `openssl`
- Don't commit secrets to Git
- Railway encrypts all env vars at rest

---

## 🧪 Test Your Setup

### 1. Test Frontend
```
Visit: https://your-domain.railway.app
Expected: Your React app loads
```

### 2. Test Backend API
```
Visit: https://your-domain.railway.app/api/health
Expected: 
{
  "status": "ok",
  "timestamp": "2024-...",
  "database": "postgres"
}
```

**Note:** `database: "postgres"` means your database is connected!
**If you see:** `database: "memory"` - Database isn't connected yet

### 3. Test API Routes
```bash
# Test projects endpoint
curl https://your-domain.railway.app/api/projects

# Should return: []
(empty array means working, just no projects yet)
```

### 4. Test App Functionality
1. Create a new project in the UI
2. Configure a module (e.g., Interfaces)
3. Generate a script
4. Check if it saves (look for success message)

---

## 🔍 Troubleshooting

### Database Still Shows "memory"

**Check 1: Are env vars set?**
```bash
# In Railway Shell
echo $DATABASE_URL
echo $PGHOST
```

**Check 2: Can server connect?**
Look in logs for:
```
✅ Using PostgreSQL database  ← GOOD
⚠️ PostgreSQL not available   ← BAD
```

**Check 3: Run migrations**
```bash
cd server && npm run db:migrate
```

**Common Issue:** Database SSL certificate
- Railway requires SSL in production
- ✅ Already fixed in code (ssl: { rejectUnauthorized: false })

### API Returns 404 or Errors

**Check 1: Is API route correct?**
Your app has these endpoints:
```
GET  /api/health              ← Health check
POST /api/projects            ← Create project
GET  /api/projects            ← List projects
POST /api/generator/generate  ← Generate script
```

**Check 2: CORS settings**
Make sure `CORS_ORIGIN` matches your Railway domain exactly:
```
✅ https://myapp.up.railway.app
❌ http://myapp.up.railway.app  (missing s)
❌ https://myapp.railway.app    (missing up)
```

### Frontend Works But Can't Save Data

This means:
- ✅ Frontend is serving
- ❌ API calls are failing

**Debug steps:**
1. Open browser console (F12)
2. Try to create a project
3. Look for red errors in console
4. Check Network tab for failed requests

**Common fix:** Update `CORS_ORIGIN` env variable

---

## 📊 Production Checklist

- [ ] PostgreSQL database added in Railway
- [ ] Database migrations run (`npm run db:migrate`)
- [ ] Database seeds run (optional: `npm run db:seed`)
- [ ] `JWT_SECRET` set (secure random string)
- [ ] `ENCRYPTION_KEY` set (secure random string)
- [ ] `CORS_ORIGIN` set to your Railway domain
- [ ] Health check returns `"database": "postgres"`
- [ ] Can create a project in the UI
- [ ] Can generate a MikroTik script
- [ ] Custom domain added (optional)

---

## 🔒 Security Hardening

### 1. Generate Strong Secrets
```bash
# In Railway Shell:
openssl rand -hex 64  # For JWT_SECRET
openssl rand -hex 32  # For ENCRYPTION_KEY
```

### 2. Enable Railway Private Networking
- Railway services on same project auto-connect privately
- No public database port exposure

### 3. Set CORS Properly
```env
CORS_ORIGIN=https://your-domain.railway.app
```

**Not:** `*` or `http://localhost:5173`

### 4. Database Password
- Railway auto-generates strong passwords
- Don't change them manually

### 5. Environment Variables
- Never commit to Git
- Use Railway's encrypted variables
- Rotate secrets periodically

---

## 🚀 Advanced: Custom Domain

1. Go to **Settings** → **Networking**
2. Click **"Add Domain"**
3. Enter: `app.yourdomain.com`
4. Railway shows DNS records to add
5. Go to your domain registrar (Namecheap, Cloudflare, etc.)
6. Add CNAME record as shown
7. Wait for DNS propagation (5 min - 48 hrs)
8. Update `CORS_ORIGIN` to new domain

---

## 📈 Monitoring & Maintenance

### View Logs
```bash
# In Railway dashboard
# Go to Deployments → Click latest deployment → Logs

# Or via CLI
railway logs
```

### What to Monitor
- ✅ Health check: `/api/health` returns `postgres`
- ✅ No repeated error logs
- ✅ Database migrations succeeded
- ✅ Server started successfully

### Database Backups
Railway auto-backups PostgreSQL databases.
To manually backup:
```bash
railway run -- pg_dump $DATABASE_URL > backup.sql
```

### Restarting Service
```bash
railway service restart
```

---

## 🎯 What's Production-Ready?

### ✅ Already Working
- Frontend served correctly
- Backend API routes
- SPA routing (React Router)
- CORS configuration
- PostgreSQL connection support
- Health check endpoint
- Error handling

### ⚠️ Need to Configure
- Database connection (add PostgreSQL in Railway)
- Run migrations
- Security keys (JWT_SECRET, ENCRYPTION_KEY)
- CORS origin (set to your domain)

### 📝 Optional Enhancements
- Custom domain
- Automated backups
- Rate limiting
- API authentication
- Email notifications
- Monitoring/alerting

---

## 🆘 Quick Commands Reference

### Railway CLI
```bash
# Login
railway login

# Link project
railway link

# View logs
railway logs

# Run command in service
railway run -- bash -c "cd server && npm run db:migrate"

# Open dashboard
railway open

# View variables
railway variables

# Set variable
railway variables set KEY=VALUE

# Restart
railway service restart
```

### Database
```bash
# Connect to database
railway run -- psql $DATABASE_URL

# Backup
railway run -- pg_dump $DATABASE_URL > backup.sql

# Restore
railway run -- psql $DATABASE_URL < backup.sql
```

---

## 🎉 You're Almost There!

**Your app is 80% production-ready!**

Just need to:
1. ✅ Add PostgreSQL database in Railway
2. ✅ Run migrations
3. ✅ Set security keys
4. ✅ Update CORS origin

After that, you're **100% production-ready!** 🚀

---

## 📚 Additional Resources

- Railway Docs: https://docs.railway.app
- PostgreSQL on Railway: https://docs.railway.app/databases/postgresql
- Your Repository: https://github.com/IKIYY19/Mikrotik-billing
