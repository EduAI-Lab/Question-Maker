# Question Maker Deployment Guide

This guide follows the exact deployment steps for your React + Node.js Question Maker application.

## Prerequisites

- Linux server with sudo access
- Domain name (e.g., yourapp.ok.ubc.ca)
- Git repository access
- **UBC VPN connection** (use `myvpn.ok.ubc.ca` for Okanagan campus)
- **Personal Access Token** for GitHub (passwords no longer work for Git operations)

## Important Notes from Actual Deployment

### SSH Access Issues
- **Use PowerShell instead of WSL** for SSH connections to UBC servers
- SSH only works when connected to UBC network (UBCSecure, VPN, or campus)
- Use the correct VPN: `myvpn.ok.ubc.ca` for Okanagan campus
- SSH may ask for password - use your server password or Personal Access Token

### Git Clone Issues
- GitHub requires Personal Access Token instead of password
- Create token at: GitHub → Settings → Developer settings → Personal access tokens
- Select `repo` scope for full repository access
- Use token as password when prompted during git clone

### File Permissions
- Always update ownership after git clone: `sudo chown -R user:group /path/to/project`
- Git clone may create files with incorrect permissions
- Use `sudo chmod -R 755 /path/to/project` for proper permissions

## Step-by-Step Deployment

### 1. Server Configuration

#### Case 1: httpd (Red Hat, CentOS, etc.)

```bash
# Edit website conf file
sudo nano /etc/httpd/conf.d/question-maker.conf
```

Insert the following into the `<VirtualHost>` configuration section:
```apache
<Location />
    ProxyPass http://localhost:5173/
    ProxyPassReverse http://localhost:5173/
</Location>
```

```bash
# Restart Apache server
sudo systemctl restart httpd
```

#### Case 2: apache2 (Debian, Ubuntu)

```bash
# Enable Proxy Modules
sudo a2enmod proxy proxy_http

# Edit website conf file
sudo nano /etc/apache2/sites-available/question-maker.conf
```

Insert the following into the `<VirtualHost>` configuration section:
```apache
<Location />
    ProxyPass http://localhost:5173/
    ProxyPassReverse http://localhost:5173/
</Location>
```

```bash
# Restart Apache server
sudo systemctl restart apache2
```

### 2. Ownership and Permissions

```bash
# Check if group exists
getent group

# If not, create a new group
sudo groupadd questionmaker

# Add user to group
sudo usermod -aG questionmaker $USER

# Add Apache user to group (choose based on your system)
sudo usermod -aG questionmaker www-data  # For Debian/Ubuntu
sudo usermod -aG questionmaker apache     # For CentOS/RHEL

# Add root to group
sudo usermod -aG questionmaker root

# Verify group membership
getent group questionmaker

# Update ownership and permissions
sudo chown -R $USER:questionmaker /srv/www/question-maker
sudo chmod -R 755 /srv/www/question-maker
```

### 3. Clone from GitHub and Setup

```bash
# Navigate to directory
cd /srv/www/questionmaker.ok.ubc.ca

# Clone repository (creates subdirectory)
git clone https://github.com/question-maker-org/question-maker.git .

# If git clone creates subdirectory, move files:
# mv question-maker/{*,.*} .
# mv question-maker/.* . 2>/dev/null || true
# rmdir question-maker

# Update .env file with correct info (especially Database URL)
cp env.production.template .env
nano .env

# Reapply ownership and permissions (CRITICAL after git clone)
sudo chown -R $USER:questionmaker /srv/www/questionmaker.ok.ubc.ca
sudo chmod -R 755 /srv/www/questionmaker.ok.ubc.ca
```

**Important:** Git clone may create files with incorrect permissions. Always run the ownership and permissions commands after cloning.

### 4. npm Installation

```bash
# Check Node.js version
node -v
npm -v

# If outdated, update Node.js
sudo npm install -g n
sudo -E env "PATH=$PATH" n stable
hash -r
node -v

# Install dependencies for both backend and frontend
cd app/backend
npm i
cd ../..

cd app/frontend
npm i
cd ../..

# If you get permission errors, update ownership:
sudo chown -R $USER:questionmaker /srv/www/questionmaker.ok.ubc.ca
sudo chmod -R 755 /srv/www/questionmaker.ok.ubc.ca
```

**Note:** Dependencies are in separate `app/backend` and `app/frontend` directories, not in the root.

### 5. Prepare Deployment Files

Ensure these files are in your project root (`/srv/www/question-maker/`):
- `deploy.sh`
- `ecosystem.config.cjs`

```bash
# Make deploy script executable
chmod +x deploy.sh

# Install PM2 globally
sudo npm i -g pm2

# Setup PM2 startup (run once)
pm2 startup
# Follow the instructions PM2 provides

# Save PM2 configuration
pm2 save
```

### 6. Run Deployment Script

```bash
# Navigate to project directory
cd /srv/www/question-maker

# Run deployment script
./deploy.sh
```

## Verification

After deployment, you should see:
- Backend running on port 8000
- Frontend running on port 5173
- Apache proxying traffic to port 5173

Visit your domain to test the application.

## Useful Commands

```bash

ssh cwl@questionmaker.ok.ubc.ca
cd /srv/www/questionmaker.ok.ubc.ca
# PM2 Management
pm2 list                    # List all processes
pm2 logs question-maker-backend    # View backend logs
pm2 logs question-maker-frontend   # View frontend logs
pm2 restart question-maker-backend # Restart backend
pm2 restart question-maker-frontend # Restart frontend
pm2 monit                   # Monitor processes
pm2 save                    # Save current process list

# Apache Management
sudo systemctl restart apache2    # Restart Apache (Debian/Ubuntu)
sudo systemctl restart httpd      # Restart Apache (CentOS/RHEL)
sudo apache2ctl configtest        # Test Apache configuration (Debian/Ubuntu)
sudo httpd -t                    # Test Apache configuration (CentOS/RHEL)
```

## Troubleshooting

### Common Issues

1. **"Service Unavailable" Error**
   - Check if PM2 processes are running: `pm2 list`
   - Check Apache error logs: `sudo tail -f /var/log/apache2/error.log`
   - Verify ports are not blocked: `sudo netstat -tlnp | grep :5173`

2. **Permission Issues**
   - Verify group membership: `getent group questionmaker`
   - Reapply ownership: `sudo chown -R $USER:questionmaker /srv/www/question-maker`

3. **PM2 Issues**
   - Check PM2 logs: `pm2 logs`
   - Restart PM2 processes: `pm2 restart all`

### Log Locations
- PM2 logs: `/var/log/pm2/`
- Apache logs: `/var/log/apache2/` (Debian/Ubuntu) or `/var/log/httpd/` (CentOS/RHEL)

## Alternative: Docker Deployment (Easier Option)

If you prefer a simpler deployment, you can use Docker instead:

```bash
# Install Docker and Docker Compose
sudo dnf install -y docker docker-compose

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in, then run:
docker-compose up -d
```

This handles all dependencies, database setup, and configuration automatically.

## Important Notes

1. **Port Configuration**: The frontend runs on port 5173, which matches your Vite development server port
2. **Apache Proxy**: Simple ProxyPass configuration as specified in the deployment steps
3. **File Structure**: Ensure `deploy.sh` and `ecosystem.config.cjs` are in the project root
4. **Environment Variables**: Update `.env` file with production values before deployment
5. **SSH Access**: Use PowerShell, not WSL, for UBC server connections
6. **GitHub Access**: Use Personal Access Token, not password
7. **Permissions**: Always update ownership after git clone operations

## Lessons Learned

- **SSH Issues**: WSL doesn't work well with UBC servers; use PowerShell
- **Git Authentication**: GitHub requires Personal Access Tokens
- **File Permissions**: Git clone creates files with incorrect ownership
- **Docker Alternative**: Much simpler than native Node.js deployment
- **UBC VPN**: Must use `myvpn.ok.ubc.ca` for Okanagan campus access

This deployment follows the exact steps you provided and should work seamlessly with your Question Maker application.
