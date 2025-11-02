#!/bin/bash

# Question Maker Deployment Script
# This script builds and deploys the React + Node.js application

set -e  # Exit on any error

echo "🚀 Starting Question Maker deployment..."

# Configuration
PROJECT_NAME="question-maker"
BACKEND_PORT=8000
FRONTEND_PORT=5173

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

print_status "Installing dependencies..."

# Install backend dependencies
print_status "Installing backend dependencies..."
cd app/backend
npm install --production
cd ../..

# Install frontend dependencies and build
print_status "Installing frontend dependencies..."
cd app/frontend
npm install
print_status "Building frontend..."
npm run build
cd ../..

print_status "Stopping existing PM2 processes..."
pm2 stop $PROJECT_NAME-backend 2>/dev/null || true
pm2 stop $PROJECT_NAME-frontend 2>/dev/null || true
pm2 delete $PROJECT_NAME-backend 2>/dev/null || true
pm2 delete $PROJECT_NAME-frontend 2>/dev/null || true

print_status "Starting backend with PM2..."
pm2 start ecosystem.config.cjs --only $PROJECT_NAME-backend

print_status "Starting frontend with PM2..."
pm2 start ecosystem.config.cjs --only $PROJECT_NAME-frontend

print_status "Saving PM2 configuration..."
pm2 save

print_status "Restarting Apache..."
sudo systemctl restart apache2 2>/dev/null || sudo systemctl restart httpd

print_status "Checking PM2 status..."
pm2 list

print_status "✅ Deployment completed!"
print_status "Backend running on: http://localhost:$BACKEND_PORT"
print_status "Frontend running on: http://localhost:$FRONTEND_PORT"

print_status "Useful commands:"
echo "  pm2 logs $PROJECT_NAME-backend    # View backend logs"
echo "  pm2 logs $PROJECT_NAME-frontend   # View frontend logs"
echo "  pm2 restart $PROJECT_NAME-backend # Restart backend"
echo "  pm2 restart $PROJECT_NAME-frontend # Restart frontend"
echo "  pm2 monit                         # Monitor processes"
