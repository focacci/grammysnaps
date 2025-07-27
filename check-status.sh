#!/bin/bash

# GrammySnaps Status Checker
# Quickly check if your application is accessible and show current network info

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get current IP
LOCAL_IP=$(ip route get 1.1.1.1 | awk '{print $7}' | head -1)

echo -e "${BLUE}🔍 GrammySnaps Network Status${NC}"
echo "================================"
echo "Current IP: $LOCAL_IP"
echo ""

# Check web app
if curl -s "http://${LOCAL_IP}:8080" > /dev/null 2>&1; then
    echo -e "Web App:    ${GREEN}✅ Online${NC}  (http://${LOCAL_IP}:8080)"
else
    echo -e "Web App:    ${RED}❌ Offline${NC} (http://${LOCAL_IP}:8080)"
fi

# Check API
if curl -s "http://${LOCAL_IP}:3000/health" > /dev/null 2>&1; then
    echo -e "API:        ${GREEN}✅ Online${NC}  (http://${LOCAL_IP}:3000)"
else
    echo -e "API:        ${RED}❌ Offline${NC} (http://${LOCAL_IP}:3000)"
fi

# Check containers
echo ""
echo "Docker Status:"
docker-compose ps 2>/dev/null || echo "Docker compose not available"
