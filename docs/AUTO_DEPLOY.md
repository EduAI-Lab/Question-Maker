# Automatic Deployment Guide

This guide explains how to set up automatic deployment on your remote server when changes are pushed to the `main` branch.

## Scripts Overview

1. **`pull-and-deploy.sh`** - Main deployment script that pulls latest changes and redeploys
2. **`webhook-handler.sh`** - Simple bash webhook handler (basic)
3. **`webhook-server.js`** - Node.js webhook server (recommended)

## Option 1: Manual Deployment Script

The simplest approach is to run the deployment script manually or via cron.

### Setup

1. **Make the script executable:**
   ```bash
   chmod +x pull-and-deploy.sh
   ```

2. **Test the script:**
   ```bash
   ./pull-and-deploy.sh
   ```

3. **Set up a cron job (optional):**
   ```bash
   # Edit crontab
   crontab -e
   
   # Add this line to check for updates every 5 minutes
   */5 * * * * /srv/www/question-maker/pull-and-deploy.sh
   ```

### Manual Execution

Simply run the script whenever you want to deploy:
```bash
cd /srv/www/question-maker
./pull-and-deploy.sh
```

## Option 2: GitHub Webhook (Recommended)

Automatically trigger deployment when code is pushed to `main` branch.

### Setup Webhook Server

1. **Make scripts executable:**
   ```bash
   chmod +x pull-and-deploy.sh
   chmod +x webhook-server.js
   ```

2. **Install Node.js dependencies (if needed):**
   ```bash
   # The webhook server uses only Node.js built-in modules
   # No additional dependencies required
   ```

3. **Set environment variables:**
   ```bash
   export WEBHOOK_PORT=3001
   export WEBHOOK_SECRET=your-secret-key-here  # Optional but recommended
   export PROJECT_DIR=/srv/www/question-maker
   ```

4. **Start the webhook server with PM2:**
   ```bash
   pm2 start webhook-server.js --name question-maker-webhook
   pm2 save
   ```

   Or create a PM2 ecosystem entry:
   ```javascript
   {
     name: 'question-maker-webhook',
     script: 'webhook-server.js',
     cwd: '/srv/www/question-maker',
     env: {
       WEBHOOK_PORT: 3001,
       WEBHOOK_SECRET: 'your-secret-key-here',
       PROJECT_DIR: '/srv/www/question-maker'
     }
   }
   ```

5. **Configure firewall (if needed):**
   ```bash
   # Allow webhook port
   sudo firewall-cmd --permanent --add-port=3001/tcp
   sudo firewall-cmd --reload
   ```

### Configure GitHub Webhook

1. Go to your GitHub repository
2. Navigate to **Settings** → **Webhooks** → **Add webhook**
3. Configure the webhook:
   - **Payload URL**: `http://your-server-ip:3001/webhook` or `https://your-domain.com/webhook`
   - **Content type**: `application/json`
   - **Secret**: (same as `WEBHOOK_SECRET` you set above)
   - **Events**: Select "Just the push event"
   - **Active**: ✓

4. Click **Add webhook**

### Test the Webhook

1. Make a small change and push to `main`:
   ```bash
   git commit --allow-empty -m "Test webhook deployment"
   git push origin main
   ```

2. Check the logs:
   ```bash
   # Webhook server logs
   pm2 logs question-maker-webhook
   
   # Deployment logs
   tail -f /var/log/question-maker/deploy.log
   ```

## Option 3: Simple Bash Webhook Handler

If you prefer a simpler bash-based webhook handler, you can use `webhook-handler.sh` with a web server like Apache or Nginx.

### Setup with Apache

1. **Enable CGI in Apache:**
   ```bash
   sudo a2enmod cgi
   sudo systemctl restart apache2
   ```

2. **Create webhook directory:**
   ```bash
   sudo mkdir -p /var/www/webhooks
   sudo cp webhook-handler.sh /var/www/webhooks/github-webhook
   sudo chmod +x /var/www/webhooks/github-webhook
   ```

3. **Configure Apache:**
   ```apache
   <Directory /var/www/webhooks>
       Options +ExecCGI
       AddHandler cgi-script .sh
   </Directory>
   
   Alias /webhook /var/www/webhooks/github-webhook
   ```

## Configuration

### Customize Deployment Script

Edit `pull-and-deploy.sh` to customize:

- **Project directory**: Change `PROJECT_DIR` variable
- **Branch**: Change `BRANCH` variable (default: `main`)
- **Log location**: Change `LOG_FILE` variable
- **PM2 process names**: Update `PROJECT_NAME` variable

### Environment Variables

For the webhook server (`webhook-server.js`):

- `WEBHOOK_PORT` - Port to listen on (default: 3001)
- `WEBHOOK_SECRET` - Secret for signature verification (optional but recommended)
- `PROJECT_DIR` - Project directory path (default: `/srv/www/question-maker`)

## Logs

Deployment logs are saved to:
- `/var/log/question-maker/deploy.log` - Deployment script logs
- `/var/log/question-maker/webhook.log` - Webhook server logs

View logs:
```bash
# Deployment logs
tail -f /var/log/question-maker/deploy.log

# Webhook logs
tail -f /var/log/question-maker/webhook.log

# Or via PM2
pm2 logs question-maker-webhook
```

## Troubleshooting

### Script Permission Denied
```bash
chmod +x pull-and-deploy.sh
chmod +x webhook-server.js
```

### Git Authentication Issues
Make sure your server has access to the repository:
```bash
# Test git access
cd /srv/www/question-maker
git fetch origin

# If using HTTPS, configure credentials
git config credential.helper store
```

### PM2 Not Found
```bash
# Install PM2 globally
npm install -g pm2
```

### Webhook Not Triggering
1. Check webhook server is running: `pm2 list`
2. Check firewall allows the port
3. Verify GitHub webhook configuration
4. Check webhook logs: `pm2 logs question-maker-webhook`
5. Test webhook endpoint: `curl http://localhost:3001/health`

### Deployment Fails
1. Check deployment logs: `tail -f /var/log/question-maker/deploy.log`
2. Verify project directory exists and has correct permissions
3. Ensure npm dependencies are installed
4. Check PM2 processes: `pm2 list`

## Security Considerations

1. **Use webhook secret**: Always set `WEBHOOK_SECRET` to verify webhook authenticity
2. **Firewall**: Only expose webhook port to GitHub IPs if possible
3. **HTTPS**: Use HTTPS for webhook endpoint in production
4. **Permissions**: Run scripts with appropriate user permissions
5. **Logs**: Regularly review logs for suspicious activity

## GitHub IP Ranges

If you want to restrict webhook access to GitHub IPs only, you can find the current IP ranges at:
- https://api.github.com/meta

Update your firewall rules accordingly.

## Alternative: GitHub Actions

Instead of a webhook, you can also use GitHub Actions to SSH into your server and run the deployment script. See `docs/CI-CD.md` for more details.

