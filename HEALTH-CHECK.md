# 🏥 Production Health Check Guide

Use this guide to verify your MikroTik Billing Platform is production-ready.

---

## ✅ Pre-Deployment Checklist

### Environment Variables
- [ ] `JWT_SECRET` set (run: `openssl rand -hex 64`)
- [ ] `ENCRYPTION_KEY` set (run: `openssl rand -hex 32`)
- [ ] `CORS_ORIGIN` set to your domain (no trailing slash)
- [ ] `ADMIN_PASSWORD` set (or use default `admin123` and change after login)
- [ ] Database credentials correct (Railway auto-injects these)

### Security
- [ ] Rate limiting active (max 5 login attempts per 15 min)
- [ ] Account lockout working (10 failures = 30 min lock)
- [ ] Password strength validation enforced
- [ ] All API routes require authentication
- [ ] Customer portal has separate auth system

---

## 🧪 Post-Deployment Testing

### 1. First Login
```
URL: https://your-domain.railway.app/login
Email: admin@example.com
Password: admin123 (or your ADMIN_PASSWORD)
```

**Expected:**
- ✅ Login succeeds
- ✅ Redirects to dashboard
- ✅ User info shown in sidebar
- ✅ Logout button works

**If Fails:**
- Check Railway logs for: `✅ Default admin created`
- Check database migrations ran: `✅ Core migrations done`
- Verify JWT_SECRET is set

---

### 2. Setup Wizard
```
URL: https://your-domain.railway.app/setup
```

**Expected:**
- ✅ 7-step wizard loads
- ✅ Progress bar works
- ✅ Can navigate forward/back
- ✅ Completes successfully

**If Fails:**
- Check browser console for errors
- Verify `/api/features/setup` endpoint responds

---

### 3. Health Check
```
URL: https://your-domain.railway.app/api/health
```

**Expected JSON:**
```json
{
  "status": "ok",
  "timestamp": "2024-...",
  "database": "postgres"
}
```

**If Shows "memory" Instead of "postgres":**
- Database not connected
- Check Railway PostgreSQL is linked
- Verify environment variables in Railway dashboard

---

### 4. User Management
```
Navigate to: User Management (in sidebar, admin only)
```

**Expected:**
- ✅ User list shows admin user
- ✅ Can create new user
- ✅ Can edit user roles
- ✅ Can disable/enable users
- ✅ Can reset passwords

**Test:**
1. Create user: staff@example.com, role: staff
2. Login as staff user (logout admin first)
3. Verify staff can only access billing features
4. Logout, login as admin again
5. Disable the staff user
6. Try login as staff - should fail

---

### 5. Billing System
```
Navigate to: Billing → Customers
```

**Expected:**
- ✅ Can create customer
- ✅ Can create service plan
- ✅ Can create subscription
- ✅ Can generate invoice
- ✅ Can record payment

**Test Flow:**
1. Create plan: "10Mbps Standard" - KES 2500
2. Create customer: "John Doe", phone: +254700000001
3. Create subscription for customer with the plan
4. Generate invoice
5. Record payment
6. Check dashboard stats update

---

### 6. Monitoring Dashboard
```
Navigate to: Billing → Monitoring
```

**Expected:**
- ✅ Shows real PPPoE sessions (if MikroTik connected)
- ✅ Auto-refreshes every 60 seconds
- ✅ Last updated timestamp shown
- ✅ No fake/random data

**If Shows No Data:**
- Normal if no MikroTik router connected yet
- Connect router from MikroTik API page

---

### 7. Bandwidth Graphs
```
Navigate to: Billing → Bandwidth
```

**Expected:**
- ✅ Shows historical data (after 5+ minutes of collection)
- ✅ No random/fake data
- ✅ Can change time range

**Note:**
- First data collection happens 5 minutes after server start
- Graphs will be empty initially - this is normal

---

### 8. Network Map
```
Navigate to: Billing → Map
```

**Expected:**
- ✅ Map loads
- ✅ Customer markers appear (if they have lat/lng set)
- ✅ Different colors for online/offline/suspended

**Note:**
- Customers need coordinates set to appear on map
- Edit customer to add lat/lng

---

### 9. Password Reset
```
URL: https://your-domain.railway.app/login
Click: "Forgot Password"
```

**Expected:**
- ✅ Enter email → get reset token
- ✅ Enter token + new password → reset succeeds
- ✅ Password strength validation works
- ✅ Can login with new password

---

### 10. Rate Limiting
**Test:**
1. Try to login with wrong password 6 times rapidly
2. 6th attempt should fail with rate limit error
3. Wait 15 minutes
4. Try again - should work

---

## 📊 Railway Logs to Look For

### Good Signs ✅
```
✅ Using PostgreSQL database
🔧 Running auth migrations...
✅ Auth migrations completed
✅ Core migrations done
✅ Billing migrations done
✅ Default admin created: admin@example.com
🔑 Password: admin123
📦 Serving frontend from: /app/client/dist
🚀 Server running on port <PORT>
[Cron] Auto-suspend cron started
📦 Metrics collection started
```

### Bad Signs ❌
```
⚠️  CRITICAL: JWT_SECRET is using a default value in production!
⚠️  PostgreSQL not available
⚠️  Frontend dist not found
Migration failed
Seed failed
```

---

## 🔍 Common Issues & Fixes

### Issue: Can't Login
**Symptoms:** "Invalid credentials" even with correct password

**Fix:**
1. Check Railway logs for `✅ Default admin created`
2. If not shown, run in Railway shell:
   ```bash
   cd server && npm run db:seed
   ```

---

### Issue: 401 on Every Request
**Symptoms:** "Authentication required" on all API calls

**Fix:**
1. Check browser console
2. Verify token in localStorage: `localStorage.getItem('token')`
3. If missing, logout and login again
4. Check Railway logs for auth errors

---

### Issue: Blank Page After Login
**Symptoms:** Login succeeds but page is white

**Fix:**
1. Open browser console (F12)
2. Look for JavaScript errors
3. Check Network tab for failed requests
4. Verify `CORS_ORIGIN` matches your domain exactly

---

### Issue: Database Shows "memory"
**Symptoms:** Health check returns `"database": "memory"`

**Fix:**
1. Verify PostgreSQL is linked in Railway
2. Check environment variables (PGHOST, PGDATABASE, etc.)
3. Restart service after linking database
4. Check Railway logs for connection errors

---

### Issue: Container Keeps Restarting
**Symptoms:** Deployment shows restart loops

**Fix:**
1. Check Railway logs for crash reason
2. Look for migration errors
3. Verify all environment variables are set
4. Check memory limits (should be at least 512MB)

---

## 🎯 Performance Benchmarks

| Metric | Expected |
|--------|----------|
| Login time | < 2 seconds |
| Dashboard load | < 3 seconds |
| API response | < 500ms |
| Customer creation | < 1 second |
| Invoice generation | < 2 seconds |

---

## 📞 Emergency Contacts

If something breaks in production:

1. **Check logs first**: Railway → Deployments → Logs
2. **Restart service**: Railway → Settings → Restart
3. **Rollback**: Railway → Deployments → Click previous deployment → Promote
4. **Database backup**: Railway → PostgreSQL → Backups

---

## 🎉 Production Ready When:

- [ ] All tests above pass
- [ ] No errors in Railway logs
- [ ] Health check returns "postgres"
- [ ] Can complete full billing flow (customer → subscription → invoice → payment)
- [ ] User management working
- [ ] Monitoring shows real data
- [ ] Setup wizard completes

**Then you're LIVE!** 🚀
