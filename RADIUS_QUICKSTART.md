# Quick Reference: FreeRADIUS Integration

## Start the Stack
```bash
docker-compose -f docker-compose-fullstack.yml up -d
```

## Services
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **PostgreSQL**: localhost:5432
- **FreeRADIUS Auth**: localhost:1812/udp
- **FreeRADIUS Acct**: localhost:1813/udp

## Default Credentials
- **DB User**: postgres
- **DB Password**: postgres_secret (change in production!)
- **RADIUS Secret**: testing123 (change in production!)

## Key Files
- `radius/clients.conf` - Add your MikroTik routers
- `radius/mods-available/sql` - Database configuration
- `radius/radius_schema.sql` - Database schema
- `server/.env` - Environment variables

## Add MikroTik Router
Edit `radius/clients.conf`:
```conf
client my_mikrotik {
    ipaddr = 192.168.88.1
    secret = your_secret
    nas_type = "mikrotik"
}
```

## Configure MikroTik
```mikrotik
/radius add address=YOUR_SERVER_IP secret=your_secret service=login
/radius set use-radius=yes
```

## Test RADIUS
```bash
docker-compose -f docker-compose-fullstack.yml exec radius \
  radtest testuser testpass localhost 1812 testing123
```

## Useful Commands
```bash
# View logs
docker-compose -f docker-compose-fullstack.yml logs -f radius

# Check services
docker-compose -f docker-compose-fullstack.yml ps

# Enter container
docker-compose -f docker-compose-fullstack.yml exec radius bash

# Database shell
docker-compose -f docker-compose-fullstack.yml exec postgres psql -U postgres

# Stop
docker-compose -f docker-compose-fullstack.yml down

# Stop + delete data
docker-compose -f docker-compose-fullstack.yml down -v
```

## Add User to RADIUS
```sql
INSERT INTO radcheck (username, attribute, op, value) 
VALUES ('user001', 'User-Password', ':=', 'secret123');
```

## Check Active Sessions
```sql
SELECT username, nasipaddress, acctstarttime, acctsessiontime
FROM radacct WHERE acctstoptime IS NULL;
```
