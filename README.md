# 🚀 MikroTik Billing Platform

Complete ISP management platform with MikroTik RouterOS integration, billing system, customer portal, and network monitoring.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

### 🔐 Security (NEW!)
- **JWT Authentication** - Secure login for all users
- **Protected API** - All routes require authentication
- **Password Hashing** - Bcrypt with salt
- **Token Management** - Auto-refresh and expiry handling

### 💰 Billing & Invoicing
- Customer management with online status polling
- Service plans (speed, quota, priority)
- Subscription lifecycle management
- Automated invoice generation
- Multiple payment methods (Cash, Bank, M-Pesa, Card)
- M-Pesa STK Push integration
- Customer self-service portal
- Prepaid wallet system
- Auto-suspension for non-payment

### 🌐 Network Management
- **MikroTik API Integration** - Direct router control
- PPPoE server management
- Hotspot management with vouchers
- Real-time PPPoE session monitoring
- Network queues and bandwidth management
- DHCP/DNS/Firewall configuration
- FreeRADIUS integration

### 📊 Monitoring & Analytics (IMPROVED!)
- **Real PPPoE monitoring** (no more fake data!)
- **Real bandwidth graphs** with historical data
- **Live network map** with customer locations
- Revenue and churn analytics
- Customer growth tracking
- Financial reports (daily, monthly, debtors, tax)

### 📱 Communication
- SMS notifications via Africa's Talking
- WhatsApp Business integration
- Bulk messaging
- Payment reminders
- Service alerts

### 🎫 Support & Operations
- Ticket system with SLA tracking
- Device inventory management
- Auto backup & restore
- Multi-router support
- Topology builder
- Captive portal designer

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+ (or use in-memory mode)

### Option 1: Local Development

```bash
# 1. Clone repository
git clone https://github.com/IKIYY19/Mikrotik-billing.git
cd Mikrotik-billing

# 2. Install dependencies
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# 3. Setup environment
cp .env.template .env
# Edit .env and fill in values (or leave defaults for testing)

# 4. Start PostgreSQL (optional - app works without it)
# If PostgreSQL is not running, app will use in-memory storage

# 5. Run migrations (if using PostgreSQL)
cd server
npm run db:migrate
npm run db:seed  # Creates default admin user

# 6. Start development servers
cd ..
npm run dev
```

**Default Admin Credentials:**
- Email: `admin@example.com`
- Password: `admin123`

### Option 2: Railway Deployment

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=Mikrotik-billing)

1. Click button above or go to Railway.app
2. Deploy from GitHub repo
3. Add PostgreSQL database
4. Set environment variables:
   ```env
   JWT_SECRET=<generate-random-64-chars>
   ENCRYPTION_KEY=<generate-random-32-chars>
   CORS_ORIGIN=https://your-domain.railway.app
   ```
5. Run migrations in Railway shell:
   ```bash
   cd server && npm run db:migrate && npm run db:seed
   ```

See [RAILWAY.md](RAILWAY.md) for detailed instructions.

### Option 3: Docker (VPS)

```bash
# Clone repo
git clone https://github.com/IKIYY19/Mikrotik-billing.git
cd Mikrotik-billing

# Setup
cp .env.example .env
# Edit .env with your values

# Deploy
docker-compose -f docker-compose-simple.yml up -d
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for full deployment guide.

## 📁 Project Structure

```
Mikrotik-billing/
├── client/                 # React frontend
│   └── src/
│       ├── components/     # Reusable UI components
│       ├── pages/          # Page components
│       │   └── billing/    # Billing system pages
│       ├── modules/        # MikroTik config modules
│       ├── lib/           # API client with auth
│       ├── hooks/         # Custom React hooks
│       └── store.js       # Zustand state management
│
├── server/                # Express backend
│   └── src/
│       ├── routes/        # API endpoints
│       ├── middleware/    # Auth middleware
│       ├── db/            # Database layer
│       ├── generators/    # MikroTik script generators
│       ├── services/      # External services (SMS, payments)
│       ├── cron/          # Scheduled jobs
│       └── utils/         # Helper functions
│
└── Documentation/
    ├── README.md
    ├── RAILWAY.md
    ├── DEPLOYMENT.md
    ├── PRODUCTION-SETUP.md
    └── RAILWAY-QUICKSTART.md
```

## 🔑 API Endpoints

### Authentication
```
POST   /api/auth/register        # Create user account
POST   /api/auth/login           # Login and get JWT token
GET    /api/auth/me              # Get current user (requires auth)
```

### Billing
```
GET    /api/billing/dashboard     # Billing statistics
GET    /api/billing/customers     # List customers
POST   /api/billing/customers     # Create customer
GET    /api/billing/customers/:id # Customer details
PUT    /api/billing/customers/:id # Update customer
DELETE /api/billing/customers/:id # Delete customer

GET    /api/billing/plans         # List service plans
POST   /api/billing/plans         # Create plan

GET    /api/billing/subscriptions # List subscriptions
POST   /api/billing/subscriptions # Create subscription

GET    /api/billing/invoices      # List invoices
POST   /api/billing/invoices      # Create invoice

GET    /api/billing/payments      # List payments
POST   /api/billing/payments      # Record payment

POST   /api/payments/mpesa/stk    # Initiate M-Pesa STK Push
GET    /api/billing/usage/history # Historical bandwidth data
POST   /api/billing/usage/record  # Record bandwidth usage
```

### Network
```
GET    /api/network/pppoe/active   # Active PPPoE sessions
GET    /api/network/hotspot/active # Active hotspot users
GET    /api/features/monitoring/dashboard # Real monitoring data
```

### MikroTik Config Builder
```
GET    /api/projects               # List projects
POST   /api/projects               # Create project
POST   /api/generator/generate     # Generate MikroTik script
```

## 🗄️ Database

The app works with **PostgreSQL** or **in-memory storage**:

- **PostgreSQL**: Full persistence, recommended for production
- **In-Memory**: Development/testing, data lost on restart

Migrations are handled automatically by `npm run db:migrate`.

## 🔐 Security

- All API routes require JWT authentication
- Passwords hashed with bcrypt (10 rounds)
- JWT tokens expire after 7 days (configurable)
- CORS restricted to your domain
- MikroTik passwords encrypted with AES-256-GCM
- Environment variables for all secrets

## 📊 Monitoring

The app collects real metrics every 5 minutes:
- PPPoE session data from MikroTik routers
- Bandwidth usage per customer
- Online/offline status
- Historical usage trends

Data is stored in `usage_records` table for reporting.

## 🛠️ Tech Stack

**Frontend:**
- React 18
- Vite 5
- TailwindCSS 3
- Zustand (state management)
- Axios (HTTP client)
- React Router 6
- Lucide React (icons)

**Backend:**
- Node.js 18
- Express 4
- PostgreSQL (via `pg`)
- JWT authentication
- mikronode (MikroTik API)
- bcryptjs (password hashing)

**Deployment:**
- Railway.app (recommended)
- Docker Compose
- Dokploy (self-hosted)

## 📈 Roadmap

### Completed ✅
- [x] Authentication system
- [x] Real monitoring data
- [x] Real bandwidth graphs
- [x] Customer management
- [x] Billing & invoicing
- [x] Payment integration
- [x] SMS/WhatsApp notifications
- [x] Network map
- [x] Captive portal designer
- [x] Auto-suspension
- [x] Inventory management

### In Progress 🚧
- [ ] OLT integration (Huawei/ZTE)
- [ ] Email notifications
- [ ] Credit notes
- [ ] Audit logging
- [ ] Configuration versioning

### Planned 📋
- [ ] Mobile app (React Native)
- [ ] Advanced routing
- [ ] AI anomaly detection
- [ ] Multi-tenant resellers
- [ ] White-label branding

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file

## 🆘 Support

- **Documentation**: See guides in repository
- **Issues**: Open GitHub issue
- **Discussions**: GitHub Discussions

## ⚠️ Disclaimer

This tool manages critical network infrastructure. Always:
- Test configurations in lab environment first
- Review generated scripts before applying
- Backup router configs regularly
- Use strong passwords for all services
- Keep secrets out of version control

---

**Built with ❤️ for ISPs and Network Engineers**
