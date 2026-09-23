# Error Monitoring Setup with Sentry

This guide explains how to set up automatic error monitoring, alerting, and reporting using Sentry.

## 🎯 What Sentry Does

Sentry automatically:
- ✅ **Catches all errors** (frontend & backend)
- ✅ **Groups similar errors** together
- ✅ **Shows full stack traces** with source maps
- ✅ **Tracks which users** experienced errors
- ✅ **Records user actions** before errors (breadcrumbs)
- ✅ **Sends real-time alerts** via email/Slack
- ✅ **Monitors performance** (slow queries, API calls)
- ✅ **Tracks deployments** (which version introduced bugs)

---

## 📋 Step-by-Step Setup

### **Step 1: Create Sentry Account**

1. Go to: https://sentry.io/signup/
2. Sign up with GitHub, Google, or email
3. Create a new organization (e.g., "Your Company")
4. Choose "Node.js" as first platform

### **Step 2: Create Two Projects**

You need **two Sentry projects**:

#### **Project 1: Backend API**
1. Click **"Create Project"**
2. Select **Node.js**
3. Name it: `mikrotik-billing-api`
4. Copy the **DSN** (looks like: `https://xxx@xxx.ingest.sentry.io/xxx`)

#### **Project 2: Frontend App**
1. Click **"Create Project"** again
2. Select **React**
3. Name it: `mikrotik-billing-app`
4. Copy the **DSN**

---

### **Step 3: Configure Environment Variables**

#### **Backend (.env file)**

Add to your `.env` file:

```env
# Sentry Error Tracking
SENTRY_DSN=https://your-backend-dsn@xxx.ingest.sentry.io/xxx
SENTRY_RELEASE=mikrotik-billing@2.0.0
```

#### **Frontend (.env file)**

Add to client `.env` or `.env.production`:

```env
# Sentry Error Tracking
VITE_SENTRY_DSN=https://your-frontend-dsn@xxx.ingest.sentry.io/xxx
VITE_SENTRY_RELEASE=mikrotik-billing@2.0.0
```

⚠️ **IMPORTANT:** Never commit DSNs to public repositories if you want to keep them private. However, Sentry DSNs are safe to expose (they're public by design).

---

### **Step 4: Install Dependencies**

```bash
# Backend
cd server
npm install

# Frontend
cd client
npm install
```

---

### **Step 5: Test Error Tracking**

#### **Backend Test:**

Add this temporary test route to verify Sentry is working:

```javascript
// server/src/routes/test.js
const express = require('express');
const router = express.Router();
const { captureError } = require('../services/sentry');

router.get('/test-error', (req, res) => {
  try {
    throw new Error('Test error from backend');
  } catch (error) {
    captureError(error, { test: true });
    res.status(500).json({ error: 'Error captured by Sentry' });
  }
});

module.exports = router;
```

Visit: `http://localhost:5000/api/test-error`

#### **Frontend Test:**

Open browser console and run:

```javascript
throw new Error('Test error from frontend');
```

---

### **Step 6: Verify in Sentry Dashboard**

1. Go to: https://sentry.io
2. Click your project
3. Click **"Issues"** in sidebar
4. You should see your test errors!

---

## 🔔 Setting Up Alerts

### **Email Alerts (Default)**

Sentry sends email alerts automatically:

1. Go to: https://sentry.io/settings/[org]/alerts/
2. Click **"Create Alert Rule"**
3. Configure:
   - **When:** "A new issue is created"
   - **Notify:** Your email
   - **Frequency:** Immediately

### **Slack Integration**

1. Go to: https://sentry.io/settings/[org]/integrations/add/slack/
2. Authorize Sentry in Slack
3. Choose channel (e.g., `#errors`)
4. Configure alert rules

### **Discord Integration**

1. Go to: https://sentry.io/settings/[org]/integrations/add/discord/
2. Create webhook in Discord channel settings
3. Paste webhook URL in Sentry

---

## 📊 What Gets Tracked

### **Automatically Captured:**

✅ All unhandled exceptions  
✅ All 500 server errors  
✅ All React component crashes  
✅ All rejected promises  
✅ Network errors  
✅ Database errors  
✅ Authentication failures  

### **User Context:**

✅ User ID  
✅ User email  
✅ User role  
✅ IP address  
✅ Browser/OS  
✅ Page URL  

### **Breadcrumbs (User Actions Before Error):**

✅ HTTP requests made  
✅ Console logs  
✅ Navigation history  
✅ Clicks/taps  
✅ Form submissions  

---

## 🎯 Advanced Features

### **Performance Monitoring**

Sentry tracks slow API calls and database queries:

```javascript
// Backend: Wrap expensive operations
const Sentry = require('@sentry/node');

const transaction = Sentry.startTransaction({
  name: 'Generate Report',
  op: 'report.generation',
});

try {
  // Your code here
  const result = await generateReport();
  transaction.setStatus('ok');
  return result;
} catch (error) {
  transaction.setStatus('error');
  throw error;
} finally {
  transaction.finish();
}
```

### **Deployment Tracking**

Add to your deploy script:

```bash
# After successful deployment
curl -X POST \
  https://sentry.io/api/0/organizations/[org]/releases/ \
  -H 'Authorization: Bearer [AUTH_TOKEN]' \
  -H 'Content-Type: application/json' \
  -d '{
    "version": "mikrotik-billing@2.0.0",
    "refs": [{
      "repository": "IKIYY19/Mikrotik-billing",
      "commit": "'"$(git rev-parse HEAD)"'"
    }],
    "dateReleased": "'"$(date -u +%Y-%m-%dT%H:%M:%S)"'"
  }'
```

Or use Sentry CLI:

```bash
npm install -g @sentry/cli

sentry-cli releases new mikrotik-billing@2.0.0
sentry-cli releases set-commits mikrotik-billing@2.0.0 --auto
sentry-cli releases finalize mikrotik-billing@2.0.0
sentry-cli releases deploys mikrotik-billing@2.0.0 new -e production
```

---

## 🔒 Privacy & Security

### **Sensitive Data Filtering**

The Sentry configuration already filters:
- ✅ Passwords
- ✅ Tokens
- ✅ Authorization headers
- ✅ Credit card numbers
- ✅ Cookies

### **GDPR Compliance**

To anonymize IPs:

```javascript
// In server/src/services/sentry.js
Sentry.setUser({
  id: user.id,
  email: user.email,
  ip_address: '{{auto}}', // Sentry auto-anonymizes
});
```

---

## 💰 Pricing

### **Free Tier (Developer Plan)**

- ✅ 5,000 errors/month
- ✅ 10,000 performance transactions
- ✅ 1 team member
- ✅ 7-day data retention
- ✅ Email alerts

### **Team Plan ($26/month)**

- ✅ 50,000 errors/month
- ✅ Unlimited team members
- ✅ 30-day data retention
- ✅ Slack/Discord integration

**For most small ISPs, the free tier is sufficient!**

---

## 🐛 Troubleshooting

### **"Sentry DSN not configured" Warning**

This is normal during development. Errors are only logged to console.

**Fix:** Add `SENTRY_DSN` to your `.env` file.

### **Errors Not Appearing in Sentry**

1. Check DSN is correct (no typos)
2. Check network firewall (Sentry needs outbound HTTPS)
3. Check browser console for Sentry errors
4. Verify `SENTRY_DSN` is actually loaded:

```javascript
console.log('Sentry DSN:', process.env.SENTRY_DSN);
```

### **Too Many Errors?**

Common noise to ignore (already configured):
- Health check failures
- PostgreSQL connection refused (local dev)
- Browser extension errors

Add more to `ignoreErrors` in `server/src/services/sentry.js`.

---

## 📈 Dashboard Features

### **Issues Page**

- Groups similar errors
- Shows frequency
- Shows affected users
- Shows stack traces
- Shows browser/OS breakdown

### **Releases Page**

- Shows errors per version
- Shows which version introduced bug
- Shows resolution rate

### **Performance Page**

- Slowest API endpoints
- Database query times
- Page load times
- Transaction traces

---

## 🚀 Next Steps

1. ✅ Set up Sentry account
2. ✅ Configure DSNs in environment
3. ✅ Deploy and test
4. ✅ Set up Slack/email alerts
5. ✅ Invite team members
6. ✅ Monitor errors daily
7. ✅ Review performance weekly

---

## 📞 Need Help?

- **Sentry Docs:** https://docs.sentry.io/
- **Node.js Guide:** https://docs.sentry.io/platforms/node/
- **React Guide:** https://docs.sentry.io/platforms/javascript/guides/react/
- **Support:** support@getsentry.com

---

**Your app now has enterprise-grade error monitoring!** 🎉

Every error will be tracked with full context, stack traces, and user information. You'll know about issues before your customers even report them!
