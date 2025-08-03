#!/bin/bash

# Deployment setup script for grammysnaps
set -e

echo "🚀 Setting up grammysnaps AWS infrastructure..."

# Check if required tools are installed
command -v terraform >/dev/null 2>&1 || { echo "❌ Terraform is required but not installed. Aborting." >&2; exit 1; }
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI is required but not installed. Aborting." >&2; exit 1; }

# Check if we're in the right directory
if [ ! -f "aws-infrastructure/main.tf" ]; then
    echo "❌ Please run this script from the root of the grammysnaps project"
    exit 1
fi

# Create terraform.tfvars if it doesn't exist
if [ ! -f "aws-infrastructure/terraform.tfvars" ]; then
    echo "📝 Creating terraform.tfvars from template..."
    cp aws-infrastructure/terraform.tfvars.example aws-infrastructure/terraform.tfvars
    echo "⚠️  Please edit aws-infrastructure/terraform.tfvars and set your secrets before continuing!"
    echo "   Required variables: jwt_secret, aws_access_key_id, aws_secret_access_key"
    exit 1
fi

# Check AWS credentials
echo "🔐 Checking AWS credentials..."
aws sts get-caller-identity > /dev/null || { echo "❌ AWS credentials not configured. Run 'aws configure' first." >&2; exit 1; }

# Create S3 bucket for Terraform state if it doesn't exist
BUCKET_NAME="grammysnaps-terraform-state-dev"
REGION="us-east-2"

echo "🪣 Checking if S3 bucket for Terraform state exists..."
if ! aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
    echo "📦 Creating S3 bucket for Terraform state..."
    aws s3api create-bucket --bucket "$BUCKET_NAME" --region "$REGION"
    aws s3api put-bucket-encryption --bucket "$BUCKET_NAME" --server-side-encryption-configuration '{
        "Rules": [
            {
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                }
            }
        ]
    }'
    aws s3api put-bucket-versioning --bucket "$BUCKET_NAME" --versioning-configuration Status=Enabled
    echo "✅ S3 bucket created successfully"
else
    echo "✅ S3 bucket already exists"
fi

# Create DynamoDB table for state locking if it doesn't exist
TABLE_NAME="grammysnaps-terraform-locks-dev"
echo "🔒 Checking if DynamoDB table for state locking exists..."
if ! aws dynamodb describe-table --table-name "$TABLE_NAME" 2>/dev/null; then
    echo "📋 Creating DynamoDB table for state locking..."
    aws dynamodb create-table \
        --table-name "$TABLE_NAME" \
        --attribute-definitions AttributeName=LockID,AttributeType=S \
        --key-schema AttributeName=LockID,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --region "$REGION"
    echo "✅ DynamoDB table created successfully"
else
    echo "✅ DynamoDB table already exists"
fi

# Initialize Terraform
echo "🔧 Initializing Terraform..."
cd aws-infrastructure
terraform init

echo ""
echo "✅ Setup complete! Next steps:"
echo "1. Review and update aws-infrastructure/terraform.tfvars with your secrets"
echo "2. Run 'terraform plan' to review the infrastructure changes"
echo "3. Run 'terraform apply' to create the infrastructure"
echo "4. Follow the DNS setup instructions in the output"
echo "5. Set up GitHub secrets for CI/CD"
echo ""
echo "📖 See the README for detailed instructions."
