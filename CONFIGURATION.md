# Configuration Guide

This guide explains how the centralized environment configuration works in EduQuery.ai.

## Overview

EduQuery.ai uses a **single `.env` file** at the project root to manage all environment variables for both frontend and backend services. This approach provides:

- **Single Source of Truth**: All configuration in one place
- **Clear Separation**: Frontend variables prefixed with `VITE_`
- **Security**: Only frontend-safe variables are exposed to the browser
- **Maintainability**: Easy to see and manage all configuration

## File Structure

```
eduquery-ai/
├── .env                    # Single environment file (create from env.example)
├── env.example            # Template with all variables
├── app/
│   ├── backend/
│   │   └── src/
│   │       └── config/
│   │           └── settings.js  # Loads from root .env
│   └── frontend/
│       └── vite.config.ts       # Loads from root .env
└── docker-compose.yml     # Uses root .env
```

## Environment Variables

### Shared Configuration
```env
NODE_ENV=development
APP_NAME=EduQuery.ai
APP_VERSION=1.0.0
```

### Backend Configuration
```env
# Server
PORT=8000
DATABASE_URL=postgresql://postgres:password@localhost:5432/eduquery

# Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# AI API Keys
GROQ_API_KEY=your-groq-api-key
OPENAI_API_KEY=your-openai-api-key
DEEPSEEK_API_KEY=your-deepseek-api-key

# AI Settings
DEFAULT_NUM_QUESTIONS=15
MAX_QUESTIONS=50

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

### Frontend Configuration
```env
# API
VITE_API_URL=http://localhost:8000
VITE_APP_NAME=EduQuery.ai
VITE_APP_VERSION=1.0.0
```

## How It Works

### Backend Configuration Loading

The backend loads configuration through `app/backend/src/config/settings.js`:

```javascript
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the project root directory (3 levels up from this file)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../');

// Load environment variables from project root
dotenv.config({ path: path.join(projectRoot, '.env') });

export const config = {
  port: process.env.PORT || 8000,
  nodeEnv: process.env.NODE_ENV || 'development',
  // ... other configuration
};
```

### Frontend Configuration Loading

The frontend loads configuration through `app/frontend/vite.config.ts`:

```javascript
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // Load env file from project root (2 levels up from frontend)
  const env = loadEnv(mode, process.cwd() + '/../..', '')
  
  return {
    // ... other config
    define: {
      'process.env': env
    }
  }
})
```

### Docker Configuration

Docker Compose loads the root `.env` file:

```yaml
services:
  backend:
    env_file:
      - .env
  frontend:
    env_file:
      - .env
```

## Setup Instructions

### 1. Create Environment File

```bash
# Copy the template
cp .env.example .env

# Edit with your values
nano .env
```

### 2. Configure API Keys

Add your API keys to the `.env` file:

```env
GROQ_API_KEY=your-actual-groq-key
OPENAI_API_KEY=your-actual-openai-key
DEEPSEEK_API_KEY=your-actual-deepseek-key
```

### 3. Configure Database

Update the database URL for your environment:

```env
# Local development
DATABASE_URL=postgresql://postgres:password@localhost:5432/eduquery

# Docker development
DATABASE_URL=postgresql://postgres:password@postgres:5432/eduquery

# Production
DATABASE_URL=postgresql://user:password@prod-host:5432/eduquery
```

## Security Considerations

### Frontend Variables (VITE_ prefix)
- **Exposed to browser**: These variables are visible in the client-side code
- **Safe to include**: API URLs, app names, public configuration
- **Never include**: API keys, secrets, database URLs

### Backend Variables (no prefix)
- **Server-side only**: These variables are only accessible on the server
- **Safe to include**: API keys, database URLs, secrets, internal configuration

## Environment-Specific Configuration

### Development
```env
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/eduquery
VITE_API_URL=http://localhost:8000
```

### Production
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:password@prod-host:5432/eduquery
VITE_API_URL=https://api.yourapp.com
```

### Docker
```env
NODE_ENV=production
DATABASE_URL=postgresql://postgres:password@postgres:5432/eduquery
VITE_API_URL=http://backend:8000
```

## Troubleshooting

### Common Issues

1. **Variables not loading**: Ensure the `.env` file is in the project root
2. **Frontend variables not available**: Check that they have the `VITE_` prefix
3. **Docker not loading variables**: Verify the `env_file` path in docker-compose.yml

### Debug Configuration

```bash
# Backend - check loaded config
cd app/backend
node -e "import('./src/config/settings.js').then(m => console.log(m.config))"

# Frontend - check Vite config
cd app/frontend
npm run dev -- --debug
```

## Migration from Separate .env Files

If you're migrating from separate `.env` files:

1. **Backup existing files**:
   ```bash
   cp app/backend/.env app/backend/.env.backup
   cp app/frontend/.env app/frontend/.env.backup
   ```

2. **Merge variables** into the root `.env` file

3. **Remove old files**:
   ```bash
   rm app/backend/.env
   rm app/frontend/.env
   ```

4. **Test the configuration**:
   ```bash
   # Test backend
   cd app/backend && npm run dev
   
   # Test frontend
   cd app/frontend && npm run dev
   ```

## Best Practices

1. **Never commit `.env`**: Add it to `.gitignore`
2. **Use `env.example`**: Keep a template with dummy values
3. **Document variables**: Add comments explaining each variable
4. **Validate on startup**: Check required variables are present
5. **Use different files**: `.env.local`, `.env.production` for different environments
