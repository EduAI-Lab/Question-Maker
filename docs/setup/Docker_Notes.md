# Docker Architecture & Setup Guide

This document explains how Docker is implemented in the Question maker project, covering the architecture, configuration, and best practices.

## 🏗️ Architecture Overview

The application uses a microservices architecture with Docker containers for each component:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Nginx       │    │    Frontend     │    │    Backend      │
│  (Port 80)      │◄───┤  (Port 5173)    │    │  (Port 8000)    │
│  Reverse Proxy  │    │  React + Vite   │    │  FastAPI        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐    ┌─────────────────┐
                    │   PostgreSQL    │    │     MinIO       │
                    │  (Port 5432)    │    │ (Port 9000/9001)│
                    │   Database      │    │ Object Storage  │
                    └─────────────────┘    └─────────────────┘
```

## 📦 Container Services

### 1. Database (PostgreSQL)

- **Image**: `postgres:15`
- **Purpose**: Primary database for user data, questions, classes
- **Port**: 5432 (exposed for development)
- **Volume**: `db_data` for persistent storage
- **Health Check**: `pg_isready` command

```yaml
db:
  image: postgres:15
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
    POSTGRES_DB: eduquery
  volumes:
    - db_data:/var/lib/postgresql/data
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres"]
```

### 2. MinIO (Object Storage)

- **Image**: `minio/minio:latest`
- **Purpose**: File storage for uploaded documents
- **Ports**: 9000 (API), 9001 (Console)
- **Volume**: `minio_data` for persistent storage
- **Credentials**: minioadmin/minioadmin

```yaml
minio:
  image: minio/minio:latest
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin
  command: server /data --console-address ":9001"
```

### 3. Backend (FastAPI)

- **Build**: Custom Dockerfile from `app/backend/`
- **Purpose**: API server, question generation, authentication
- **Port**: 8000 (internal)
- **Dependencies**: PostgreSQL, MinIO
- **Health Check**: HTTP endpoint check

```yaml
backend:
  build:
    context: .
    dockerfile: app/backend/Dockerfile
  environment:
    DATABASE_URL: postgresql://postgres:postgres@db:5432/eduquery
    SECRET_KEY: ${SECRET_KEY:-change-me}
    MINIO_ENDPOINT: minio:9000
  depends_on:
    db:
      condition: service_healthy
    minio:
      condition: service_started
```

### 4. Frontend (React + Vite)

- **Build**: Custom Dockerfile from `app/frontend/`
- **Purpose**: User interface, file upload, question management
- **Port**: 5173 (internal)
- **Mode**: Development with hot reload
- **Volume Mounting**: Selective source file mounting

```yaml
frontend:
  build:
    context: ./app/frontend
    dockerfile: Dockerfile.dev
  volumes:
    - ./app/frontend/src:/app/src
    - ./app/frontend/public:/app/public
    # ... other config files
  environment:
    VITE_API_URL: /api
```

### 5. Nginx (Reverse Proxy)

- **Image**: `nginx:alpine`
- **Purpose**: Routes requests to frontend/backend
- **Port**: 80 (exposed)
- **Configuration**: Custom nginx config

```yaml
nginx:
  image: nginx:alpine
  volumes:
    - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
  depends_on:
    frontend:
      condition: service_healthy
    backend:
      condition: service_healthy
```

## 🔧 Development vs Production

### Development Mode (Default)

```bash
docker-compose up -d
```

**Characteristics:**

- Frontend runs Vite dev server with hot reload
- Source files mounted as volumes for instant updates
- `node_modules` stays in container for performance
- All services run with development configurations
- Debug logging enabled

**Volume Strategy:**

```yaml
volumes:
  # Mount only source files that change frequently
  - ./app/frontend/src:/app/src
  - ./app/frontend/public:/app/public
  - ./app/frontend/index.html:/app/index.html
  - ./app/frontend/vite.config.ts:/app/vite.config.ts
  # node_modules stays in container (no volume mount)
```

### Production Mode

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

**Characteristics:**

- Frontend built into static assets
- No volume mounting (pure containers)
- Optimized nginx configuration
- Production-ready settings
- Static file caching enabled

**Production Override:**

```yaml
# docker-compose.prod.yml
services:
  frontend:
    build:
      dockerfile: Dockerfile # Uses production Dockerfile
    # No volumes - uses built assets
    expose:
      - "80" # Serves static files directly
```

## 🐳 Dockerfile Architecture

### Backend Dockerfile (`app/backend/Dockerfile`)

```dockerfile
FROM python:3.11-slim

# System dependencies for document processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr poppler-utils default-jre \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY app/backend/requirements.txt ./requirements.txt
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy backend code
COPY app/backend/ ./

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Key Features:**

- Python 3.11 slim base image
- System dependencies for OCR and document processing
- Optimized layer caching with requirements.txt first
- Proper working directory setup

### Frontend Development Dockerfile (`app/frontend/Dockerfile.dev`)

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

**Key Features:**

- Node 18 Alpine for smaller image size
- Layer caching optimization
- Development server with host binding

### Frontend Production Dockerfile (`app/frontend/Dockerfile`)

```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Key Features:**

- Multi-stage build for smaller final image
- Production dependencies only
- Static file serving via nginx
- Optimized for production deployment

## 🔄 Service Dependencies & Health Checks

### Dependency Chain

```
nginx → frontend → backend → db
     ↘ backend → minio
```

### Health Check Strategy

```yaml
# Database health check
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres"]
  interval: 10s
  timeout: 5s
  retries: 5

# Backend health check
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s

# Frontend health check
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:5173/"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

## 🌐 Networking

### Internal Network

- All services communicate via Docker's internal network
- Service names resolve to container IPs
- No external network access required for inter-service communication

### Port Mapping

```yaml
# Exposed ports
nginx:    80:80      # Main application
db:       5432:5432  # Database (development only)
minio:    9000:9000  # MinIO API
minio:    9001:9001  # MinIO Console

# Internal ports (not exposed)
backend:  8000       # FastAPI
frontend: 5173       # Vite dev server
```

## 💾 Volume Management

### Named Volumes

```yaml
volumes:
  db_data: # PostgreSQL data persistence
  minio_data: # MinIO object storage persistence
```

### Bind Mounts (Development)

```yaml
# Source code mounting for hot reload
volumes:
  - ./app/frontend/src:/app/src
  - ./app/frontend/public:/app/public
  - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
```

## 🔐 Environment Variables

### Backend Environment

```yaml
environment:
  DATABASE_URL: postgresql://postgres:postgres@db:5432/eduquery
  SECRET_KEY: ${SECRET_KEY:-change-me}
  MINIO_ENDPOINT: minio:9000
  MINIO_ACCESS_KEY: minioadmin
  MINIO_SECRET_KEY: minioadmin
  GROQ_API_KEY: ${GROQ_API_KEY:-}
  OPENAI_API_KEY: ${OPENAI_API_KEY:-}
  DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY:-}
```

### Frontend Environment

```yaml
environment:
  VITE_API_URL: /api # API endpoint for frontend
```

## 🚀 Deployment Strategies

### Local Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Restart specific service
docker-compose restart frontend
```

### Production Deployment

```bash
# Build and start production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Scale services (if needed)
docker-compose up -d --scale backend=3
```

### CI/CD Integration

```bash
# Build images
docker-compose build

# Run tests
docker-compose run backend pytest
docker-compose run frontend npm test

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

## 🛠️ Troubleshooting

### Common Issues

1. **Port Conflicts**

   ```bash
   # Check port usage
   netstat -tulpn | grep :80

   # Stop conflicting services
   sudo systemctl stop apache2  # Example
   ```

2. **Volume Permission Issues**

   ```bash
   # Fix volume permissions
   sudo chown -R $USER:$USER ./app/frontend
   ```

3. **Service Startup Order**

   ```bash
   # Check service status
   docker-compose ps

   # View service logs
   docker-compose logs backend
   ```

4. **Database Connection Issues**
   ```bash
   # Test database connection
   docker-compose exec db psql -U postgres -d eduquery
   ```

### Debug Commands

```bash
# Enter container shell
docker-compose exec backend bash
docker-compose exec frontend sh

# View container logs
docker-compose logs -f --tail=100 backend

# Check container resources
docker stats

# Inspect container configuration
docker-compose config
```

## 📊 Performance Optimization

### Image Optimization

- Use Alpine Linux base images where possible
- Multi-stage builds for production
- Layer caching optimization
- Remove unnecessary packages

### Volume Optimization

- Selective volume mounting in development
- Named volumes for data persistence
- Avoid mounting `node_modules` in development

### Resource Limits

```yaml
# Example resource limits
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: "0.5"
        reservations:
          memory: 512M
          cpus: "0.25"
```

## 🔒 Security Considerations

### Container Security

- Use non-root users where possible
- Keep base images updated
- Scan images for vulnerabilities
- Use secrets management for sensitive data

### Network Security

- Internal network communication only
- Expose minimal ports
- Use reverse proxy for external access
- Implement proper authentication

### Data Security

- Encrypt sensitive environment variables
- Use secure database credentials
- Implement proper backup strategies
- Regular security updates

## 📈 Monitoring & Logging

### Log Management

```bash
# Centralized logging
docker-compose logs -f

# Log rotation
docker-compose logs --tail=1000 > logs/app.log
```

### Health Monitoring

```bash
# Check service health
docker-compose ps

# Monitor resource usage
docker stats
```

### Backup Strategy

```bash
# Database backup
docker-compose exec db pg_dump -U postgres eduquery > backup.sql

# Volume backup
docker run --rm -v question-maker_db_data:/data -v $(pwd):/backup alpine tar czf /backup/db_backup.tar.gz /data
```

This Docker setup provides a robust, scalable, and maintainable architecture for the EduQuery.ai application, supporting both development and production environments with proper separation of concerns and optimized performance.
