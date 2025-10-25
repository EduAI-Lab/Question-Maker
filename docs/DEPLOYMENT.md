# Question Maker Deployment Guide

This guide provides step-by-step instructions for deploying the Question Maker application using Docker on UBC servers.

## Prerequisites

- Linux server with sudo access
- Domain name (e.g., yourapp.ok.ubc.ca)
- Git repository access
- **UBC VPN connection** (use `myvpn.ok.ubc.ca` for Okanagan campus)
- **Personal Access Token** for GitHub (passwords no longer work for Git operations)
- Docker and Docker Compose installed

## CI/CD Pipeline

The Question Maker application uses GitHub Actions for automated testing and deployment.

### Automatic Deployment

**Triggers:**
- ✅ **Push to `deploy` branch** - Automatically deploys to staging
- ✅ **Push to `main` branch** - Automatically deploys to production
- ✅ **Pull requests** - Runs tests and Docker builds (no deployment)

### Manual Deployment

**Option 1: GitHub Actions UI**
1. Go to your repository on GitHub
2. Click **Actions** tab
3. Select **CI/CD Pipeline** workflow
4. Click **Run workflow** button
5. Select branch and click **Run workflow**

**Option 2: Command Line**
```bash
# Push to staging (deploy branch)
git push origin deploy

# Push to production (main branch)
git push origin main

# Or create a new commit to trigger deployment
git add .
git commit -m "Deploy latest changes"
git push origin deploy  # or main
```

### Required GitHub Secrets

Add these secrets in GitHub repository settings:

1. **`UBC_SERVER_SSH_KEY`** - Your SSH private key for server access
   - Generate: `ssh-keygen -t rsa -b 4096 -C "your_email@example.com"`
   - Copy private key content to GitHub secret

2. **`DATABASE_URL`** - Database connection string
   - Format: `postgresql://postgres:password@postgres:5432/eduquery`

3. **`OPENAI_API_KEY`** - OpenAI API key for AI features

4. **`EDUAI_API_KEY`** - EduAI API key for educational AI features

5. **`PERSONAL_ACCESS_TOKEN`** - GitHub Personal Access Token
   - For Git operations and API access

### Pipeline Jobs

1. **`feature-ci.yml`** - Feature branch linting and testing
2. **`deploy.yml`** - Deploy branch (staging deployment)
3. **`main.yml`** - Main branch (production deployment)

### Monitoring Deployments

- **GitHub Actions**: View deployment status in Actions tab
- **Server Logs**: SSH to server and run `docker compose logs`
- **Health Checks**: Pipeline automatically tests endpoints after deployment

## SSH Connection

### 1. Connect to UBC Server

```bash
# Connect to UBC VPN first (if not on campus)
# Then SSH to your server
ssh ssaada08@questionmaker.ok.ubc.ca

# Navigate to project directory
cd /srv/www/questionmaker.ok.ubc.ca
```

**Important Notes:**
- Use **PowerShell** instead of WSL for UBC servers
- Must be connected to UBC network (VPN or campus)
- Use your UBC credentials for SSH

## Quick Start

### 1. Server Setup

```bash
# Install Docker and Docker Compose
sudo dnf install -y docker docker-compose

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in for group changes to take effect
```

### 2. Clone Repository

```bash
# Navigate to web directory
cd /srv/www/questionmaker.ok.ubc.ca

# Clone repository
git clone https://github.com/question-maker-org/question-maker.git .

# Update ownership and permissions
sudo chown -R $USER:questionmaker /srv/www/questionmaker.ok.ubc.ca
sudo chmod -R 755 /srv/www/questionmaker.ok.ubc.ca
```

### 3. Environment Configuration

```bash
# Create environment file
cp env.production.template .env
nano .env
```

**Required Environment Variables:**
```env
DATABASE_URL=postgresql://postgres:your_password@postgres:5432/eduquery
```

### 4. Apache Configuration

```bash
# Create Apache configuration
sudo nano /etc/httpd/conf.d/question-maker.conf
```

**Apache Configuration:**
```apache
# Handle API routes - proxy to backend (MUST come first)
<LocationMatch "^/api/">
    ProxyPass http://localhost:8000
    ProxyPassReverse http://localhost:8000
    ProxyPreserveHost On
</LocationMatch>

# Handle all other requests - send to frontend
<LocationMatch "^(?!\/api\/).*">
    ProxyPass http://localhost:3005
    ProxyPassReverse http://localhost:3005
    ProxyPreserveHost On
</LocationMatch>
```

```bash
# Test and restart Apache
sudo httpd -t
sudo systemctl restart httpd
```

### 5. Deploy with Docker

```bash
# Start all services
docker compose up -d

# Check status
docker compose ps

# View logs if needed
docker compose logs frontend
docker compose logs backend
```

## Verification

After deployment, verify:

```bash
# Test local endpoints
curl -f http://localhost:3005/    # Frontend
curl -f http://localhost:8000/    # Backend API

# Test through Apache
curl -f http://questionmaker.ok.ubc.ca/
curl -f http://questionmaker.ok.ubc.ca/api/
```

## Architecture Overview

```
Internet → Apache (Reverse Proxy) → Docker Containers
                                    ├── Frontend (Nginx + React) - Port 3005
                                    ├── Backend (Node.js API) - Port 8000
                                    └── Database (PostgreSQL) - Port 55432
```

## Troubleshooting

### Common Issues

1. **"Service Unavailable" Error**
   - Check if containers are running: `docker compose ps`
   - Check Apache error logs: `sudo tail -f /var/log/httpd/error_log`
   - Verify Apache configuration: `sudo httpd -t`

2. **Port Conflicts**
   - Check what's using ports: `sudo netstat -tlnp | grep :3005`
   - Change port in docker-compose.yml if needed
   - Update Apache configuration to match

3. **CORS Errors**
   - Ensure frontend uses relative URLs (`/api` not `http://localhost:8000`)
   - Check Apache is properly routing `/api/*` to backend

4. **Container Issues**
   - View container logs: `docker compose logs [service-name]`
   - Restart containers: `docker compose restart`
   - Rebuild if needed: `docker compose build`

### Useful Commands

```bash
# Docker Management
docker compose up -d              # Start all services
docker compose down              # Stop all services
docker compose ps                # Check status
docker compose logs -f           # Follow logs
docker compose restart frontend  # Restart specific service

# Apache Management
sudo httpd -t                    # Test configuration
sudo systemctl restart httpd     # Restart Apache
sudo tail -f /var/log/httpd/error_log  # View error logs

# Testing
curl -f http://localhost:3005/   # Test frontend
curl -f http://localhost:8000/  # Test backend
curl -f http://questionmaker.ok.ubc.ca/  # Test website
```

## Important Notes

1. **Port Configuration**: 
   - Frontend: 3005 (external) → 80 (internal)
   - Backend: 8000
   - Database: 55432 (external) → 5432 (internal)

2. **File Structure**: 
   - Docker Compose file in project root
   - Environment variables in `.env` file
   - Apache configuration in `/etc/httpd/conf.d/`

3. **SSH Access**: 
   - Use PowerShell instead of WSL for UBC servers
   - Must be connected to UBC network (VPN or campus)

4. **Git Authentication**: 
   - Use Personal Access Token, not password
   - Create token at: GitHub → Settings → Developer settings

## Security Considerations

- Containers run with non-root users
- Only necessary ports are exposed
- Internal communication uses Docker network
- Apache handles SSL termination (when certificates are configured)

## Performance Optimization

- Frontend served by Nginx with caching headers
- Static assets compressed with Gzip
- Database connection pooling
- Container health checks (when working)

## Backup and Recovery

```bash
# Database backup
docker exec eduquery-postgres pg_dump -U postgres eduquery > backup.sql

# Restore database
docker exec -i eduquery-postgres psql -U postgres eduquery < backup.sql

# Configuration backup
cp docker-compose.yml docker-compose.yml.backup
cp .env .env.backup
sudo cp /etc/httpd/conf.d/question-maker.conf question-maker.conf.backup
```

---

**For detailed implementation history, see [DEPLOYMENT_IMPLEMENTATION.md](./DEPLOYMENT_IMPLEMENTATION.md)**  
**For architecture details, see [ARCHITECTURE.md](./ARCHITECTURE.md)**
