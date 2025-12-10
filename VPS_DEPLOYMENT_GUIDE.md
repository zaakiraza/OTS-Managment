# Hostinger VPS Deployment Guide

## Prerequisites
- Hostinger VPS with SSH access
- VPS IP address
- Root/sudo password

## Step 1: Connect to VPS via SSH

```bash
ssh root@your-vps-ip-address
# Enter your password when prompted
```

## Step 2: Update System & Install Required Software

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js (v18 LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version

# Install PM2 (process manager to keep app running)
sudo npm install -g pm2

# Install Git
sudo apt install git -y

# Install Nginx (web server)
sudo apt install nginx -y
```

## Step 3: Clone Your Repository

```bash
# Navigate to web directory
cd /var/www

# Clone your repository
git clone https://github.com/zaakiraza/OTS-Managment.git
cd OTS-Managment
```

## Step 4: Setup Backend

```bash
# Navigate to Backend
cd Backend

# Install dependencies
npm install

# Create .env file
nano .env
```

**Paste this in .env file:**
```env
PORT=5003
MONGOURI=mongodb+srv://raazazaakir_db_user:StpHxopXiP59r7MM@attendance.1kmbqz6.mongodb.net/DB
JWT_SECRET=OTSATTENDANCEJWTSECRET
EMAIL_USER=raaza.zaakir@gmail.com
EMAIL_PASS=vbef ypan tzjp qlso
JWT_EXPIRE=7d

# ZKTeco Device Configuration
DEVICE_IP=103.197.47.170
DEVICE_PORT=4370
POLL_INTERVAL_MS=30000
```

**Press `Ctrl+X`, then `Y`, then `Enter` to save**

```bash
# Start backend with PM2
pm2 start app.js --name "attendance-backend"

# Make PM2 start on system boot
pm2 startup
pm2 save

# Check status
pm2 status
pm2 logs attendance-backend
```

## Step 5: Build & Setup Frontend

```bash
# Navigate to Frontend
cd /var/www/OTS-Managment/Frontend

# Install dependencies
npm install

# Create .env file
nano .env
```

**Paste this:**
```env
VITE_API_URL=http://your-vps-ip-address:5003/api
```
*Replace `your-vps-ip-address` with your actual VPS IP*

**Save and exit (Ctrl+X, Y, Enter)**

```bash
# Build production frontend
npm run build

# This creates a 'dist' folder with static files
```

## Step 6: Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/attendance
```

**Paste this configuration:**
```nginx
server {
    listen 80;
    server_name your-vps-ip-address;  # Replace with your actual IP or domain

    # Frontend - Serve static files
    location / {
        root /var/www/OTS-Managment/Frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API - Proxy to Node.js
    location /api {
        proxy_pass http://localhost:5003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**Save and exit (Ctrl+X, Y, Enter)**

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/attendance /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## Step 7: Configure Firewall

```bash
# Allow HTTP, HTTPS, and SSH
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5003/tcp
sudo ufw enable

# Check status
sudo ufw status
```

## Step 8: Test Your Application

Open browser and visit:
```
http://your-vps-ip-address
```

Your application should now be running!

## Step 9: Setup SSL Certificate (Optional but Recommended)

If you have a domain name pointing to your VPS:

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate (replace your-domain.com)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Certbot will auto-renew. Test renewal:
sudo certbot renew --dry-run
```

## Useful PM2 Commands

```bash
# View logs
pm2 logs attendance-backend

# Restart app
pm2 restart attendance-backend

# Stop app
pm2 stop attendance-backend

# View status
pm2 status

# View monitoring
pm2 monit
```

## Updating Your Application

When you make changes and push to GitHub:

```bash
# SSH into VPS
ssh root@your-vps-ip

# Navigate to project
cd /var/www/OTS-Managment

# Pull latest changes
git pull origin main

# Update Backend
cd Backend
npm install
pm2 restart attendance-backend

# Update Frontend
cd ../Frontend
npm install
npm run build

# Restart Nginx
sudo systemctl restart nginx
```

## Port Forwarding Setup (For Biometric Device)

In your office router:
- **External Port**: 4370
- **Internal IP**: 192.168.30.161 (biometric device)
- **Internal Port**: 4370
- **Protocol**: TCP

## Troubleshooting

### Backend not running:
```bash
pm2 logs attendance-backend
pm2 restart attendance-backend
```

### Frontend not loading:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

### Check if port 5003 is listening:
```bash
netstat -tlnp | grep 5003
```

### MongoDB connection issues:
Check if your MongoDB Atlas allows VPS IP:
1. Go to MongoDB Atlas
2. Network Access
3. Add your VPS IP address

---

## Summary

✅ Backend running on: `http://your-vps-ip:5003`
✅ Frontend accessible at: `http://your-vps-ip`
✅ PM2 keeps backend running 24/7
✅ Nginx serves frontend and proxies API requests
✅ Biometric device connects via port forwarding

Your application is now production-ready!
