# Environment Naming Migration Guide

This document explains the migration from "dev" to "staging" environment naming and the new environment structure.

## New Environment Structure

### 1. **Development** (`development`)

- **Purpose**: Local development and testing
- **Domain**: `localhost`
- **Resources**: Minimal AWS resources for testing
- **Config File**: `terraform.development.tfvars`
- **State**: `terraform-state/development/terraform.tfstate`

### 2. **Staging** (`staging`) - _formerly "dev"_

- **Purpose**: Beta testing and pre-production validation
- **Domain**: `grannysnaps.dev`
- **Resources**: Production-like environment for testing
- **Config File**: `terraform.tfvars` (main config)
- **State**: `terraform-state/staging/terraform.tfstate`

### 3. **Production** (`production`)

- **Purpose**: Live production environment
- **Domain**: TBD (future production domain)
- **Resources**: Full production setup
- **Config File**: `terraform.production.tfvars` (future)
- **State**: `terraform-state/production/terraform.tfstate`

## Migration Steps

### Automatic Migration (Recommended)

Run the migration script to handle the transition:

```bash
./scripts/migrate-to-staging.sh
```

This script will:

1. Create new DynamoDB table: `grammysnaps-terraform-locks-staging`
2. Migrate Terraform state from `dev` to `staging` location
3. Re-initialize Terraform with new backend configuration
4. Preserve all existing AWS resources

### Manual Migration (Alternative)

If you prefer to migrate manually:

1. **Update configuration files** (already done):

   - `terraform.tfvars`: `environment = "staging"`
   - `main.tf`: Updated backend configuration

2. **Create new DynamoDB table**:

   ```bash
   aws dynamodb create-table \
     --table-name "grammysnaps-terraform-locks-staging" \
     --attribute-definitions AttributeName=LockID,AttributeType=S \
     --key-schema AttributeName=LockID,KeyType=HASH \
     --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5
   ```

3. **Backup current state**:

   ```bash
   aws s3 cp "s3://grammysnaps/terraform-state/dev/terraform.tfstate" "./backup-dev-state.tfstate"
   ```

4. **Re-initialize Terraform**:

   ```bash
   cd aws-infrastructure
   rm -rf .terraform
   terraform init
   ```

5. **Upload state to new location**:
   ```bash
   aws s3 cp "./backup-dev-state.tfstate" "s3://grammysnaps/terraform-state/staging/terraform.tfstate"
   ```

## Updated Resource Names

The following resources will be renamed with the environment change:

### AWS Resources

- **DynamoDB Table**: `grammysnaps-terraform-locks-dev` → `grammysnaps-terraform-locks-staging`
- **State File Path**: `terraform-state/dev/` → `terraform-state/staging/`
- **S3 Bucket**: Remains `grammysnaps` (as requested)

### Secret Manager Names

- `grammysnaps-dev-database-secrets` → `grammysnaps-staging-database-secrets`
- `grammysnaps-dev-jwt-secret` → `grammysnaps-staging-jwt-secret`
- `grammysnaps-dev-aws-credentials` → `grammysnaps-staging-aws-credentials`
- `grammysnaps-dev-app-secrets` → `grammysnaps-staging-app-secrets`

## Usage Examples

### Deploy to Staging (Current Beta)

```bash
cd aws-infrastructure
terraform plan -var-file="terraform.tfvars"
terraform apply -var-file="terraform.tfvars"
```

### Deploy to Development (Local Testing)

```bash
cd aws-infrastructure
terraform plan -var-file="terraform.development.tfvars"
terraform apply -var-file="terraform.development.tfvars"
```

### Future Production Deployment

```bash
cd aws-infrastructure
terraform plan -var-file="terraform.production.tfvars"
terraform apply -var-file="terraform.production.tfvars"
```

## Configuration Files Updated

- ✅ `aws-infrastructure/terraform.tfvars`
- ✅ `aws-infrastructure/terraform.tfvars.example`
- ✅ `aws-infrastructure/main.tf`
- ✅ `aws-infrastructure/variables.tf`
- ✅ `scripts/setup-infrastructure.sh`
- ✅ Created `terraform.development.tfvars`
- ✅ Created migration script

## Next Steps

1. **Run the migration**: `./scripts/migrate-to-staging.sh`
2. **Verify the setup**: `terraform plan`
3. **Update application environment variables** if needed
4. **Update documentation** to reflect new environment names
5. **Consider updating CI/CD pipelines** to use new environment names

## Rollback Plan

If you need to rollback to the "dev" naming:

1. Revert the configuration files to use `environment = "dev"`
2. Update the backend configuration to use the old paths
3. Re-initialize Terraform with the original configuration
4. The old state files and DynamoDB table will still exist
