#!/usr/bin/env node

/**
 * Question Maker - GitHub Webhook Server
 * A Node.js server that listens for GitHub webhook events and triggers deployment
 * 
 * Usage:
 *   node webhook-server.js
 *   Or run with PM2: pm2 start webhook-server.js --name question-maker-webhook
 * 
 * GitHub Webhook Configuration:
 *   - Payload URL: http://your-server:3001/webhook
 *   - Content type: application/json
 *   - Secret: (optional, set WEBHOOK_SECRET env variable)
 *   - Events: Just the push event
 */

const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const PORT = process.env.WEBHOOK_PORT || 3001;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const PROJECT_DIR = process.env.PROJECT_DIR || '/srv/www/question-maker';
const DEPLOY_SCRIPT = path.join(PROJECT_DIR, 'pull-and-deploy.sh');
const LOG_FILE = path.join('/var/log/question-maker', 'webhook.log');

// Ensure log directory exists
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);
    fs.appendFileSync(LOG_FILE, logMessage);
}

function verifySignature(payload, signature) {
    if (!WEBHOOK_SECRET) {
        log('WARNING: WEBHOOK_SECRET not set. Skipping signature verification.');
        return true;
    }

    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(digest)
    );
}

function triggerDeployment() {
    log('Triggering deployment...');
    
    exec(`bash ${DEPLOY_SCRIPT}`, {
        cwd: PROJECT_DIR,
        env: { ...process.env, PATH: process.env.PATH }
    }, (error, stdout, stderr) => {
        if (error) {
            log(`Deployment error: ${error.message}`);
            return;
        }
        if (stdout) log(`Deployment output: ${stdout}`);
        if (stderr) log(`Deployment stderr: ${stderr}`);
    });
}

const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/webhook') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                // Verify signature if secret is set
                const signature = req.headers['x-hub-signature-256'];
                if (signature && !verifySignature(body, signature)) {
                    log('ERROR: Invalid webhook signature');
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid signature' }));
                    return;
                }

                const payload = JSON.parse(body);
                
                // Check if this is a push event to main branch
                if (payload.ref === 'refs/heads/main' && payload.commits && payload.commits.length > 0) {
                    log(`Push to main detected. Commit: ${payload.head_commit.id}`);
                    log(`Commit message: ${payload.head_commit.message}`);
                    
                    // Trigger deployment
                    triggerDeployment();
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        status: 'success', 
                        message: 'Deployment triggered',
                        commit: payload.head_commit.id
                    }));
                } else {
                    log('Webhook received but not a push to main branch. Ignoring.');
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        status: 'ignored', 
                        message: 'Not a push to main branch' 
                    }));
                }
            } catch (error) {
                log(`ERROR parsing webhook payload: ${error.message}`);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid payload' }));
            }
        });
    } else if (req.method === 'GET' && req.url === '/health') {
        // Health check endpoint
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'webhook-handler' }));
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

server.listen(PORT, () => {
    log(`Webhook server listening on port ${PORT}`);
    log(`Project directory: ${PROJECT_DIR}`);
    log(`Deploy script: ${DEPLOY_SCRIPT}`);
    if (WEBHOOK_SECRET) {
        log('Webhook secret is configured');
    } else {
        log('WARNING: Webhook secret not configured. Signature verification disabled.');
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        log('Webhook server closed');
        process.exit(0);
    });
});

