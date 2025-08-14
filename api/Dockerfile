# Multi-stage build for production optimization
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

### STAGING & PRODUCTION ######################################################
# FROM node:20-alpine AS production

# # Create non-root user for security
# RUN addgroup -g 1001 -S nodejs
# RUN adduser -S nodejs -u 1001

# # Set working directory
# WORKDIR /app

# # Copy package files
# COPY package*.json ./

# RUN npm ci --only=production && npm cache clean --force

# # Copy built application from builder stage (source files for tsx)
# COPY --from=builder /app/src ./src
# COPY --from=builder /app/package*.json ./

# # Change ownership to nodejs user
# RUN chown -R nodejs:nodejs /app
# USER nodejs
###############################################################################

# Expose the port Fastify will run on
EXPOSE 3000

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Command to start the app
CMD ["npm", "run", "start"]