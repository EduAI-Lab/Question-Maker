# Use Node.js 18 Alpine image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install curl for health checks (more reliable than node http)
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Copy environment file (if it exists)
COPY .env* ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 8000

# Set Node.js memory limit to prevent OOM kills
# 384MB leaves headroom for native modules, buffers, and OS overhead within 512MB container limit
ENV NODE_OPTIONS="--max-old-space-size=384"

# Health check with better error handling
# Uses curl which is more reliable and has proper timeout handling
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8000/healthz || exit 1

# Start the application
# Use exec form to ensure proper signal handling
CMD ["node", "src/index.js"]
