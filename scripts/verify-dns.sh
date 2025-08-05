#!/bin/bash

# DNS Setup Verification Script for GrammySnaps
# This script helps you verify your DNS configuration with Route 53

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

DOMAIN="grammysnaps.dev"

echo -e "${BLUE}🌐 GrammySnaps DNS Verification${NC}"
echo -e "${BLUE}==============================${NC}"
echo ""

# Function to check DNS propagation
check_dns_propagation() {
    local domain=$1
    local record_type=$2
    local description=$3
    
    echo -e "${YELLOW}🔍 Checking $description...${NC}"
    
    local result=$(nslookup -type=$record_type $domain 2>/dev/null || echo "FAILED")
    
    if [[ "$result" == "FAILED" || "$result" == *"NXDOMAIN"* ]]; then
        echo -e "${RED}❌ $description: Not found${NC}"
        return 1
    else
        echo -e "${GREEN}✅ $description: OK${NC}"
        if [[ "$record_type" == "A" ]]; then
            echo "   $(echo "$result" | grep -A1 "Non-authoritative answer:" | tail -1 | sed 's/Address: /   → /')"
        elif [[ "$record_type" == "NS" ]]; then
            echo "$result" | grep "nameserver" | sed 's/^/   → /'
        fi
        return 0
    fi
}

# Function to check if domain points to AWS resources
check_aws_resources() {
    local domain=$1
    
    echo -e "${YELLOW}🔍 Checking if $domain points to AWS...${NC}"
    
    local ip=$(nslookup $domain 2>/dev/null | grep -A1 "Non-authoritative answer:" | tail -1 | awk '{print $2}' || echo "")
    
    if [[ -n "$ip" ]]; then
        # Check if it's an AWS ELB
        local reverse=$(nslookup $ip 2>/dev/null | grep "name =" | awk '{print $4}' || echo "")
        if [[ "$reverse" == *"elb.amazonaws.com"* ]]; then
            echo -e "${GREEN}✅ $domain points to AWS Load Balancer${NC}"
            echo "   → $reverse"
            return 0
        elif [[ "$reverse" == *"amazonaws.com"* ]]; then
            echo -e "${GREEN}✅ $domain points to AWS resource${NC}"
            echo "   → $reverse"
            return 0
        else
            echo -e "${YELLOW}⚠️  $domain points to: $ip${NC}"
            echo -e "${YELLOW}   This might not be AWS yet${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ $domain: No A record found${NC}"
        return 1
    fi
}

# Check nameserver propagation
echo -e "${BLUE}Step 1: Nameserver Propagation${NC}"
check_dns_propagation "$DOMAIN" "NS" "Nameservers"
ns_status=$?

echo ""

# Check main domain
echo -e "${BLUE}Step 2: Main Domain (${DOMAIN})${NC}"
check_dns_propagation "$DOMAIN" "A" "Main domain A record"
main_status=$?

if [[ $main_status -eq 0 ]]; then
    check_aws_resources "$DOMAIN"
    aws_main_status=$?
fi

echo ""

# Check www subdomain
echo -e "${BLUE}Step 3: WWW Subdomain (www.${DOMAIN})${NC}"
check_dns_propagation "www.$DOMAIN" "A" "WWW subdomain A record"
www_status=$?

if [[ $www_status -eq 0 ]]; then
    check_aws_resources "www.$DOMAIN"
    aws_www_status=$?
fi

echo ""

# Check SSL certificates
echo -e "${BLUE}Step 4: SSL Certificate Status${NC}"
if command -v openssl &> /dev/null; then
    echo -e "${YELLOW}🔍 Checking SSL certificate...${NC}"
    
    ssl_result=$(echo | timeout 5 openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -subject 2>/dev/null || echo "FAILED")
    
    if [[ "$ssl_result" == "FAILED" ]]; then
        echo -e "${YELLOW}⏳ SSL certificate not ready yet${NC}"
        echo "   This is normal if you just deployed. Certificates can take 5-30 minutes."
    else
        echo -e "${GREEN}✅ SSL certificate is active${NC}"
        echo "   $ssl_result"
    fi
else
    echo -e "${YELLOW}⚠️  OpenSSL not available, skipping SSL check${NC}"
fi

echo ""

# Summary
echo -e "${BLUE}📋 Summary${NC}"
echo -e "${BLUE}========${NC}"

if [[ $ns_status -eq 0 ]]; then
    echo -e "${GREEN}✅ Nameservers: Properly configured${NC}"
else
    echo -e "${RED}❌ Nameservers: Not propagated yet${NC}"
    echo -e "${YELLOW}   Wait a few minutes and try again${NC}"
fi

if [[ $main_status -eq 0 ]]; then
    echo -e "${GREEN}✅ Main domain: Resolving correctly${NC}"
else
    echo -e "${RED}❌ Main domain: Not resolving${NC}"
fi

if [[ $www_status -eq 0 ]]; then
    echo -e "${GREEN}✅ WWW subdomain: Resolving correctly${NC}"
else
    echo -e "${RED}❌ WWW subdomain: Not resolving${NC}"
fi

echo ""

if [[ $ns_status -eq 0 && $main_status -eq 0 && $www_status -eq 0 ]]; then
    echo -e "${GREEN}🎉 DNS setup is working correctly!${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Run ./scripts/setup-ssl.sh to enable HTTPS"
    echo "2. Wait for SSL certificates to validate"
    echo "3. Access your app at https://$DOMAIN"
else
    echo -e "${YELLOW}⏳ DNS is still propagating...${NC}"
    echo ""
    echo -e "${BLUE}What to do:${NC}"
    echo "1. Wait 5-15 minutes for DNS propagation"
    echo "2. Run this script again to check status"
    echo "3. If issues persist, check your Porkbun configuration"
fi
