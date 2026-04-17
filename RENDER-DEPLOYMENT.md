# Render Deployment Guide

## 🚀 Quick Start (5 Minutes)

### Step 1: Sign Up for Render

1. Go to: https://render.com/
2. Click **"Get Started for Free"**
3. Sign up with GitHub
4. Authorize Render to access your repos

---

## 📋 Two Deployment Options

### Option A: Blueprint (Recommended - One Click)

This deploys everything automatically using `render.yaml`

#### Steps:

1. **Go to:** https://dashboard.render.com/blueprints
2. **Click:** "New Blueprint Instance"
3. **Select repo:** `Mikrotik-billing`
4. **Render will auto-detect** your `render.yaml`
5. **Review settings:**
   - Database: PostgreSQL (Free tier)
   - Web Service: Your app
6. **Click:** "Apply"
7. **Wait** (~3-5 minutes)

**Done!** Your app is live at: `https://mikrotik-billing-xxxx.onrender.com`

---

### Option B: Manual Setup

If Blueprint doesn't work, do it manually:

#### Step 1: Create PostgreSQL Database

1. Go to: https://dashboard.render.com/
2. Click **"New"** → **"PostgreSQL"**
3. **Name:** `mikrotik-db`
4. **Region:** Choose closest to you
5. **Plan:** Free
6. **Click:** "Create Database"
7. **Copy** these values:
   - Internal Database URL
   - Database name
   - Username
   - Password

#### Step 2: Create Web Service

1. Click **"New"** → **"Web Service"**
2. **Connect repo:** `Mikrotik-billing`
3. **Configure:**
   - **Name:** `mikrotik-billing`
   - **Region:** Same as database
   - **Branch:** `master`
   - **Root Directory:** Leave blank
   - **Runtime:** `Docker`
   - **Dockerfile:** `Dockerfile.render`
   - **Plan:** Free

4. **Add Environment Variables:**
   Click "Advanced" → "Add Environment Variable":

   ```
   NODE_ENV = production
   PORT = 5000
   DB_HOST = (from database Internal Connection URL)
   DB_PORT = 5432
   DB_NAME = (from database)
   DB_USER = (from database)
   DB_PASSWORD = (from database)
   JWT_SECRET = (generate with: openssl rand -hex 64)
   ENCRYPTION_KEY = (generate with: openssl rand -hex 32)
   ```

5. **Click:** "Create Web Service"

If you deploy with the Blueprint in `render.yaml`, Render will prompt you for secret values like `JWT_SECRET` and `ENCRYPTION_KEY` during the initial setup because they are marked with `sync: false`.

---

## 🔐 Generate Secure Keys

Run these on your local PC (PowerShell or Git Bash):

```bash
# JWT Secret
openssl rand -hex 64

# Encryption Key
openssl rand -hex 32
```

Or use random strings:
- JWT: `https://generate-secret.vercel.app/64`
- Key: `https://generate-secret.vercel.app/32`

---

## 🌐 Extract Database Connection Details

From Render database page, copy the **Internal Database URL**:

```
postgresql://mikrotik_user:password@hostname:5432/mikrotik_config_builder
```

Split it like this:
- **DB_HOST:** `hostname` (between @ and :)
- **DB_PORT:** `5432`
- **DB_NAME:** `mikrotik_config_builder` (at the end)
- **DB_USER:** `mikrotik_user` (after postgresql://)
- **DB_PASSWORD:** `password` (between : and @)

---

## ✅ After Deployment

### 1. Check Logs
Go to your web service → "Logs" tab

Look for:
```
✅ Using PostgreSQL database
✅ Core migrations done
✅ Default admin created: admin@example.com
🚀 Server running on port 5000
```

If migrations or seed fail, the deploy now stops instead of silently booting with a partial schema.

### 2. Test Health Endpoint
```bash
curl https://your-app.onrender.com/api/health
```

Expected: `{"status":"ok","timestamp":"...","database":"postgres"}`

### 3. Login to Your App
- **URL:** `https://your-app.onrender.com`
- **Email:** `admin@example.com`
- **Password:** `admin123`

---

## 🔄 Auto-Deploy on Git Push

Render automatically deploys when you push to `master`!

```bash
git add .
git commit -m "update"
git push origin master
# Render will rebuild automatically
```

---

## 💰 Pricing

### Free Tier:
- ✅ 750 hours/month (enough for 1 app)
- ✅ PostgreSQL (90 days, then resets)
- ✅ Auto-sleep after 15 min inactivity

### Paid Plans:
- **Starter:** $7/month (always on)
- **Standard:** $15/month (more RAM)

---

## 🐛 Troubleshooting

### Build Fails

**Problem:** "vite: command not found"

**Solution:** Ensure `Dockerfile.render` has:
```dockerfile
RUN cd client && npm ci
```
(NOT `npm ci --omit=dev`)

---

### Database Connection Error

**Problem:** "Connection refused"

**Solution:**
1. Check database and app are in **same region**
2. Use **Internal Database URL** (not external)
3. Verify all environment variables are set

---

### "Service Unavailable" After Deploy

**Problem:** App goes to sleep on free tier

**Solution:** 
- Wait 30 seconds for it to wake up
- OR upgrade to $7/month plan for always-on

---

### CORS Errors

**Problem:** Frontend blocked

**Solution:** Set `CORS_ORIGIN` to your Render URL:
```
CORS_ORIGIN = https://mikrotik-billing-xxxx.onrender.com
```

---

## 📊 Useful Links

- **Dashboard:** https://dashboard.render.com/
- **Logs:** Dashboard → Your Service → "Logs"
- **Environment Variables:** Dashboard → Your Service → "Environment"
- **Database:** Dashboard → Your Database → "Info"

---

## 🎯 Quick Checklist

- [ ] Signed up for Render
- [ ] Connected GitHub repo
- [ ] Created PostgreSQL database
- [ ] Created web service
- [ ] Added all environment variables
- [ ] Deployment successful
- [ ] Can access `/api/health`
- [ ] Can login with admin credentials
- [ ] Set `CORS_ORIGIN` to your Render URL

---

**Need help?** Check the logs in Render dashboard and share the error message!
