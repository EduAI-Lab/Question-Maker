#!/bin/bash

# Question Maker - Pull and Deploy Script
# This script pulls the latest changes from main branch and redeploys the application
# Can be run manually or triggered by a webhook

set -e  # Exit on any error

# Configuration
PROJECT_DIR="/srv/www/question-maker"
BRANCH="main"
PROJECT_NAME="question-maker"
LOG_FILE="/var/log/question-maker/deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

print_header() {
    echo -e "${BLUE}========================================${NC}" | tee -a "$LOG_FILE"
    echo -e "${BLUE}$1${NC}" | tee -a "$LOG_FILE"
    echo -e "${BLUE}========================================${NC}" | tee -a "$LOG_FILE"
}

# Create log directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Log start time
print_header "Starting deployment - $(date)"

# Check if we're in the right directory
if [ ! -d "$PROJECT_DIR" ]; then
    print_error "Project directory not found: $PROJECT_DIR"
    exit 1
fi

# Navigate to project directory
cd "$PROJECT_DIR"

# Check if git repository exists
if [ ! -d ".git" ]; then
    print_error "Not a git repository: $PROJECT_DIR"
    exit 1
fi

# Fetch latest changes
print_status "Fetching latest changes from origin..."
git fetch origin

# Check current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
print_status "Current branch: $CURRENT_BRANCH"

# Check if we need to switch branches
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    print_warning "Not on $BRANCH branch. Switching to $BRANCH..."
    git checkout "$BRANCH"
fi

# Check if there are any local changes
if ! git diff-index --quiet HEAD --; then
    print_warning "Local changes detected. Stashing them..."
    git stash save "Auto-stash before pull - $(date)"
fi

# Pull latest changes
print_status "Pulling latest changes from origin/$BRANCH..."
BEFORE_COMMIT=$(git rev-parse HEAD)
git pull origin "$BRANCH"
AFTER_COMMIT=$(git rev-parse HEAD)

if [ "$BEFORE_COMMIT" = "$AFTER_COMMIT" ]; then
    print_status "Already up to date. No changes to deploy."
    exit 0
fi

print_status "Updated from $BEFORE_COMMIT to $AFTER_COMMIT"

# Install/update dependencies
print_status "Installing backend dependencies..."
cd app/backend
npm install --production
cd ../..

print_status "Installing frontend dependencies..."
cd app/frontend
npm install
print_status "Building frontend..."
npm run build
cd ../..

# Restart PM2 processes
print_status "Restarting PM2 processes..."
pm2 restart "$PROJECT_NAME-backend" || print_warning "Backend restart failed or not running"
pm2 restart "$PROJECT_NAME-frontend" || print_warning "Frontend restart failed or not running"

# Save PM2 configuration
pm2 save

# Optional: Restart Apache (uncomment if needed)
# print_status "Restarting Apache..."
# sudo systemctl restart apache2 2>/dev/null || sudo systemctl restart httpd 2>/dev/null || print_warning "Apache restart failed"

# Check PM2 status
print_status "PM2 Status:"
pm2 list | tee -a "$LOG_FILE"

print_header "Deployment completed successfully - $(date)"
print_status "Deployment log saved to: $LOG_FILE"

exit 0

