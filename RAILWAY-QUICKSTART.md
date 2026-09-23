# ⚡ Railway Production - Quick Setup (5 minutes)

## 🎯 4 Steps to Go Production

### Step 1: Add Database (2 min)
1. Railway Dashboard → **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Wait 1 minute for provisioning

### Step 2: Run Migrations (1 min)
1. Go to your service → **"Shell"** tab
2. Run:
   ```bash
   cd server && npm run db:migrate && npm run db:seed
   ```

### Step 3: Set Environment Variables (1 min)
Go to **"Variables"** tab and add:

```env
JWT_SECRET=<generate random string>
ENCRYPTION_KEY=<generate random string>
CORS_ORIGIN=https://your-app.up.railway.app
```

**Generate keys:**
```bash
# In Railway Shell:
openssl rand -hex 64  # For JWT_SECRET
openssl rand -hex 32  # For ENCRYPTION_KEY
```

### Step 4: Verify (1 min)
Visit: `https://your-app.up.railway.app/api/health`

**Expected:**
```json
{
  "status": "ok",
  "database": "postgres"
}
```

✅ **Done!** Your app is production-ready!

---

## 🔍 Quick Checks

| Check | URL/Command | Expected |
|-------|-------------|----------|
| Frontend | `https://your-app.up.railway.app` | Your app loads |
| Backend API | `/api/health` | `{"database": "postgres"}` |
| Create Project | Use the UI | Saves successfully |
| Database Connected | Check logs | `✅ Using PostgreSQL database` |

---

## 🚨 Troubleshooting

| Problem | Solution |
|---------|----------|
| Shows `"database": "memory"` | Run migrations in shell |
| Can't save projects | Check `CORS_ORIGIN` matches your domain |
| API returns 404 | Check URL starts with `/api/` |
| Logs show connection errors | Restart service after adding database |

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────┐
│  Railway Service (Single Container) │
├─────────────────────────────────────┤
│  Express Server (Port 5000)         │
│  ├─ Serves React App (static)       │
│  ├─ /api/* routes (backend)         │
│  └─ SPA routing (/* → index.html)   │
└─────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────┐
│  Railway PostgreSQL Database        │
│  (Auto-managed, auto-backed up)     │
└─────────────────────────────────────┘
```

**Frontend + Backend are already combined!** ✅

---

## 🔐 Security Checklist

- [ ] `JWT_SECRET` set (random 64+ chars)
- [ ] `ENCRYPTION_KEY` set (random 32+ chars)  
- [ ] `CORS_ORIGIN` set to your domain
- [ ] Database password NOT manually set (Railway auto-manages)
- [ ] No secrets in GitHub

---

## 📞 Useful Commands

```bash
# Open Railway dashboard
railway open

# View logs
railway logs

# Run migrations
railway run -- bash -c "cd server && npm run db:migrate"

# Check env vars
railway variables

# Restart
railway service restart
```

---

## 🎉 You're Live!

**Frontend:** https://your-app.up.railway.app
**API:** https://your-app.up.railway.app/api/health
**Database:** Railway PostgreSQL (auto-managed)

Everything is production-ready! 🚀
