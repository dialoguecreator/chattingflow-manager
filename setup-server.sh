#!/bin/bash
set -e

echo "🚀 ChattingFlowManager - Server Setup Script"
echo "============================================="

# Update system
echo "📦 Updating system..."
apt update && apt upgrade -y

# Install Node.js 20
echo "📦 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PM2 globally
echo "📦 Installing PM2..."
npm install -g pm2

# Install Nginx
echo "📦 Installing Nginx..."
apt install -y nginx

# Install Certbot for SSL
echo "📦 Installing Certbot..."
apt install -y certbot python3-certbot-nginx

# Install PostgreSQL client (for pg_dump backups)
echo "📦 Installing PostgreSQL client..."
apt install -y postgresql-client

# Create app directory
echo "📁 Creating app directory..."
mkdir -p /var/www/chattingflow
mkdir -p /root/backups

echo ""
echo "✅ System setup complete!"
echo ""
echo "Next steps:"
echo "1. Clone your repo:  cd /var/www/chattingflow && git clone <your-repo-url> ."
echo "2. Create .env file"
echo "3. Install deps:     npm install"
echo "4. Build CRM:        cd web && npx prisma generate && npx prisma db push && npm run build"
echo "5. Start apps:       pm2 start ecosystem.config.js"
echo "6. Setup Nginx:      cp nginx.conf /etc/nginx/sites-available/chattingflow"
echo "7. Enable site:      ln -s /etc/nginx/sites-available/chattingflow /etc/nginx/sites-enabled/"
echo "8. Get SSL:          certbot --nginx -d chattingflowmanager.com -d www.chattingflowmanager.com"
echo "9. Setup backup:     crontab -e  (add: 0 */8 * * * /var/www/chattingflow/backup.sh)"
