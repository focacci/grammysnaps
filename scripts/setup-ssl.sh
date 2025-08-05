#!/bin/bash

# SSL Setup Helper Script for GrammySnaps
# This script helps you set up SSL certificates automatically

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_NAME="grammysnaps"

# Allow environment to be passed as argument
ENVIRONMENT="${1:-staging}"  # Default to staging if no argument provided

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo -e "${RED}❌ Error: Environment must be 'staging' or 'production'${NC}"
    echo "Usage: $0 [staging|production]"
    exit 1
fi

# Set region based on environment
if [[ "$ENVIRONMENT" == "production" ]]; then
    AWS_REGION="us-east-1"
else
    AWS_REGION="us-east-2"
fi

echo -e "${BLUE}🔐 GrammySnaps SSL Setup - ${ENVIRONMENT}${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if we're in the right directory
if [[ ! -f "aws-infrastructure/main.tf" ]]; then
    echo -e "${RED}❌ Error: Please run this script from the project root directory${NC}"
    exit 1
fi

# Check AWS credentials
echo -e "${YELLOW}☁️ Checking AWS credentials...${NC}"
if ! aws sts get-caller-identity --region "$AWS_REGION" >/dev/null; then
    echo -e "${RED}❌ AWS credentials not configured. Run 'aws configure' first.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ AWS credentials OK${NC}"

# Check if terraform is initialized
echo -e "${YELLOW}🏗️ Checking Terraform state...${NC}"
cd aws-infrastructure
if [[ ! -d ".terraform" ]]; then
    echo -e "${YELLOW}⚙️ Initializing Terraform...${NC}"
    terraform init
fi

# Plan the SSL changes
echo -e "${YELLOW}📋 Planning SSL infrastructure changes for ${ENVIRONMENT}...${NC}"
terraform plan -var-file="terraform.${ENVIRONMENT}.tfvars" -out=ssl-plan

echo ""
echo -e "${BLUE}🔍 SSL Setup Plan Summary for ${ENVIRONMENT}:${NC}"
echo "  • ACM certificates will be created for your domain"
echo "  • HTTPS listeners will be added to load balancer"  
echo "  • HTTP traffic will redirect to HTTPS"
echo "  • Certificate validation records will be generated"
echo "  • Environment: ${ENVIRONMENT}"
echo "  • Region: ${AWS_REGION}"
echo ""

read -p "Do you want to apply these SSL changes to ${ENVIRONMENT}? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⏹️ SSL setup cancelled${NC}"
    rm -f ssl-plan
    exit 0
fi

# Apply the changes
echo -e "${YELLOW}🚀 Applying SSL infrastructure to ${ENVIRONMENT}...${NC}"
terraform apply ssl-plan

# Get the DNS validation records
echo ""
echo -e "${GREEN}✅ SSL infrastructure deployed to ${ENVIRONMENT}!${NC}"
echo ""
echo -e "${YELLOW}📝 Next Steps for ${ENVIRONMENT}:${NC}"
if [[ "$ENVIRONMENT" == "production" ]]; then
    echo "1. Set up your production domain DNS"
    echo "2. Wait for certificate validation (5-30 minutes)"
    echo "3. Your production app will be available at https://grammysnaps.com"
else
    echo "1. Update nameservers in Porkbun if needed"
    echo "2. Wait for certificate validation (5-30 minutes)"
    echo "3. Your app will be available at https://grammysnaps.dev"
fi
echo ""

# Check certificate status
echo -e "${BLUE}🔍 Checking certificate status...${NC}"
../scripts/check-cert-status.sh

echo -e "${GREEN}🎉 SSL setup complete!${NC}"
