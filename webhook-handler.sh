#!/bin/bash

# Question Maker - GitHub Webhook Handler
# This script handles GitHub webhook POST requests and triggers deployment
# Set up as a webhook endpoint in your GitHub repository settings

set -e

# Configuration
WEBHOOK_SECRET=""  # Optional: Set your webhook secret here for security
PROJECT_DIR="/srv/www/question-maker"
DEPLOY_SCRIPT="$PROJECT_DIR/pull-and-deploy.sh"
LOG_FILE="/var/log/question-maker/webhook.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Create log directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Read the request body
PAYLOAD=$(cat)

print_log "Webhook received"

# Parse JSON payload (requires jq or basic parsing)
# Check if this is a push to main branch
if echo "$PAYLOAD" | grep -q '"ref":"refs/heads/main"'; then
    print_log "Push to main branch detected. Triggering deployment..."
    
    # Run deployment script in background
    nohup "$DEPLOY_SCRIPT" >> "$LOG_FILE" 2>&1 &
    
    echo "HTTP/1.1 200 OK"
    echo "Content-Type: application/json"
    echo ""
    echo '{"status": "success", "message": "Deployment triggered"}'
else
    print_log "Push detected but not to main branch. Ignoring."
    
    echo "HTTP/1.1 200 OK"
    echo "Content-Type: application/json"
    echo ""
    echo '{"status": "ignored", "message": "Not a push to main branch"}'
fi

exit 0

