# MikroTik Config Builder

A full-stack web application that generates MikroTik RouterOS scripts automatically. Designed for network engineers and ISPs to create complete MikroTik configurations without manually typing commands.

![MikroTik Config Builder](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Features

### 10 Configuration Modules

| Module | Description |
|--------|-------------|
| **Interfaces & Switching** | Bridge creation, VLAN setup, bridge ports, VLAN filtering (RouterOS v7 style) |
| **IP Configuration** | IPv4/IPv6 addressing, DNS settings, DHCP client/server |
| **Routing** | Static routes, OSPF, BGP, Policy Based Routing (PBR), VRF support |
| **Firewall & NAT** | Filter rules, NAT masquerade, port forwarding, FastTrack, mangle, address-lists |
| **ISP Services** | PPPoE server, PPP profiles/secrets, Hotspot setup, RADIUS integration |
| **Bandwidth Management** | Simple queues, queue trees, PCQ profiles, predefined speed profiles |
| **VPN & Tunnels** | WireGuard, L2TP/IPsec, SSTP, IPsec site-to-site, GRE, EoIP, IPIP |
| **Load Balancing** | PCC load balancing (2/3 WAN), ECMP, recursive routing, netwatch failover |
| **Wireless** | Wireless SSID, security profiles, CAPsMAN controller config |
| **System & Monitoring** | NTP, SNMP, logging, backup scheduler, service management, user creation |

### Key Features

- **RouterOS v6 & v7 Support**: Generate scripts compatible with both RouterOS versions
- **Input Validation**: Validates configurations before generating scripts
- **Script Output**: Clean, commented MikroTik CLI commands
- **Export as .rsc**: Download generated scripts as RouterOS script files
- **Copy to Clipboard**: One-click copy functionality
- **Project Management**: Create and manage multiple configuration projects
- **Reusable Templates**: Save and apply common configurations
- **MikroTik API Push**: Push generated scripts directly to MikroTik devices via API
- **Version History**: Track changes per project (optional)

## Tech Stack

- **Frontend**: React 18 + Vite + TailwindCSS + Zustand
- **Backend**: Node.js + Express
- **Database**: PostgreSQL 15
- **Deployment**: Docker + Docker Compose

## Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Docker & Docker Compose (optional, for containerized deployment)

## Quick Start

### Option 1: Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mikrotik-config-builder
   ```

2. **Install dependencies**
   ```bash
   # Root dependencies
   npm install

   # Server dependencies
   cd server
   npm install

   # Client dependencies
   cd ../client
   npm install
   cd ..
   ```

3. **Set up PostgreSQL**
   ```bash
   # Create database
   createdb mikrotik_config_builder
   ```

4. **Configure environment**
   ```bash
   cd server
   cp .env.example .env
   # Edit .env with your database credentials
   ```

5. **Run database migrations**
   ```bash
   npm run db:migrate
   npm run db:seed  # Optional: Load example templates
   ```

6. **Start development servers**
   ```bash
   # From project root
   npm run dev
   ```

   This starts:
   - Backend API on `http://localhost:5000`
   - Frontend on `http://localhost:5173`

### Option 2: Docker Compose

1. **Build and start all services**
   ```bash
   docker-compose up -d
   ```

2. **Access the application**
   - Frontend: `http://localhost`
   - Backend API: `http://localhost:5000`
   - Database: `localhost:5432`

3. **Stop services**
   ```bash
   docker-compose down
   ```

## Project Structure

```
mikrotik-config-builder/
├── client/                      # React frontend
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   └── Sidebar.jsx
│   │   ├── modules/             # Configuration module forms
│   │   │   ├── InterfacesModule.jsx
│   │   │   ├── IPConfigModule.jsx
│   │   │   ├── RoutingModule.jsx
│   │   │   ├── FirewallModule.jsx
│   │   │   ├── ISPModule.jsx
│   │   │   ├── BandwidthModule.jsx
│   │   │   ├── VPNModule.jsx
│   │   │   ├── LoadBalancingModule.jsx
│   │   │   ├── WirelessModule.jsx
│   │   │   └── SystemModule.jsx
│   │   ├── pages/               # Page components
│   │   │   ├── Dashboard.jsx
│   │   │   ├── ProjectDetail.jsx
│   │   │   ├── Templates.jsx
│   │   │   ├── MikroTikAPI.jsx
│   │   │   └── ScriptOutput.jsx
│   │   ├── App.jsx
│   │   ├── store.js             # Zustand state management
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── server/                      # Express backend
│   ├── src/
│   │   ├── db/                  # Database layer
│   │   │   ├── index.js         # PostgreSQL connection pool
│   │   │   ├── migrate.js       # Database migrations
│   │   │   └── seed.js          # Seed data (example templates)
│   │   ├── generators/          # Script generators
│   │   │   ├── index.js         # Main orchestrator
│   │   │   ├── interfaces.js    # Interfaces & switching
│   │   │   ├── ipconfig.js      # IP configuration
│   │   │   ├── routing.js       # Routing (OSPF, BGP, etc.)
│   │   │   ├── firewall.js      # Firewall & NAT
│   │   │   ├── isp.js           # ISP services
│   │   │   ├── bandwidth.js     # Bandwidth management
│   │   │   ├── vpn.js           # VPN & tunnels
│   │   │   ├── loadbalancing.js # Load balancing
│   │   │   ├── wireless.js      # Wireless & CAPsMAN
│   │   │   └── system.js        # System & monitoring
│   │   ├── routes/              # API routes
│   │   │   ├── projects.js
│   │   │   ├── modules.js
│   │   │   ├── generator.js
│   │   │   ├── templates.js
│   │   │   └── mikrotik.js
│   │   └── index.js             # Express app entry point
│   └── package.json
│
├── docker-compose.yml           # Docker orchestration
├── Dockerfile.server            # Backend Docker image
├── Dockerfile.client            # Frontend Docker image
└── README.md
```

## API Endpoints

### Projects
```
GET    /api/projects           # List all projects
POST   /api/projects           # Create project
GET    /api/projects/:id       # Get project with modules
PUT    /api/projects/:id       # Update project
DELETE /api/projects/:id       # Delete project
```

### Modules
```
GET    /api/modules/project/:projectId  # Get modules for project
POST   /api/modules                     # Create/update module
DELETE /api/modules/:id                 # Delete module
```

### Generator
```
POST   /api/generator/generate          # Generate script from modules
POST   /api/generator/project/:id       # Generate script from saved project
```

### Templates
```
GET    /api/templates              # List templates
GET    /api/templates/:id          # Get single template
POST   /api/templates              # Create template
PUT    /api/templates/:id          # Update template
DELETE /api/templates/:id          # Delete template
```

### MikroTik API
```
GET    /api/mikrotik              # List saved connections
POST   /api/mikrotik              # Save connection
POST   /api/mikrotik/test         # Test connection
POST   /api/mikrotik/push         # Push script to device
DELETE /api/mikrotik/:id          # Delete connection
```

## Usage Guide

### Creating a Project

1. Navigate to the Dashboard
2. Click "New Project"
3. Enter project name, description, and RouterOS version
4. Click "Create"

### Configuring Modules

1. Open a project
2. Select a module from the left sidebar
3. Fill in configuration fields
4. Click "Save" to persist configuration
5. Green checkmarks indicate configured modules

### Generating Scripts

1. Configure desired modules in your project
2. Click "Generate Script"
3. Review the generated script
4. Check validation results for any errors
5. Copy to clipboard or download as `.rsc` file

### Applying to MikroTik

1. Go to "MikroTik API" page
2. Add your router connection details (IP, port, credentials)
3. Test the connection
4. Save the connection
5. From project view, generate script
6. Use the Push button to send script to device

**⚠️ Warning**: Always test configurations in a lab environment before applying to production routers.

## Example Configurations

The seed data includes these example templates:

- **Basic VLAN Setup**: VLAN interfaces with IP addresses
- **OSPF Single Area**: Basic OSPF configuration
- **BGP Basic Setup**: BGP with peer configuration
- **PPPoE Server**: Complete PPPoE setup with profiles
- **Hotspot Setup**: Hotspot with walled garden
- **WireGuard VPN**: WireGuard server and peers
- **Basic Firewall**: Standard firewall with NAT

Load these via: `npm run db:seed`

## MikroTik API Setup

To enable the API push feature on your MikroTik router:

1. Enable API service:
   ```
   /ip service enable api
   /ip service set api port=8728
   ```

2. Create API user with full permissions:
   ```
   /user add name=api-user password=strong-password group=full
   ```

3. Configure allowed addresses (optional but recommended):
   ```
   /ip service set api address=192.168.1.0/24
   ```

## Production Deployment

### Environment Variables

```env
# Server
PORT=5000
NODE_ENV=production
DB_HOST=db
DB_PORT=5432
DB_NAME=mikrotik_config_builder
DB_USER=postgres
DB_PASSWORD=your-secure-password
CORS_ORIGIN=https://yourdomain.com
ENCRYPTION_KEY=your-32-character-encryption-key

# Database
POSTGRES_DB=mikrotik_config_builder
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-secure-password
```

### Docker Production

```bash
# Build production images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f server

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Reverse Proxy

For production, place a reverse proxy (nginx/traefik/caddy) in front of the application with SSL/TLS termination.

## Security Considerations

- Passwords for MikroTik connections are encrypted using AES-256-GCM
- Change the default `ENCRYPTION_KEY` in production
- Use environment variables for all secrets
- Enable CORS only for your frontend domain in production
- Use HTTPS for all production deployments
- Restrict API access to specific IP ranges on your routers

## Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Run migrations manually
cd server && npm run db:migrate
```

### Port Conflicts
- Backend: Change `PORT` in `.env`
- Frontend: Change `server.port` in `client/vite.config.js`
- Database: Change port mapping in `docker-compose.yml`

### Generator Not Producing Output
- Ensure at least one module is configured
- Check browser console for errors
- Verify backend API is accessible

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

For issues, feature requests, or questions:
- Open an issue on GitHub
- Check existing documentation
- Review MikroTik official docs for RouterOS syntax

## Disclaimer

This tool generates MikroTik RouterOS configuration scripts. Always review generated scripts before applying them to production devices. The authors are not responsible for network disruptions caused by misconfigurations.

---

**Built with ❤️ for the Network Engineering Community**
