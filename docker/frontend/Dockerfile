# Multi-stage build for production
FROM node:18-alpine AS builder

WORKDIR /app
COPY app/frontend/package*.json ./
RUN npm ci --only=production

COPY app/frontend/ .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/prod.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
