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

## Phase 6: Production Stability Fixes (Latest)

### Critical Production Issues Resolved

#### 1. Backend Healthcheck Fix
**Problem**: Healthcheck using root route (`/`) could fail under load due to:
- Database connection pool saturation
- Event loop delays
- Slow dependencies causing timeout

**Solution**: Created dedicated `/healthz` endpoint
- **Backend**: Simple endpoint returning `200 OK` with no dependencies
- **Dockerfile**: Updated healthcheck to use `/healthz`
- **docker-compose.yml**: Updated healthcheck to use `/healthz`

```javascript
// app/backend/src/index.js
app.get('/healthz', (req, res) => {
  res.status(200).send('ok');
});
```

#### 2. Database Connection Resilience
**Problem**: `depends_on: condition: service_healthy` only works at startup, not runtime. If Postgres blips after startup, backend healthcheck fails → restart loop.

**Solution**: Application-level connection retry and resilience
- **Retry Logic**: Exponential backoff (1s → 2s → 4s → 8s → 16s → 32s → max 60s)
- **Background Monitoring**: Periodic connection health checks every 10 seconds
- **Non-blocking Startup**: Server starts even if DB is temporarily unavailable
- **Automatic Reconnection**: Handles transient DB failures gracefully

```javascript
// app/backend/src/config/database.js
// Server can start without DB, retries in background
connectDatabase({ 
  retryOnFailure: true, 
  maxRetries: 10,
  allowFailure: true 
});
```

#### 3. Node.js Memory Limit
**Problem**: Node.js doesn't respect Docker memory limits. Heap grows past 512MB → OOM killer → container restart → healthcheck failures.

**Solution**: Set explicit Node.js heap limit
```dockerfile
# app/backend/Dockerfile
ENV NODE_OPTIONS="--max-old-space-size=384"
```
- 384MB heap leaves 128MB headroom for native modules, buffers, and OS overhead
- Prevents OOM kills and restart loops

#### 4. Signal Handling (dumb-init)
**Problem**: Node.js as PID 1 doesn't forward signals correctly → hanging shutdowns, zombie processes, containers marked unhealthy but not exiting.

**Solution**: Use dumb-init as init system
```dockerfile
# app/backend/Dockerfile
RUN apk add --no-cache curl dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
```

#### 5. Frontend Healthcheck Optimization
**Problem**: Healthcheck using root route can flap during nginx reloads or log spikes.

**Solution**: Static healthcheck file
- **File**: `app/frontend/public/healthz.html` (just "ok")
- **Nginx**: Direct file serving with no processing
- **docker-compose.yml**: Updated to use `/healthz.html`

```nginx
# app/frontend/nginx.conf
location = /healthz.html {
    access_log off;
    try_files $uri =404;
}
```

#### 6. Production Logging with Pino
**Problem**: Aggressive logging can cause disk I/O pressure, stall Node, and fail healthchecks.

**Solution**: Production-grade logging with Pino
- **Async Logging**: Non-blocking, minimal CPU overhead
- **Structured JSON**: Easy to parse and search
- **Log Level Control**: Set via docker-compose (no .env needed)
- **Sensitive Data Redaction**: Automatic redaction of passwords, tokens, API keys

**Configuration**:
```yaml
# docker-compose.yml (production)
environment:
  LOG_LEVEL: warn

# docker-compose.dev.yml (development)
environment:
  LOG_LEVEL: debug
```

**Logger Implementation**:
```javascript
// app/backend/src/utils/logger.js
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
// Uses Pino for async, structured JSON logging
```

### Updated Docker Compose Configuration

**Backend Service** (Production):
```yaml
backend:
  build:
    context: ./app/backend
    dockerfile: Dockerfile
  environment:
    LOG_LEVEL: warn
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/healthz"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
  depends_on:
    postgres:
      condition: service_healthy
```

**Frontend Service** (Production):
```yaml
frontend:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost/healthz.html"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 10s
```

### Key Improvements

✅ **Healthcheck Reliability**: Dedicated endpoints that don't touch DB/Redis/Judge0  
✅ **Database Resilience**: Automatic retry and reconnection on transient failures  
✅ **Memory Management**: Explicit heap limits prevent OOM kills  
✅ **Signal Handling**: Proper shutdown with dumb-init  
✅ **Logging Efficiency**: Async Pino logging with configurable levels  
✅ **Production Ready**: All fixes prevent hours-later death spirals

## Next Steps (If Needed)

1. **SSL Certificates**: Implement HTTPS with proper certificates
2. **Monitoring**: Add proper logging and monitoring (✅ Logging with Pino implemented)
3. **CI/CD**: Implement automated deployment pipeline
4. **Backup**: Set up database backup strategy

---

**Documentation Date**: October 2024  
**Last Updated**: December 2024 (Production Stability Fixes)  
**Deployment Date**: October 2024  
**Server**: questionmaker.ok.ubc.ca  
**Domain**: https://questionmaker.ok.ubc.ca/

