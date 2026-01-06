#!/bin/bash
# DigitalOcean VM Setup Script for Portal Monitor Bot
# Run this script on a fresh Ubuntu 20.04+ droplet

set -e

echo "🚀 Setting up Portal Monitor Bot on DigitalOcean VM..."

# Update system packages
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x (LTS)
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install system dependencies for Playwright/Chromium
echo "📦 Installing system dependencies for Chromium..."
sudo apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils

# Install PM2 globally for process management
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Create application directory
echo "📁 Creating application directory..."
sudo mkdir -p /opt/portal-monitor
sudo chown $USER:$USER /opt/portal-monitor

# Create logs directory
sudo mkdir -p /opt/portal-monitor/logs
sudo chown $USER:$USER /opt/portal-monitor/logs

# Install Git if not present
echo "📦 Installing Git..."
sudo apt-get install -y git

# Set up firewall (optional - adjust ports as needed)
echo "🔥 Setting up basic firewall..."
sudo ufw allow ssh
sudo ufw allow 22
sudo ufw --force enable

# Create systemd service for PM2 (auto-start on boot)
echo "⚙️  Setting up PM2 startup service..."
pm2 startup systemd -u $USER --hp /home/$USER

echo "✅ VM setup complete!"
echo ""
echo "Next steps:"
echo "1. Clone your repository to /opt/portal-monitor"
echo "2. cd /opt/portal-monitor && npm install"
echo "3. npx playwright install chromium"
echo "4. Copy your .env.production file"
echo "5. pm2 start ecosystem.config.js --env production"
echo "6. pm2 save"
echo ""
echo "Useful commands:"
echo "- pm2 status          # Check process status"
echo "- pm2 logs            # View logs"
echo "- pm2 restart all     # Restart processes"
echo "- pm2 stop all        # Stop processes"
