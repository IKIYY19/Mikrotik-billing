# TR-069 ACS Setup Guide

## Overview

The MikroTik Billing System now includes TR-069 (CWMP) support for remote CPE device management. The current implementation provides the foundation with a service layer and API endpoints, but full functionality requires setting up GenieACS as a separate process.

## Current Implementation Status

**✅ Completed:**
- TR-069 device database schema and CRUD operations
- UI for registering and managing CPE devices
- Service layer for TR-069 operations (`server/src/services/tr069Service.js`)
- API endpoints for device management
- Integration with GenieACS npm package

**⚠️ Placeholder (Requires Full GenieACS Setup):**
- Actual CWMP protocol communication with CPE devices
- Reboot and FactoryReset RPC commands
- GetParameterValues/SetParameterValues operations
- Inform message handling from CPEs

## Full TR-069 Setup Requirements

To enable actual remote management of CPE devices, you need to run GenieACS as a separate service. GenieACS requires:

### 1. MongoDB
GenieACS uses MongoDB to store device data and provisioning information.

**Install MongoDB:**
```bash
# Windows (using Chocolatey)
choco install mongodb

# Linux
sudo apt-get install mongodb

# macOS
brew install mongodb-community
```

**Start MongoDB:**
```bash
# Windows
net start MongoDB

# Linux
sudo systemctl start mongodb

# macOS
brew services start mongodb-community
```

### 2. Redis
GenieACS uses Redis for caching and session management.

**Install Redis:**
```bash
# Windows (using Chocolatey)
choco install redis-64

# Linux
sudo apt-get install redis-server

# macOS
brew install redis
```

**Start Redis:**
```bash
# Windows
redis-server

# Linux
sudo systemctl start redis

# macOS
brew services start redis
```

### 3. Install GenieACS Globally
```bash
npm install -g genieacs
```

### 4. Configure GenieACS
Create a configuration file `genieacs/config/config.json`:

```json
{
  "EXT": {
    "PORT": 7547,
    "INTERFACE": "0.0.0.0"
  },
  "NBI": {
    "PORT": 7548,
    "INTERFACE": "0.0.0.0"
  },
  "FS": {
    "PORT": 7549,
    "INTERFACE": "0.0.0.0"
  },
  "UI": {
    "PORT": 7550,
    "INTERFACE": "0.0.0.0"
  },
  "MongoDB": {
    "HOST": "localhost",
    "PORT": 27017,
    "DATABASE": "genieacs"
  },
  "Redis": {
    "HOST": "localhost",
    "PORT": 6379
  }
}
```

### 5. Start GenieACS Services
```bash
# Start the CWMP server (listens for CPE connections)
genieacs-cwmp

# Start the NBI server (Northbound Interface for API access)
genieacs-nbi

# Start the FS server (File Server for firmware downloads)
genieacs-fs

# Start the UI server (Web interface)
genieacs-ui
```

### 6. Configure CPE Devices
On your CPE devices (routers, ONTs, etc.), configure the ACS URL:

```
ACS URL: http://your-server-ip:7547
ACS Username: your-acs-username
ACS Password: your-acs-password
```

## Integration with Billing System

Once GenieACS is running, you can:

1. **Register CPE devices** via the TR-069 page in the billing system
2. **Monitor device status** through the dashboard
3. **Send RPC commands** (Reboot, FactoryReset) from the UI
4. **View device parameters** and configure settings remotely

## API Endpoints

The billing system provides these TR-069 endpoints:

- `GET /api/tr069` - List all registered devices
- `POST /api/tr069` - Register a new device
- `GET /api/tr069/:id` - Get device details
- `PUT /api/tr069/:id` - Update device information
- `DELETE /api/tr069/:id` - Delete a device
- `POST /api/tr069/:id/reboot` - Send reboot command
- `POST /api/tr069/:id/factory-reset` - Send factory reset command
- `POST /api/tr069/:id/inform` - Process Inform message from CPE

## Troubleshooting

**CPE not connecting:**
- Check firewall allows port 7547
- Verify ACS URL is correct in CPE configuration
- Check GenieACS logs: `genieacs-cwmp` output

**Commands not executing:**
- Ensure GenieACS NBI service is running on port 7548
- Check device is online and has communicated with ACS
- Verify device authentication credentials

**Database errors:**
- Ensure MongoDB is running and accessible
- Check GenieACS can connect to MongoDB
- Verify database name in config matches

## Next Steps

For production deployment, consider:
1. Running GenieACS as a systemd service
2. Setting up HTTPS for secure CPE communication
3. Configuring device provisioning scripts
4. Setting up monitoring and alerts for ACS service
5. Implementing backup strategies for MongoDB

## References

- [GenieACS Documentation](https://genieacs.com/docs/)
- [TR-069 Specification](https://www.broadband-forum.org/technical/download/TR-069_Amendment-6.pdf)
- [CWMP Protocol Overview](https://en.wikipedia.org/wiki/TR-069)
