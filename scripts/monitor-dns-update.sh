#!/bin/bash

# Nameserver Update Monitor for GrammySnaps
# This script checks if the new nameservers have propagated

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

DOMAIN="grammysnaps.dev"

# New nameservers that should be active
NEW_NS=(
    "ns-1112.awsdns-11.org"
    "ns-126.awsdns-15.com"
    "ns-2023.awsdns-60.co.uk"
    "ns-830.awsdns-39.net"
)

echo -e "${BLUE}🔄 Nameserver Update Monitor${NC}"
echo -e "${BLUE}============================${NC}"
echo ""
echo -e "${YELLOW}Expected nameservers:${NC}"
for ns in "${NEW_NS[@]}"; do
    echo "  → $ns"
done
echo ""

check_nameservers() {
    echo -e "${YELLOW}🔍 Checking current nameservers...${NC}"
    
    local current_ns=$(nslookup -type=NS $DOMAIN 2>/dev/null | grep "nameserver" | awk '{print $4}' | sed 's/\.$//' | sort)
    local expected_ns=$(printf '%s\n' "${NEW_NS[@]}" | sort)
    
    echo -e "${BLUE}Current nameservers:${NC}"
    echo "$current_ns" | sed 's/^/  → /'
    
    if [[ "$current_ns" == "$expected_ns" ]]; then
        echo -e "${GREEN}✅ Nameservers are updated correctly!${NC}"
        return 0
    else
        echo -e "${RED}❌ Nameservers still need to be updated${NC}"
        echo ""
        echo -e "${YELLOW}Please update these in Porkbun:${NC}"
        for ns in "${NEW_NS[@]}"; do
            echo "  → $ns"
        done
        return 1
    fi
}

check_domain_resolution() {
    echo ""
    echo -e "${YELLOW}🔍 Checking domain resolution...${NC}"
    
    local main_result=$(nslookup $DOMAIN 2>/dev/null | grep "Address:" | tail -1 | awk '{print $2}' || echo "NONE")
    local www_result=$(nslookup www.$DOMAIN 2>/dev/null | grep "Address:" | tail -1 | awk '{print $2}' || echo "NONE")
    
    if [[ "$main_result" != "NONE" ]]; then
        echo -e "${GREEN}✅ $DOMAIN resolves to: $main_result${NC}"
    else
        echo -e "${RED}❌ $DOMAIN: Not resolving${NC}"
    fi
    
    if [[ "$www_result" != "NONE" ]]; then
        echo -e "${GREEN}✅ www.$DOMAIN resolves to: $www_result${NC}"
    else
        echo -e "${RED}❌ www.$DOMAIN: Not resolving${NC}"
    fi
    
    if [[ "$main_result" != "NONE" && "$www_result" != "NONE" ]]; then
        return 0
    else
        return 1
    fi
}

check_https() {
    echo ""
    echo -e "${YELLOW}🔍 Checking HTTPS...${NC}"
    
    if curl -s -I --max-time 10 https://$DOMAIN > /dev/null 2>&1; then
        echo -e "${GREEN}✅ HTTPS is working for $DOMAIN${NC}"
        return 0
    else
        echo -e "${YELLOW}⏳ HTTPS not ready yet for $DOMAIN${NC}"
        return 1
    fi
}

# Main monitoring loop
counter=1
while true; do
    echo -e "${BLUE}📊 Check #$counter - $(date)${NC}"
    echo "============================================================"
    
    # Check nameservers
    check_nameservers
    ns_status=$?
    
    if [[ $ns_status -eq 0 ]]; then
        # Check domain resolution
        check_domain_resolution
        domain_status=$?
        
        if [[ $domain_status -eq 0 ]]; then
            # Check HTTPS
            check_https
            https_status=$?
            
            if [[ $https_status -eq 0 ]]; then
                echo ""
                echo -e "${GREEN}🎉 Everything is working!${NC}"
                echo -e "${GREEN}Your app is ready at: https://$DOMAIN${NC}"
                break
            fi
        fi
    fi
    
    echo ""
    echo -e "${BLUE}Next check in 30 seconds... (Ctrl+C to stop)${NC}"
    echo "============================================================"
    sleep 30
    ((counter++))
done

echo -e "${GREEN}✨ Setup complete!${NC}"
