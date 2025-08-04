#!/bin/bash

# SSL Certificate Status Checker for Grammysnaps
# This script continuously monitors AWS ACM certificate validation status

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Certificate ARNs
MAIN_CERT_ARN="arn:aws:acm:us-east-2:124314579010:certificate/de4542cf-11a4-47f6-8dbc-99782aa92126"
CLOUDFRONT_CERT_ARN="arn:aws:acm:us-east-1:124314579010:certificate/b8ef0859-50ee-4c75-9089-e69d38e47e26"

echo -e "${BLUE}🔍 Starting SSL Certificate Status Monitor${NC}"
echo -e "${BLUE}Domain: grannysnaps.dev${NC}"
echo -e "${BLUE}Press Ctrl+C to stop monitoring${NC}"
echo ""

# Required DNS validation record
echo -e "${YELLOW}Required DNS Record:${NC}"
echo -e "Type: CNAME"
echo -e "Name: _9cef9ce554dcf98220a44d1e284713c7.grannysnaps.dev"
echo -e "Value: _89f6c50e0a2bbc7ad3ef0b90e80ccb3b.xlfgrmvvlj.acm-validations.aws"
echo ""
echo "============================================================"

check_certificate() {
    local cert_arn=$1
    local region=$2
    local cert_name=$3
    
    echo -e "${BLUE}Checking $cert_name Certificate...${NC}"
    
    # Get certificate status
    local status=$(aws acm describe-certificate \
        --certificate-arn "$cert_arn" \
        --region "$region" \
        --query 'Certificate.Status' \
        --output text 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        case "$status" in
            "ISSUED")
                echo -e "${GREEN}✅ $cert_name: VALIDATED & ISSUED${NC}"
                return 0
                ;;
            "PENDING_VALIDATION")
                echo -e "${YELLOW}⏳ $cert_name: PENDING_VALIDATION${NC}"
                return 1
                ;;
            "FAILED")
                echo -e "${RED}❌ $cert_name: VALIDATION FAILED${NC}"
                return 2
                ;;
            *)
                echo -e "${YELLOW}⚠️  $cert_name: $status${NC}"
                return 1
                ;;
        esac
    else
        echo -e "${RED}❌ $cert_name: Error checking status${NC}"
        return 2
    fi
}

check_dns_record() {
    echo -e "${BLUE}Checking DNS validation record...${NC}"
    
    # Check if DNS record exists
    local dns_result=$(nslookup -type=CNAME _9cef9ce554dcf98220a44d1e284713c7.grannysnaps.dev 2>/dev/null | grep -i "canonical name" || echo "NOT_FOUND")
    
    if [[ "$dns_result" == "NOT_FOUND" ]]; then
        echo -e "${RED}❌ DNS validation record NOT found${NC}"
        echo -e "${YELLOW}💡 Add the CNAME record shown above to Porkbun${NC}"
        return 1
    else
        echo -e "${GREEN}✅ DNS validation record found${NC}"
        return 0
    fi
}

# Main monitoring loop
counter=1
all_validated=false

while [ "$all_validated" = false ]; do
    echo -e "${BLUE}📊 Check #$counter - $(date)${NC}"
    
    # Check DNS record first
    check_dns_record
    dns_status=$?
    
    echo ""
    
    # Check both certificates
    check_certificate "$MAIN_CERT_ARN" "us-east-2" "Main ALB"
    main_status=$?
    
    check_certificate "$CLOUDFRONT_CERT_ARN" "us-east-1" "CloudFront"
    cloudfront_status=$?
    
    echo ""
    
    # Check if both certificates are validated
    if [ $main_status -eq 0 ] && [ $cloudfront_status -eq 0 ]; then
        echo -e "${GREEN}🎉 ALL CERTIFICATES VALIDATED!${NC}"
        echo -e "${GREEN}🚀 You can now run 'terraform apply' to enable HTTPS${NC}"
        all_validated=true
        break
    fi
    
    # Show next check info
    if [ "$all_validated" = false ]; then
        echo -e "${BLUE}Next check in 30 seconds...${NC}"
        echo "============================================================"
        sleep 30
    fi
    
    ((counter++))
done

echo -e "${GREEN}✨ Monitoring complete!${NC}"
