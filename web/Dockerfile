# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the app for production
RUN npm run build

# Production stage
FROM nginx:alpine

# Install curl for healthcheck and remove package cache
RUN apk add --no-cache curl && \
    rm -rf /var/cache/apk/*

# Create non-root user for security (nginx group already exists)
RUN adduser -S webuser -u 1001 -G nginx

# Copy built app from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx server config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create directories nginx needs write access to and ensure PID directory is writable
RUN mkdir -p /var/cache/nginx/client_temp && \
    mkdir -p /var/cache/nginx/proxy_temp && \
    mkdir -p /var/cache/nginx/fastcgi_temp && \
    mkdir -p /var/cache/nginx/uwsgi_temp && \
    mkdir -p /var/cache/nginx/scgi_temp && \
    mkdir -p /var/log/nginx && \
    mkdir -p /run && \
    touch /run/nginx.pid

# Change ownership of nginx files and directories
RUN chown -R webuser:nginx /var/cache/nginx && \
    chown -R webuser:nginx /var/log/nginx && \
    chown -R webuser:nginx /etc/nginx/conf.d && \
    chown -R webuser:nginx /usr/share/nginx/html && \
    chown -R webuser:nginx /run && \
    chmod 755 /run && \
    # Remove default nginx files we don't need
    rm -f /etc/nginx/conf.d/default.conf.default

# Switch to non-root user
USER webuser

# Expose port 80
EXPOSE 80

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
