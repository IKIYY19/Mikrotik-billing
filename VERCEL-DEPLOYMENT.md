# Vercel Deployment Guide

## ⚠️ Important: Architecture

Vercel is designed for **frontend-only** deployments. It does NOT support:
- ❌ Persistent Node.js servers (your backend API)
- ❌ PostgreSQL databases
- ❌ Long-running processes

### Recommended Architecture

```
┌─────────────────────┐
│   Vercel (Frontend) │
│   React App         │
│   Static Files      │
└──────────┬──────────┘
           │
           │ API calls (/api/*)
           │
           ▼
┌─────────────────────┐
│ Railway/Render      │
│ (Backend + DB)      │
│ Node.js API         │
│ PostgreSQL          │
└─────────────────────┘
```

---

## 📋 Deployment Steps

### Step 1: Deploy Backend First (Railway - FREE)

1. Go to https://railway.app/
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository: `Mikrotik-billing`
4. Railway will auto-detect your `Dockerfile.server` or use Nixpacks
5. Add PostgreSQL database:
   - Click "+ New" → "Database" → "Add PostgreSQL"
   - Copy the connection details
6. Add environment variables in Railway:
   ```
   DB_HOST=<from Railway PostgreSQL>
   DB_PORT=5432
   DB_NAME=<from Railway PostgreSQL>
   DB_USER=<from Railway PostgreSQL>
   DB_PASSWORD=<from Railway PostgreSQL>
   JWT_SECRET=<run: openssl rand -hex 64>
   ENCRYPTION_KEY=<run: openssl rand -hex 32>
   CORS_ORIGIN=https://your-vercel-domain.vercel.app
   ```
7. Deploy and copy your backend URL (e.g., `https://your-app.railway.app`)

### Step 2: Deploy Frontend on Vercel

1. Go to https://vercel.com/
2. Click "New Project"
3. Import your GitHub repo: `Mikrotik-billing`
4. Configure build settings:
   - **Framework Preset:** Vite
   - **Root Directory:** `client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

5. **IMPORTANT:** Add environment variable:
   ```
   VITE_API_URL=https://your-backend-url.railway.app
   ```

6. Click "Deploy"

### Step 3: Connect Frontend to Backend

After deploying, update the `vercel.json` with your actual backend URL:

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://your-backend-url.railway.app/:path*" }
  ]
}
```

---

## 🚀 Quick Deploy Commands

### Option A: Deploy from Vercel Dashboard (Recommended)

Just connect your GitHub repo and Vercel will auto-deploy on every push.

### Option B: Deploy with Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from project root
vercel

# Deploy to production
vercel --prod
```

---

## 🔧 Alternative: Deploy Entire App on Railway

If you want everything in one place (easier):

### Railway (Recommended for Full-Stack)

1. Go to https://railway.app/
2. New Project → Deploy from GitHub
3. Select your repo
4. Railway will auto-detect Docker Compose or use Nixpacks
5. Add PostgreSQL database
6. Set environment variables
7. Deploy - **Everything works automatically!**

**Why Railway is better for this app:**
- ✅ Supports full-stack apps
- ✅ Native PostgreSQL integration
- ✅ Persistent servers (not serverless)
- ✅ Free tier includes $5/month credit
- ✅ Automatic database backups

---

## 🌐 Environment Variables

### Frontend (Vercel)

| Variable | Value | Required |
|----------|-------|----------|
| `VITE_API_URL` | `https://your-backend.railway.app` | ✅ Yes |

### Backend (Railway/Render)

| Variable | Value | Required |
|----------|-------|----------|
| `DB_HOST` | Railway PostgreSQL host | ✅ Yes |
| `DB_PORT` | `5432` | ✅ Yes |
| `DB_NAME` | Railway database name | ✅ Yes |
| `DB_USER` | Railway database user | ✅ Yes |
| `DB_PASSWORD` | Railway database password | ✅ Yes |
| `JWT_SECRET` | `openssl rand -hex 64` | ✅ Yes |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` | ✅ Yes |
| `CORS_ORIGIN` | `https://your-app.vercel.app` | ✅ Yes |
| `NODE_ENV` | `production` | ✅ Yes |

Optional integrations (leave blank if not using):
- `AT_API_KEY` - Africa's Talking SMS
- `MPESA_CONSUMER_KEY` - M-Pesa payments
- `WHATSAPP_ACCESS_TOKEN` - WhatsApp notifications

---

## 🐛 Troubleshooting

### Frontend Can't Connect to Backend

**Problem:** "Network Error" or CORS issues

**Solution:**
1. Check `VITE_API_URL` is set correctly in Vercel
2. Update `CORS_ORIGIN` in backend to your Vercel URL
3. Redeploy both services after changing env vars

### Build Fails on Vercel

**Problem:** "vite: command not found"

**Solution:**
In Vercel project settings:
- **Root Directory:** `client` (IMPORTANT!)
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

### API Returns 404

**Problem:** API endpoints not found

**Solution:**
1. Verify backend is running on Railway
2. Check `VITE_API_URL` points to correct backend URL
3. Check Vercel rewrites in `vercel.json`

---

## 💡 Recommendation

### For Your Use Case: Use Railway for Everything

Since your app is **full-stack with database**, I recommend:

1. **Railway** - Deploy everything in one place
   - Backend + Frontend + Database together
   - No need to split services
   - Easier to manage
   - Uses your `docker-compose-simple.yml`

2. **Vercel** - Only if you want to split services
   - Frontend on Vercel
   - Backend on Railway/Render
   - More complex setup

### Railway Quick Deploy

```bash
# Just connect your GitHub repo to Railway
# Railway will auto-use docker-compose-simple.yml
# Everything deploys automatically
```

---

## 📚 Useful Links

- Railway: https://railway.app/
- Vercel: https://vercel.com/
- Railway PostgreSQL Docs: https://docs.railway.app/guides/postgresql
- Vercel Deployment Docs: https://vercel.com/docs/deployments

---

**Need help?** Check Railway for the easiest full-stack deployment experience!
