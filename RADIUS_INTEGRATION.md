# FreeRADIUS Integration Guide

This guide explains how to integrate FreeRADIUS with your MikroTik Config Builder application using Docker.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Docker Network                        │
│                                                            │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│  │          │    │          │    │          │             │
│  │  Client  │───▶│  Server  │───▶│PostgreSQL│             │
│  │ (React)  │    │ (Express)│    │          │             │
│  │          │    │          │    │          │             │
│  └──────────┘    └──────────┘    └──────────┘             │
│                        │                     ▲              │
│                        ▼                     │              │
│                  ┌──────────┐                │              │
│                  │          │────────────────┘              │
│                  │FreeRADIUS│                               │
│                  │          │                               │
│                  └──────────┘                               │
│                        │                                    │
└────────────────────────┼────────────────────────────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │  MikroTik    │
                  │  Router(s)   │
                  └──────────────┘
```

## File Structure

```
radius/
├── Dockerfile.radius           # FreeRADIUS Docker image
├── entrypoint.sh               # Container startup script
├── radiusd.conf                # Main FreeRADIUS configuration
├── clients.conf                # MikroTik router clients
├── radius_schema.sql           # Database schema
├── mods-available/
│   └── sql                     # SQL module configuration
└── mods-enabled/
    └── sql                     # Symlink to enable SQL module
```

## Quick Start

### Prerequisites

1. **Install Docker Desktop for Windows**
   - Download from: https://www.docker.com/products/docker-desktop/
   - Install and restart your computer
   - Verify installation: `docker --version`

2. **Install Docker Compose** (included with Docker Desktop)
   - Verify: `docker-compose --version`

### Step 1: Install Docker Desktop

Since Docker is not currently installed on your system:

1. Download Docker Desktop from https://www.docker.com/products/docker-desktop/
2. Run the installer
3. Follow the installation wizard
4. Restart your computer
5. Launch Docker Desktop
6. Wait for Docker to start (green indicator in system tray)

### Step 2: Configure Environment Variables

The `.env` file in the `server/` directory has been updated with RADIUS settings:

```env
# FreeRADIUS Integration
RADIUS_ENABLED=true
RADIUS_HOST=localhost
RADIUS_PORT=1812
RADIUS_SECRET=testing123
RADIUS_DB_NAME=radius_db
```

**Important**: Change `RADIUS_SECRET` to a strong secret key in production!

### Step 3: Configure MikroTik Routers as RADIUS Clients

Edit `radius/clients.conf` and add your MikroTik routers:

```conf
client mikrotik_router_1 {
    ipaddr = 192.168.88.1
    secret = your_shared_secret_here
    require_message_authenticator = yes
    nas_type = "mikrotik"
}
```

**Important**: The `secret` must match what you configure on your MikroTik router!

### Step 4: Start the Full Stack

```bash
# Build and start all services
docker-compose -f docker-compose-fullstack.yml up -d

# View logs
docker-compose -f docker-compose-fullstack.yml logs -f

# View specific service logs
docker-compose -f docker-compose-fullstack.yml logs -f radius
docker-compose -f docker-compose-fullstack.yml logs -f server

# Stop all services
docker-compose -f docker-compose-fullstack.yml down

# Stop and remove volumes (WARNING: deletes data)
docker-compose -f docker-compose-fullstack.yml down -v
```

### Step 5: Verify Services

```bash
# Check if services are running
docker-compose -f docker-compose-fullstack.yml ps

# Test PostgreSQL connection
docker-compose -f docker-compose-fullstack.yml exec postgres pg_isready -U postgres

# Test FreeRADIUS
docker-compose -f docker-compose-fullstack.yml exec radius radclient -x localhost:1812 auth testing123 <<EOF
User-Name=testuser
User-Password=testpass
EOF

# Test backend API
curl http://localhost:5000/api/health

# Access frontend
# Open http://localhost:3000 in browser
```

## Configure MikroTik Router

### Step 1: Enable RADIUS on MikroTik

Connect to your MikroTik router and run:

```mikrotik
# Add RADIUS server
/radius add address=YOUR_SERVER_IP secret=testing123 service=login

# Enable RADIUS
/radius set use-radius=yes
```

Replace `YOUR_SERVER_IP` with your Docker host IP address.

**For Windows Docker Desktop:**
- Use your computer's local IP: `host.docker.internal`
- Or find your IP: `ipconfig` → look for Ethernet/WiFi adapter IP

### Step 2: Configure RADIUS for Hotspot (Optional)

```mikrotik
# Set RADIUS for hotspot
/ip hotspot set [find] radius-location=yes

# Configure RADIUS accounting
/ip hotspot set [find] radius-acct-location=yes
```

### Step 3: Test RADIUS Authentication

```mikrotik
# Test RADIUS connection
/radius print

# Check RADIUS status
/radius monitor 0
```

## How It Works

### 1. User Authentication Flow

```
User → MikroTik Router → FreeRADIUS → PostgreSQL
                          ↓
User ← MikroTik Router ← FreeRADIUS
```

1. User attempts to connect to WiFi
2. MikroTik captures credentials
3. Router sends RADIUS Access-Request to FreeRADIUS
4. FreeRADIUS queries PostgreSQL for user credentials
5. FreeRADIUS sends Access-Accept/Reject back to router
6. Router grants/denies network access

### 2. Session Accounting Flow

```
MikroTik Router → RADIUS Accounting → FreeRADIUS → PostgreSQL
                                              ↓
                                       radacct table
```

1. User connects/disconnects
2. MikroTik sends accounting packets
3. FreeRADIUS logs to PostgreSQL `radacct` table
4. Your app can query session data for billing/monitoring

### 3. Database Tables

FreeRADIUS uses these PostgreSQL tables (created from `radius_schema.sql`):

| Table | Purpose |
|-------|---------|
| `nas` | MikroTik router clients |
| `radcheck` | User authentication rules |
| `radreply` | User reply attributes |
| `radgroupcheck` | Group check rules |
| `radgroupreply` | Group reply attributes |
| `radusergroup` | User-to-group mapping |
| `radacct` | Session accounting data |
| `radpostauth` | Authentication logs |

## Managing Users

### Add User via SQL

```sql
-- Add user with password
INSERT INTO radcheck (username, attribute, op, value) 
VALUES ('user001', 'User-Password', ':=', 'secret123');

-- Set session timeout (1 hour)
INSERT INTO radreply (username, attribute, op, value) 
VALUES ('user001', 'Max-All-Session', ':=', '3600');

-- Set data limit (1GB)
INSERT INTO radreply (username, attribute, op, value) 
VALUES ('user001', 'Mikrotik-Total-Limit', ':=', '1073741824');

-- Assign to group
INSERT INTO radusergroup (username, groupname, priority) 
VALUES ('user001', 'basic_plan', 1);
```

### Add User Group

```sql
-- Create group speed limit
INSERT INTO radgroupreply (groupname, attribute, op, value) 
VALUES ('basic_plan', 'Mikrotik-Rate-Limit', ':=', '5M/5M');

-- Create group session limit
INSERT INTO radgroupcheck (groupname, attribute, op, value) 
VALUES ('basic_plan', 'Max-All-Session', ':=', '3600');
```

### Add MikroTik Router Client

```sql
-- Add router to NAS table
INSERT INTO nas (nasname, shortname, type, secret, description) 
VALUES ('192.168.88.1', 'mikrotik-main', 'mikrotik', 'your_secret', 'Main Router');
```

## API Integration

Your app can now interact with FreeRADIUS through PostgreSQL:

### Example: Create Voucher with RADIUS

```javascript
// In your backend API
const createVoucherWithRADIUS = async (voucher) => {
  // Add to radcheck
  await db.query(
    `INSERT INTO radcheck (username, attribute, op, value) 
     VALUES ($1, 'User-Password', ':=', $2)`,
    [voucher.username, voucher.password]
  );
  
  // Set rate limit
  if (voucher.rate_limit) {
    await db.query(
      `INSERT INTO radreply (username, attribute, op, value) 
       VALUES ($1, 'Mikrotik-Rate-Limit', ':=', $2)`,
      [voucher.username, voucher.rate_limit]
    );
  }
  
  // Set session time
  if (voucher.valid_for) {
    const seconds = parseTimeToSeconds(voucher.valid_for);
    await db.query(
      `INSERT INTO radreply (username, attribute, op, value) 
       VALUES ($1, 'Max-All-Session', ':=', $2)`,
      [voucher.username, seconds]
    );
  }
};
```

### Example: Get Active Sessions

```javascript
const getActiveSessions = async () => {
  const { rows } = await db.query(`
    SELECT 
      username,
      nasipaddress,
      acctstarttime,
      acctsessiontime,
      acctinputoctets,
      acctoutputoctets,
      framedipaddress,
      callingstationid
    FROM radacct 
    WHERE acctstoptime IS NULL
    ORDER BY acctstarttime DESC
  `);
  return rows;
};
```

### Example: Get User Usage

```javascript
const getUserUsage = async (username) => {
  const { rows } = await db.query(`
    SELECT 
      username,
      SUM(acctsessiontime) as total_time,
      SUM(acctinputoctets) as upload_bytes,
      SUM(acctoutputoctets) as download_bytes,
      SUM(acctinputoctets + acctoutputoctets) as total_bytes,
      COUNT(*) as session_count
    FROM radacct 
    WHERE username = $1
    GROUP BY username
  `, [username]);
  return rows[0];
};
```

## Testing

### Test FreeRADIUS Authentication

```bash
# Enter radius container
docker-compose -f docker-compose-fullstack.yml exec radius bash

# Test authentication
radtest testuser testpass localhost 1812 testing123

# Expected output: Access-Accept or Access-Reject
```

### Test with cURL

```bash
# Test backend API endpoint
curl -X POST http://localhost:5000/api/radius/test \
  -H "Content-Type: application/json" \
  -d '{"username":"user001","password":"secret123"}'
```

### Monitor RADIUS Logs

```bash
# View FreeRADIUS logs
docker-compose -f docker-compose-fullstack.yml logs -f radius

# View authentication logs
docker-compose -f docker-compose-fullstack.yml exec radius tail -f /var/log/freeradius/radius.log
```

## Troubleshooting

### FreeRADIUS Won't Start

```bash
# Check logs
docker-compose -f docker-compose-fullstack.yml logs radius

# Common issues:
# 1. Database not ready - check PostgreSQL is healthy
# 2. Config syntax error - validate radiusd.conf
# 3. Port already in use - check port 1812/1813
```

### Can't Connect to Database

```bash
# Test from radius container
docker-compose -f docker-compose-fullstack.yml exec radius \
  psql -h postgres -U postgres -l

# Check network
docker-compose -f docker-compose-fullstack.yml exec radius \
  nc -zv postgres 5432
```

### Authentication Fails

1. Verify user exists in `radcheck`:
   ```sql
   SELECT * FROM radcheck WHERE username = 'user001';
   ```

2. Check password attribute:
   ```sql
   -- Should be 'User-Password' with op ':='
   SELECT * FROM radcheck WHERE username = 'user001' AND attribute = 'User-Password';
   ```

3. Verify MikroTik client secret matches:
   ```bash
   # In clients.conf
   client mikrotik_router_1 {
       secret = your_secret
   }
   ```

### Port Conflicts

If ports 1812/1813 are in use:

```bash
# Find process using port
netstat -ano | findstr "1812"

# Change port in docker-compose-fullstack.yml
ports:
  - "18120:1812/udp"
  - "18130:1813/udp"
```

## Production Deployment

### Security Checklist

- [ ] Change `RADIUS_SECRET` to strong random value
- [ ] Change `DB_PASSWORD` to strong password
- [ ] Use secrets file instead of environment variables
- [ ] Enable TLS for PostgreSQL connections
- [ ] Restrict RADIUS client IPs in `clients.conf`
- [ ] Use strong passwords for RADIUS shared secrets
- [ ] Enable RADIUS message authenticator
- [ ] Set up log rotation
- [ ] Configure monitoring/alerting

### Environment Variables for Production

```env
# Production .env
DB_PASSWORD=your-very-strong-password
JWT_SECRET=your-jwt-secret-min-32-chars
ENCRYPTION_KEY=your-32-char-encryption-key
RADIUS_SECRET=your-radius-secret-min-16-chars
CORS_ORIGIN=https://yourdomain.com
```

### Docker Swarm / Kubernetes

For production, consider:
- Use Docker secrets for sensitive data
- Implement health checks
- Set resource limits
- Configure persistent storage
- Set up backup/restore procedures

## Advanced Configuration

### CoA (Change of Authorization)

Allow dynamic session changes:

```conf
# In clients.conf
client mikrotik_router_1 {
    ipaddr = 192.168.88.1
    secret = testing123
    
    # Enable CoA
    coa_server = "coa"
}
```

### Multiple RADIUS Servers

For high availability:

```mikrotik
# Primary
/radius add address=192.168.1.100 secret=testing123 service=login

# Secondary
/radius add address=192.168.1.101 secret=testing123 service=login
```

### Custom Attributes

Add MikroTik-specific attributes:

```sql
-- Set rate limit
INSERT INTO radreply (username, attribute, op, value) 
VALUES ('user001', 'Mikrotik-Rate-Limit', ':=', '10M/10M');

-- Set IP address
INSERT INTO radreply (username, attribute, op, value) 
VALUES ('user001', 'Framed-IP-Address', ':=', '192.168.100.50');

-- Set VLAN
INSERT INTO radreply (username, attribute, op, value) 
VALUES ('user001', 'Mikrotik-Host-IP', ':=', '192.168.100.50');
```

## Useful Commands

```bash
# Start all services
docker-compose -f docker-compose-fullstack.yml up -d

# Stop all services
docker-compose -f docker-compose-fullstack.yml down

# View logs
docker-compose -f docker-compose-fullstack.yml logs -f

# Restart a service
docker-compose -f docker-compose-fullstack.yml restart radius

# Enter container shell
docker-compose -f docker-compose-fullstack.yml exec radius bash

# Database shell
docker-compose -f docker-compose-fullstack.yml exec postgres psql -U postgres -d radius_db

# Run RADIUS test
docker-compose -f docker-compose-fullstack.yml exec radius \
  radtest testuser testpass localhost 1812 testing123

# Check database tables
docker-compose -f docker-compose-fullstack.yml exec postgres \
  psql -U postgres -d radius_db -c "\dt"

# Backup database
docker-compose -f docker-compose-fullstack.yml exec postgres \
  pg_dump -U postgres radius_db > backup.sql

# Restore database
docker-compose -f docker-compose-fullstack.yml exec -T postgres \
  psql -U postgres radius_db < backup.sql
```

## Additional Resources

- FreeRADIUS Documentation: https://wiki.freeradius.org/
- MikroTik RADIUS Guide: https://help.mikrotik.com/docs/display/ROS/Radius
- PostgreSQL RADIUS Schema: https://wiki.freeradius.org/guide/SQL-setup
- Docker Compose Docs: https://docs.docker.com/compose/

## Support

For issues or questions:
1. Check logs: `docker-compose -f docker-compose-fullstack.yml logs`
2. Verify all services are running: `docker-compose -f docker-compose-fullstack.yml ps`
3. Test individual components
4. Review this guide and troubleshooting section
