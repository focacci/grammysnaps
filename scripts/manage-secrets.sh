#!/bin/bash

# AWS Secrets Manager Helper Script
# This script helps manage secrets for the grammysnaps application

set -e

PROJECT_NAME="grammysnaps"
ENVIRONMENT="dev"
AWS_REGION="us-east-2"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if AWS CLI is configured
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS CLI is not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    print_info "AWS CLI is configured and ready."
}

# Function to get a secret value
get_secret() {
    local secret_name="$1"
    local key="$2"
    
    if [ -z "$key" ]; then
        # Get entire secret
        aws secretsmanager get-secret-value \
            --secret-id "${PROJECT_NAME}-${ENVIRONMENT}-${secret_name}" \
            --region "$AWS_REGION" \
            --query 'SecretString' \
            --output text
    else
        # Get specific key from secret
        aws secretsmanager get-secret-value \
            --secret-id "${PROJECT_NAME}-${ENVIRONMENT}-${secret_name}" \
            --region "$AWS_REGION" \
            --query 'SecretString' \
            --output text | jq -r ".${key}"
    fi
}

# Function to update a secret
update_secret() {
    local secret_name="$1"
    local secret_value="$2"
    
    aws secretsmanager update-secret \
        --secret-id "${PROJECT_NAME}-${ENVIRONMENT}-${secret_name}" \
        --secret-string "$secret_value" \
        --region "$AWS_REGION"
}

# Function to create .env file for local development
create_local_env() {
    local env_file=".env.local"
    
    print_info "Creating local environment file: $env_file"
    
    cat > "$env_file" << EOF
# Generated from AWS Secrets Manager - $(date)
# DO NOT COMMIT THIS FILE TO VERSION CONTROL

# Database Configuration
DATABASE_URL=$(get_secret "database-secrets" "database_url")
DB_HOST=$(get_secret "database-secrets" "host")
DB_PORT=$(get_secret "database-secrets" "port")
DB_NAME=$(get_secret "database-secrets" "database")
DB_USER=$(get_secret "database-secrets" "username")
DB_PASSWORD=$(get_secret "database-secrets" "password")

# JWT Secret
JWT_SECRET=$(get_secret "jwt-secret")

# AWS Configuration
AWS_REGION=$AWS_REGION
AWS_ACCESS_KEY_ID=$(get_secret "aws-credentials" "access_key_id")
AWS_SECRET_ACCESS_KEY=$(get_secret "aws-credentials" "secret_access_key")
S3_BUCKET_NAME=$(get_secret "aws-credentials" "s3_bucket_name")

# CORS Origins
CORS_ORIGINS=$(get_secret "app-secrets" "cors_origins")

# SMTP Configuration
SMTP_HOST=$(get_secret "app-secrets" "smtp_host")
SMTP_PORT=$(get_secret "app-secrets" "smtp_port")
SMTP_USER=$(get_secret "app-secrets" "smtp_user")
SMTP_PASSWORD=$(get_secret "app-secrets" "smtp_password")

# Invite System
INVITE_KEY=$(get_secret "app-secrets" "invite_key")

# Application Configuration
NODE_ENV=development
PORT=3000

# Frontend Configuration (Vite)
VITE_API_URL=$(get_secret "app-secrets" "vite_api_url")
VITE_NODE_ENV=$(get_secret "app-secrets" "vite_node_env")
EOF

    print_info "Local environment file created: $env_file"
    print_warning "Remember to add $env_file to your .gitignore file!"
}

# Function to list all secrets
list_secrets() {
    print_info "Listing all secrets for $PROJECT_NAME-$ENVIRONMENT:"
    
    aws secretsmanager list-secrets \
        --region "$AWS_REGION" \
        --query "SecretList[?contains(Name, '$PROJECT_NAME-$ENVIRONMENT')].{Name:Name,Description:Description}" \
        --output table
}

# Function to show secret details (without values)
show_secret_details() {
    local secret_name="$1"
    
    print_info "Details for secret: ${PROJECT_NAME}-${ENVIRONMENT}-${secret_name}"
    
    aws secretsmanager describe-secret \
        --secret-id "${PROJECT_NAME}-${ENVIRONMENT}-${secret_name}" \
        --region "$AWS_REGION" \
        --output table
}

# Function to rotate JWT secret
rotate_jwt_secret() {
    print_warning "This will generate a new JWT secret and invalidate all existing tokens!"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        local new_secret=$(openssl rand -base64 64 | tr -d '\n')
        
        aws secretsmanager update-secret \
            --secret-id "${PROJECT_NAME}-${ENVIRONMENT}-jwt-secret" \
            --secret-string "$new_secret" \
            --region "$AWS_REGION"
        
        print_info "JWT secret rotated successfully!"
    else
        print_info "Operation cancelled."
    fi
}

# Function to update SMTP settings
update_smtp_settings() {
    local host="$1"
    local port="$2"
    local user="$3"
    local password="$4"
    
    local current_secrets=$(get_secret "app-secrets")
    local updated_secrets=$(echo "$current_secrets" | jq \
        --arg host "$host" \
        --arg port "$port" \
        --arg user "$user" \
        --arg password "$password" \
        '.smtp_host = $host | .smtp_port = $port | .smtp_user = $user | .smtp_password = $password')
    
    update_secret "app-secrets" "$updated_secrets"
    print_info "SMTP settings updated successfully!"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  list                          List all secrets"
    echo "  get <secret-name> [key]       Get secret value (optionally specific key)"
    echo "  details <secret-name>         Show secret details"
    echo "  create-env                    Create .env.local file from secrets"
    echo "  rotate-jwt                    Rotate JWT secret"
    echo "  update-smtp <host> <port> <user> <password>  Update SMTP settings"
    echo ""
    echo "Examples:"
    echo "  $0 list"
    echo "  $0 get database-secrets host"
    echo "  $0 create-env"
    echo "  $0 rotate-jwt"
}

# Main script logic
case "${1:-}" in
    "list")
        check_aws_cli
        list_secrets
        ;;
    "get")
        check_aws_cli
        if [ -z "${2:-}" ]; then
            print_error "Secret name is required"
            show_usage
            exit 1
        fi
        get_secret "$2" "${3:-}"
        ;;
    "details")
        check_aws_cli
        if [ -z "${2:-}" ]; then
            print_error "Secret name is required"
            show_usage
            exit 1
        fi
        show_secret_details "$2"
        ;;
    "create-env")
        check_aws_cli
        create_local_env
        ;;
    "rotate-jwt")
        check_aws_cli
        rotate_jwt_secret
        ;;
    "update-smtp")
        check_aws_cli
        if [ -z "${2:-}" ] || [ -z "${3:-}" ] || [ -z "${4:-}" ] || [ -z "${5:-}" ]; then
            print_error "All SMTP parameters are required: host, port, user, password"
            show_usage
            exit 1
        fi
        update_smtp_settings "$2" "$3" "$4" "$5"
        ;;
    *)
        show_usage
        ;;
esac
