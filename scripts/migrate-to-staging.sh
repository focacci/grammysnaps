#!/bin/bash

# Migration script to rename environment from 'dev' to 'staging'
# This script handles Terraform state migration and AWS resource updates

set -e

echo "🔄 Migrating environment from 'dev' to 'staging'"
echo "================================================"

# Navigate to infrastructure directory
cd "$(dirname "$0")/../aws-infrastructure"

echo "📍 Current directory: $(pwd)"

# Create new DynamoDB table for staging locks
echo "🔒 Creating new DynamoDB table for staging locks..."
TABLE_NAME="grammysnaps-terraform-locks-staging"

if ! aws dynamodb describe-table --table-name "$TABLE_NAME" 2>/dev/null; then
    echo "📋 Creating DynamoDB table: $TABLE_NAME"
    aws dynamodb create-table \
        --table-name "$TABLE_NAME" \
        --attribute-definitions AttributeName=LockID,AttributeType=S \
        --key-schema AttributeName=LockID,KeyType=HASH \
        --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
        --tags Key=Project,Value=grammysnaps Key=Environment,Value=staging

    echo "⏳ Waiting for table to be created..."
    aws dynamodb wait table-exists --table-name "$TABLE_NAME"
    echo "✅ DynamoDB table created successfully"
else
    echo "✅ DynamoDB table already exists"
fi

# Step 1: Download current state from old location
echo "📥 Downloading current state from dev environment..."
aws s3 cp "s3://grammysnaps/terraform-state/dev/terraform.tfstate" "./terraform-dev-backup.tfstate" 2>/dev/null || echo "⚠️ No existing dev state found (this is okay for first migration)"

# Step 2: Re-initialize Terraform with new backend configuration
echo "🔄 Re-initializing Terraform with new backend configuration..."
rm -rf .terraform

# Initialize with the new backend configuration
terraform init

# Step 3: If we have a backup state, import it to the new location
if [ -f "./terraform-dev-backup.tfstate" ]; then
    echo "📤 Uploading state to new staging location..."
    aws s3 cp "./terraform-dev-backup.tfstate" "s3://grammysnaps/terraform-state/staging/terraform.tfstate"
    
    # Download the state to local terraform state
    terraform state pull > current-state.json
    echo "✅ State migrated successfully"
    
    # Clean up backup
    rm "./terraform-dev-backup.tfstate"
else
    echo "ℹ️ No previous state to migrate"
fi

echo ""
echo "🎉 Migration completed successfully!"
echo ""
echo "📋 Summary of changes:"
echo "   • Environment: dev → staging"
echo "   • DynamoDB table: grammysnaps-terraform-locks-dev → grammysnaps-terraform-locks-staging"
echo "   • State location: terraform-state/dev/ → terraform-state/staging/"
echo ""
echo "🔄 Next steps:"
echo "   1. Run 'terraform plan' to verify the configuration"
echo "   2. Run 'terraform apply' to update any environment-specific resources"
echo "   3. Update any hardcoded 'dev' references in your application code"
echo ""

# Show current status
echo "📊 Current Terraform state:"
terraform state list 2>/dev/null || echo "No resources in state yet"
