#!/bin/bash

# Question Maker - Pull and Deploy Script
# This script checks for updates on main branch and redeploys using Docker Compose
# Designed for automatic polling (cron/systemd timer) or manual execution
# Only deploys if changes are detected (smart checking)

set -e  # Exit on any error

# Configuration
PROJECT_DIR="/srv/www/questionmaker.ok.ubc.ca"
BRANCH="main"
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

# Check current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
print_status "Current branch: $CURRENT_BRANCH"

# Check if we need to switch branches
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    print_warning "Not on $BRANCH branch. Switching to $BRANCH..."
    git checkout "$BRANCH"
fi

# Smart checking: Fetch first (lightweight, no pull)
print_status "Fetching latest changes from origin (checking for updates)..."
git fetch origin "$BRANCH" > /dev/null 2>&1 || {
    print_error "Failed to fetch from origin. Check network connectivity and git credentials."
    exit 1
}

# Compare local vs remote commits
LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse "origin/$BRANCH")

print_status "Local commit:  ${LOCAL_COMMIT:0:7}"
print_status "Remote commit: ${REMOTE_COMMIT:0:7}"

# Exit early if no changes (efficient polling)
if [ "$LOCAL_COMMIT" = "$REMOTE_COMMIT" ]; then
    print_status "Already up to date. No changes to deploy."
    exit 0
fi

# Changes detected - proceed with deployment
print_status "Changes detected! Updating from ${LOCAL_COMMIT:0:7} to ${REMOTE_COMMIT:0:7}"

# Check if there are any local changes
if ! git diff-index --quiet HEAD --; then
    print_warning "Local changes detected. Stashing them..."
    git stash save "Auto-stash before pull - $(date)"
fi

# Pull latest changes
print_status "Pulling latest changes from origin/$BRANCH..."
git pull origin "$BRANCH"

# Rebuild and restart Docker containers
print_status "Rebuilding Docker images..."
docker compose build --no-cache 2>&1 | tee -a "$LOG_FILE" || {
    print_error "Docker build failed. Check logs above."
    exit 1
}

print_status "Stopping existing containers..."
docker compose down 2>&1 | tee -a "$LOG_FILE" || print_warning "Some containers may not have been running"

print_status "Starting containers with updated images..."
docker compose up -d 2>&1 | tee -a "$LOG_FILE" || {
    print_error "Failed to start containers. Check logs above."
    exit 1
}

# Wait a moment for containers to start
sleep 5

# Check container status
print_status "Container Status:"
docker compose ps | tee -a "$LOG_FILE"

# Check container health
print_status "Checking container health..."
HEALTH_CHECK_FAILED=0

if ! docker compose ps | grep -q "Up (healthy)"; then
    print_warning "Some containers may not be healthy. Checking logs..."
    docker compose logs --tail=20 | tee -a "$LOG_FILE"
    HEALTH_CHECK_FAILED=1
fi

# Restart Apache (if needed)
print_status "Restarting Apache..."
sudo systemctl restart httpd 2>/dev/null || sudo systemctl restart apache2 2>/dev/null || print_warning "Apache restart failed or not needed"

if [ $HEALTH_CHECK_FAILED -eq 0 ]; then
    print_header "Deployment completed successfully - $(date)"
    print_status "Deployment log saved to: $LOG_FILE"
    exit 0
else
    print_error "Deployment completed but health checks failed. Please review logs."
    print_status "Deployment log saved to: $LOG_FILE"
    exit 1
fi

