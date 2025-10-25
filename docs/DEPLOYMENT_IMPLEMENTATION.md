# Question Maker - Actual Deployment Implementation

This document records the **actual deployment steps** taken for the Question Maker application on UBC servers. This is a historical record of what was implemented, not a tutorial.

## Deployment Overview

**Final Architecture:**
- **Frontend**: React app served by Nginx in Docker container (port 3005)
- **Backend**: Node.js API in Docker container (port 8000)
- **Database**: PostgreSQL in Docker container (port 55432)
- **Web Server**: Apache reverse proxy handling domain routing
- **Domain**: https://questionmaker.ok.ubc.ca/

## Implementation Timeline

### Phase 1: Initial Setup Issues
**Problems Encountered:**
- SSH access issues with WSL (resolved by using PowerShell)
- Git authentication requiring Personal Access Token
- File permission issues after git clone
- Port conflicts (3000, 3001, 3002 all in use)

**Solutions Applied:**
- Used PowerShell instead of WSL for SSH
- Created GitHub Personal Access Token
- Applied proper ownership: `sudo chown -R $USER:questionmaker /srv/www/questionmaker.ok.ubc.ca`

### Phase 2: Docker Implementation Decision
**Original Plan:** Native Node.js deployment with PM2
**Actual Implementation:** Docker-based deployment

**Reason for Change:** Docker provided simpler dependency management and isolation

### Phase 3: Docker Configuration Evolution

#### Initial Docker Compose Issues
**Problems:**
- Missing `package-lock.json` in backend
- TypeScript compilation errors
- Health check failures
- Port conflicts

**Solutions:**
1. **Backend Dockerfile Fix:**
   ```dockerfile
   # Changed from:
   RUN npm ci --only=production
   # To:
   RUN npm install --omit=dev
   ```

2. **Frontend Build Optimization:**
   ```dockerfile
   # Multi-stage build with nginx
   FROM node:18-alpine AS builder
   RUN npm ci
   RUN npx vite build
   
   FROM nginx:alpine
   COPY --from=builder /app/dist /usr/share/nginx/html
   ```

3. **Health Check Bypass:**
   ```yaml
   # Removed health check dependencies due to wget issues
   depends_on:
     - backend  # Instead of condition: service_healthy
   ```

### Phase 4: Apache Configuration

#### Final Apache Configuration
**File:** `/etc/httpd/conf.d/question-maker.conf`

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

**Key Points:**
- API routes handled first (order matters)
- Frontend on port 3005 (avoided port conflicts)
- React Router support with negative lookahead regex

### Phase 5: CORS Resolution

#### Problem
Frontend making direct calls to `localhost:8000` causing CORS errors:
```
Access to XMLHttpRequest at 'http://localhost:8000/api/auth/login' 
from origin 'https://questionmaker.ok.ubc.ca' has been blocked by CORS policy
```

#### Solution
**Frontend API Configuration:**
```typescript
// Changed from:
const API_URL = 'http://localhost:8000';
// To:
const API_URL = '/api';
```

**Result:** All API calls now go through Apache proxy, eliminating CORS issues.

## Final Working Configuration

### Docker Compose (Production)
```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: eduquery-postgres
    environment:
      POSTGRES_DB: eduquery
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: cHiky5MonKe
    ports:
      - "55432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./app/backend
      dockerfile: Dockerfile
    container_name: eduquery-backend
    env_file:
      - .env
    ports:
      - "8000:8000"
    depends_on:
      - postgres
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8000/"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  frontend:
    build:
      context: ./app/frontend
      dockerfile: Dockerfile
    container_name: eduquery-frontend
    env_file:
      - .env
    ports:
      - "3005:80"
    depends_on:
      - backend
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

volumes:
  postgres_data:

networks:
  default:
    name: eduquery-network
```

### Environment Variables
```env
DATABASE_URL=postgresql://postgres:cHiky5MonKe@postgres:5432/eduquery
```

### Frontend Nginx Configuration
**File:** `app/frontend/nginx.conf`
```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    server {
        listen 80;
        server_name localhost;

        root /usr/share/nginx/html;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        location /api/ {
            proxy_pass http://backend:8000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

## Critical Decisions Made

### 1. Port Selection
- **PostgreSQL**: 55432 (avoided conflict with existing services)
- **Frontend**: 3005 (avoided conflicts with ports 3000-3002)
- **Backend**: 8000 (standard API port)

### 2. Health Check Strategy
- **Decision**: Disabled health check dependencies
- **Reason**: wget not available in Alpine containers
- **Alternative**: Could use Node.js health checks, but bypassed for simplicity

### 3. CORS Resolution
- **Problem**: Direct localhost calls from browser
- **Solution**: Relative URLs through Apache proxy
- **Result**: Same-origin requests, no CORS needed

### 4. React Router Support
- **Challenge**: Apache needs to handle client-side routing
- **Solution**: Negative lookahead regex to catch all non-API routes
- **Pattern**: `^(?!\/api\/).*`

## Troubleshooting History

### Issue 1: "Service Unavailable"
**Cause**: Missing Apache configuration file
**Solution**: Created `/etc/httpd/conf.d/question-maker.conf`

### Issue 2: "Proxy Error - DNS lookup failure"
**Cause**: Frontend container not running
**Solution**: Fixed Docker Compose dependencies

### Issue 3: Port Conflicts
**Cause**: Multiple services using ports 3000-3002
**Solution**: Used port 3005 for frontend

### Issue 4: CORS Errors
**Cause**: Frontend calling localhost:8000 directly
**Solution**: Changed API_URL to relative path '/api'

### Issue 5: Health Check Failures
**Cause**: wget not available in Alpine containers
**Solution**: Disabled health check dependencies

## Current Status

✅ **Working Components:**
- Frontend serving React app via Nginx
- Backend API responding on port 8000
- PostgreSQL database running
- Apache reverse proxy configured
- CORS issues resolved
- React Router working

✅ **Access Points:**
- Website: https://questionmaker.ok.ubc.ca/
- API: https://questionmaker.ok.ubc.ca/api/
- Direct backend: http://localhost:8000/ (server only)

## Commands Used

### Docker Management
```bash
docker compose up -d
docker compose down
docker compose ps
docker compose logs frontend
docker compose logs backend
```

### Apache Management
```bash
sudo httpd -t
sudo systemctl restart httpd
sudo tail -f /var/log/httpd/error_log
```

### Testing
```bash
curl -f http://localhost:3005/
curl -f http://localhost:8000/
curl -f http://questionmaker.ok.ubc.ca/
curl -f http://questionmaker.ok.ubc.ca/api/
```

## Lessons Learned

1. **Docker vs Native**: Docker significantly simplified deployment
2. **Port Management**: Always check for port conflicts before deployment
3. **Health Checks**: Can be problematic in Alpine containers
4. **CORS**: Relative URLs eliminate CORS issues
5. **Apache Order**: LocationMatch order matters for routing
6. **SSH Access**: PowerShell works better than WSL for UBC servers
7. **Git Authentication**: Personal Access Tokens required for GitHub

## Next Steps (If Needed)

1. **SSL Certificates**: Implement HTTPS with proper certificates
2. **Health Checks**: Fix health check implementation with Node.js
3. **Monitoring**: Add proper logging and monitoring
4. **CI/CD**: Implement automated deployment pipeline
5. **Backup**: Set up database backup strategy

---

**Documentation Date**: October 2024  
**Deployment Date**: October 2024  
**Server**: questionmaker.ok.ubc.ca  
**Domain**: https://questionmaker.ok.ubc.ca/

