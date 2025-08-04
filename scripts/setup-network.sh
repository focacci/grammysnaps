#!/bin/bash

# GrammySnaps Network Setup Script
# This script automatically detects your network IP and configures the application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

print_info "🔍 Detecting network configuration..."

# Get the current local IP address
LOCAL_IP=$(ip route get 1.1.1.1 | awk '{print $7}' | head -1)

if [ -z "$LOCAL_IP" ]; then
    print_error "Could not detect local IP address!"
    exit 1
fi

print_success "✅ Detected local IP: $LOCAL_IP"

# Get router IP
ROUTER_IP=$(ip route | grep default | awk '{print $3}' | head -1)
print_info "🌐 Router IP: $ROUTER_IP"

# Get network interface
INTERFACE=$(ip route get 1.1.1.1 | awk '{print $5}' | head -1)
print_info "🔌 Network interface: $INTERFACE"

# Update the web environment file
ENV_FILE="web/.env"
print_info "📝 Updating $ENV_FILE..."

# Create or update the .env file
cat > "$ENV_FILE" << EOF
VITE_API_URL=http://${LOCAL_IP}:3000
EOF

print_success "✅ Updated web environment configuration"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Check if containers are running
if docker-compose ps | grep -q "Up"; then
    print_warning "🔄 Application is running. Restarting with new configuration..."
    docker-compose down
    sleep 2
fi

print_info "🚀 Starting application..."
docker-compose up -d --build

# Wait for services to be ready
print_info "⏳ Waiting for services to start..."
sleep 10

# Test the application
print_info "🧪 Testing application..."

# Test web service
if curl -s "http://${LOCAL_IP}:8080" > /dev/null; then
    print_success "✅ Web application is accessible"
else
    print_error "❌ Web application is not accessible"
fi

# Test API service
if curl -s "http://${LOCAL_IP}:3000/health" > /dev/null; then
    print_success "✅ API is accessible"
else
    print_error "❌ API is not accessible"
fi

# Display connection information
echo ""
echo "🎉 GrammySnaps is now running on your network!"
echo ""
echo "📱 Share these URLs with others on your network:"
echo "   Web App: http://${LOCAL_IP}:8080"
echo "   API:     http://${LOCAL_IP}:3000"
echo ""
echo "💡 Your current network details:"
echo "   Your IP:    $LOCAL_IP"
echo "   Router IP:  $ROUTER_IP"
echo "   Interface:  $INTERFACE"
echo ""

# Check for potential firewall issues
print_info "🔒 Checking firewall status..."
if command -v ufw > /dev/null; then
    if ufw status | grep -q "Status: active"; then
        print_warning "UFW firewall is active. You may need to allow ports:"
        echo "   sudo ufw allow 3000"
        echo "   sudo ufw allow 8080"
    else
        print_success "UFW firewall is inactive"
    fi
elif command -v firewall-cmd > /dev/null; then
    if systemctl is-active --quiet firewalld; then
        print_warning "Firewalld is active. You may need to allow ports:"
        echo "   sudo firewall-cmd --add-port=3000/tcp --permanent"
        echo "   sudo firewall-cmd --add-port=8080/tcp --permanent"
        echo "   sudo firewall-cmd --reload"
    else
        print_success "Firewalld is inactive"
    fi
fi

echo ""
print_info "📋 Useful commands:"
echo "   Stop:  docker-compose down"
echo "   Start: docker-compose up -d"
echo "   Logs:  docker-compose logs"
echo "   Re-run this script: ./setup-network.sh"
