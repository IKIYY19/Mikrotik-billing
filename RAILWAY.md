# 🚀 Railway.app Deployment Guide

## Quick Deploy (5 minutes)

### Step 1: Prepare Your Repository

Your code is already on GitHub: `https://github.com/IKIYY19/Mikrotik-billing`

### Step 2: Connect to Railway

1. Go to [Railway.app](https://railway.app) and sign in
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose `Mikrotik-billing` repository

### Step 3: Add PostgreSQL Database

1. Click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway will automatically provision a database
4. Click on the database → **"Variables"** tab
5. Railway auto-injects these variables:
   - `DATABASE_URL`
   - `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`

### Step 4: Configure Server Environment Variables

Go to your **Service** → **"Variables"** tab and add:

```env
# Database (Railway auto-injects these from PostgreSQL)
DB_HOST=${{PostgreSQL.PGHOST}}
DB_PORT=${{PostgreSQL.PGPORT}}
DB_NAME=${{PostgreSQL.PGDATABASE}}
DB_USER=${{PostgreSQL.PGUSER}}
DB_PASSWORD=${{PostgreSQL.PGPASSWORD}}

# Security - Generate these with:
# openssl rand -hex 64 (for JWT)
# openssl rand -hex 32 (for ENCRYPTION)
JWT_SECRET=your_jwt_secret_key_here
ENCRYPTION_KEY=your_encryption_key_here

# CORS - Set to your Railway domain
CORS_ORIGIN=https://your-app.railway.app

# Optional (leave blank if not using)
AT_API_KEY=
MPESA_CONSUMER_KEY=
WHATSAPP_ACCESS_TOKEN=
```

### Step 5: Deploy!

1. Railway will automatically detect the `railway.json` file
2. It will use `Dockerfile.railway` to build
3. Wait for build to complete (~3-5 minutes)
4. Click **"Generate Domain"** to get your public URL

---

## Manual Railway Deploy (If Auto-Deploy Fails)

### Option A: Use Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link your project
railway link

# Deploy
railway up
```

### Option B: Deploy Without Docker

If Docker builds fail, Railway can use Nixpacks:

1. Delete `Dockerfile.railway` temporarily
2. Update `railway.json`:
   ```json
   {
     "build": {
       "builder": "NIXPACKS"
     }
   }
   ```
3. Railway will auto-detect Node.js and build natively

---

## Troubleshooting

### Build Fails with "vite: not found"

✅ **Already Fixed!** The `Dockerfile.railway` now installs all client dependencies including devDependencies.

If still failing:
```bash
# Test build locally
docker build -t mikrotik-railway -f Dockerfile.railway .
```

### Database Connection Fails

1. Check PostgreSQL is linked to your service
2. Verify environment variables:
   ```bash
   railway variables
   ```
3. Restart the service after adding variables

### Port Issues

Railway sets the `PORT` environment variable automatically. The server reads this from `.env`:
```javascript
const PORT = process.env.PORT || 5000;
```

### Health Check Fails

The health check endpoint is: `/api/health`

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-...",
  "database": "postgres"
}
```

---

## Railway Project Structure

After deployment, your Railway project will have:

```
Your Project
├── PostgreSQL Database
│   └── Auto-provisioned
└── Mikrotik-billing Service
    ├── Port: 5000 (backend)
    ├── Static files served automatically
    └── Health check: /api/health
```

---

## Custom Domain

1. Go to **Settings** → **Domains**
2. Click **"Generate Domain"** for free `.railway.app` subdomain
3. Or add your own domain:
   - Click **"Add Custom Domain"**
   - Update DNS records as instructed
   - Update `CORS_ORIGIN` env variable

---

## Pricing

Railway offers:
- **$5 free credit/month** for hobby projects
- **Pay-as-you-go** after free tier
- Typical usage: ~$3-5/month for small apps

---

## Commands Reference

```bash
# View logs
railway logs

# View deployment status
railway status

# Open dashboard
railway open

# Restart service
railway service restart

# Add environment variable
railway variables set KEY=VALUE

# View all variables
railway variables
```

---

## Next Steps

1. ✅ Deploy to Railway
2. ✅ Test the app at your Railway URL
3. ✅ Add custom domain (optional)
4. ✅ Set up automated backups
5. ✅ Monitor logs for errors

---

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Your Repo: https://github.com/IKIYY19/Mikrotik-billing
