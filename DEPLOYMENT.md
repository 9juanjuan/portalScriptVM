# Portal Monitor Bot - DigitalOcean VM Deployment Guide

This guide covers deploying the portal monitoring bot to a DigitalOcean VM using PM2 for process management.

## Prerequisites

- DigitalOcean droplet (Ubuntu 20.04+ recommended)
- SSH access to your VM
- Domain/portal credentials

## Quick Deployment

### 1. Create DigitalOcean Droplet

**Recommended specs:**
- **Size**: Basic droplet (1GB RAM, 1 vCPU) minimum
- **OS**: Ubuntu 20.04 LTS or newer
- **Storage**: 25GB SSD minimum

### 2. Initial VM Setup

SSH into your droplet and run the setup script:

```bash
# Clone the repository
git clone <your-repo-url> /opt/portal-monitor
cd /opt/portal-monitor

# Make setup script executable and run it
chmod +x setup-vm.sh
./setup-vm.sh
```

The setup script will install:
- Node.js 18.x
- System dependencies for Chromium
- PM2 process manager
- Required system libraries

### 3. Install Application Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Playwright Chromium browser
npm run install:browsers
```

### 4. Configure Environment

```bash
# Copy and edit the production environment file
cp .env.production .env
nano .env
```

**Required environment variables:**
```bash
PORTAL_URL=https://your-portal.com
USER_EMAIL=your.email@example.com
USER_PASSWORD=your_secure_password
CHECK_INTERVAL_MINUTES=5
```

### 5. Deploy with PM2

```bash
# Start the application
npm run pm2:start

# Save PM2 configuration for auto-restart on boot
pm2 save

# Set up PM2 to start on system boot
pm2 startup
# Follow the instructions provided by the startup command
```

## Management Commands

### PM2 Process Management

```bash
# Check status
npm run pm2:status

# View logs
npm run pm2:logs

# Restart application
npm run pm2:restart

# Stop application
npm run pm2:stop
```

### System Monitoring

```bash
# View real-time process monitoring
pm2 monit

# Check system resources
htop

# View application logs
tail -f logs/combined.log
```

## File Structure on VM

```
/opt/portal-monitor/
├── src/
│   ├── index.js           # Main application entry
│   ├── PortalMonitor.js   # Core monitoring logic
│   └── logger.js          # Logging configuration
├── logs/                  # Application logs and screenshots
├── ecosystem.config.js    # PM2 configuration
├── .env                   # Environment variables
└── package.json
```

## Troubleshooting

### Common Issues

**Browser fails to launch:**
```bash
# Reinstall Chromium dependencies
sudo apt-get install --reinstall chromium-browser
npm run install:browsers
```

**Permission errors:**
```bash
# Fix ownership
sudo chown -R $USER:$USER /opt/portal-monitor
```

**Memory issues:**
```bash
# Check memory usage
free -h
# Consider upgrading droplet size if needed
```

### Log Locations

- **Application logs**: `/opt/portal-monitor/logs/`
- **PM2 logs**: `~/.pm2/logs/`
- **System logs**: `/var/log/syslog`

### Monitoring Health

The application logs its status every hour. Check for:
- Successful login attempts
- Portal check results
- Any error messages or failures

## Security Considerations

1. **Firewall**: Only expose necessary ports (SSH: 22)
2. **SSH Keys**: Use SSH keys instead of passwords
3. **Environment Variables**: Never commit `.env` files to version control
4. **Updates**: Regularly update system packages

## Scaling and Maintenance

### Regular Maintenance

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Node.js dependencies
npm update

# Restart application after updates
npm run pm2:restart
```

### Log Rotation

PM2 handles log rotation automatically, but you can configure it in `ecosystem.config.js`:

```javascript
max_memory_restart: '1G',  // Restart if memory exceeds 1GB
```

## Cost Optimization

**DigitalOcean Droplet Recommendations:**
- **Development/Testing**: $5/month (1GB RAM)
- **Production**: $10/month (2GB RAM) for better stability
- **High-frequency monitoring**: $15/month (2GB RAM, 2 vCPUs)

## Support

For issues:
1. Check application logs: `npm run pm2:logs`
2. Verify environment configuration
3. Ensure portal credentials are correct
4. Check system resources with `htop`
