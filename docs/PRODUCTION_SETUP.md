# Production Deployment Setup

This guide covers deploying the production environment to `us-east-1` after your dev environment testing is complete.

## Environment Strategy

- **Dev Environment**: `us-east-2`, domain: `grannysnaps.dev` (current setup)
- **Production Environment**: `us-east-1`, domain: `grannysnaps.dev` (future)

## Production Deployment Steps

### 1. Create Production Terraform Configuration

```bash
# Create production-specific terraform files
mkdir -p aws-infrastructure/environments/production
cp aws-infrastructure/terraform.tfvars.example aws-infrastructure/environments/production/terraform.tfvars
```

### 2. Update Production Variables

Edit `aws-infrastructure/environments/production/terraform.tfvars`:

```hcl
# AWS Configuration for Production
aws_region = "us-east-1"
environment = "production"
project_name = "grammysnaps"
domain_name = "grannysnaps.dev"

# Production-optimized settings
api_cpu = 1024
api_memory = 2048
web_cpu = 512
web_memory = 1024

# Production database settings
db_instance_class = "db.t3.small"  # Larger than dev
db_allocated_storage = 50
db_max_allocated_storage = 200
db_backup_retention_period = 30    # Longer retention for production

# Secrets (set these to production values)
jwt_secret = "production-jwt-secret-32-plus-characters"
aws_access_key_id = "production-aws-access-key"
aws_secret_access_key = "production-aws-secret-key"
```

### 3. Update Backend Configuration for Production

Create `aws-infrastructure/environments/production/backend.tf`:

```hcl
terraform {
  backend "s3" {
    bucket         = "grammysnaps-terraform-state-prod"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "grammysnaps-terraform-locks-prod"
  }
}
```

### 4. Deploy Production Infrastructure

```bash
# Initialize production environment
cd aws-infrastructure
terraform init -backend-config=environments/production/backend.tf

# Plan and apply with production variables
terraform plan -var-file=environments/production/terraform.tfvars
terraform apply -var-file=environments/production/terraform.tfvars
```

### 5. Update GitHub Actions for Multi-Environment

Update `.github/workflows/deploy.yml` to support multiple environments:

```yaml
name: Deploy to AWS

on:
  push:
    branches:
      - main # Deploy to production
      - develop # Deploy to dev
    paths:
      - "api/**"
      - "web/**"
      - ".github/workflows/deploy.yml"
  workflow_dispatch:
    inputs:
      environment:
        description: "Environment to deploy to"
        required: true
        default: "dev"
        type: choice
        options:
          - dev
          - production

env:
  PROJECT_NAME: grammysnaps

jobs:
  set-environment:
    runs-on: ubuntu-latest
    outputs:
      environment: ${{ steps.set-env.outputs.environment }}
      aws-region: ${{ steps.set-env.outputs.aws-region }}
      domain: ${{ steps.set-env.outputs.domain }}
    steps:
      - id: set-env
        run: |
          if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
            echo "environment=production" >> $GITHUB_OUTPUT
            echo "aws-region=us-east-1" >> $GITHUB_OUTPUT
            echo "domain=grannysnaps.dev" >> $GITHUB_OUTPUT
          elif [[ "${{ github.event.inputs.environment }}" == "production" ]]; then
            echo "environment=production" >> $GITHUB_OUTPUT
            echo "aws-region=us-east-1" >> $GITHUB_OUTPUT
            echo "domain=grannysnaps.dev" >> $GITHUB_OUTPUT
          else
            echo "environment=dev" >> $GITHUB_OUTPUT
            echo "aws-region=us-east-2" >> $GITHUB_OUTPUT
            echo "domain=grannysnaps.dev" >> $GITHUB_OUTPUT
          fi

  # ... rest of your jobs using the environment outputs
```

### 6. DNS Migration Strategy

When ready to switch from dev to production:

1. **Blue-Green DNS Switch**:

   - Keep dev environment running
   - Deploy production environment
   - Test production thoroughly
   - Update DNS to point to production CloudFront
   - Monitor and validate
   - Scale down dev environment (but keep for rollback)

2. **Database Migration**:
   - Export data from dev RDS
   - Import to production RDS
   - Verify data integrity

### 7. Monitoring and Alerting for Production

Add production-specific monitoring:

```hcl
# CloudWatch Alarms for Production
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  count               = var.environment == "production" ? 1 : 0
  alarm_name          = "${var.project_name}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ecs cpu utilization"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    ServiceName = aws_ecs_service.api.name
    ClusterName = aws_ecs_cluster.main.name
  }
}

resource "aws_sns_topic" "alerts" {
  count = var.environment == "production" ? 1 : 0
  name  = "${var.project_name}-alerts"
}
```

## Cost Considerations

### Dev Environment (us-east-2)

- Smaller instance sizes
- Shorter backup retention
- Can be shut down during off-hours

### Production Environment (us-east-1)

- Multi-AZ RDS for high availability
- Larger instance sizes for performance
- Longer backup retention (30 days)
- Auto-scaling enabled
- Enhanced monitoring

## Rollback Strategy

If issues occur in production:

1. **Quick DNS Rollback**: Point DNS back to dev environment
2. **Application Rollback**: Deploy previous container versions
3. **Database Rollback**: Restore from automated backups

## Environment Isolation

- Separate AWS accounts (recommended) or separate regions
- Separate state files and DynamoDB tables
- Separate ECR repositories with environment tags
- Separate secrets and parameter stores
- Separate monitoring and alerting

This strategy allows you to:

- Test thoroughly in dev before production deployment
- Maintain dev environment for ongoing testing
- Have quick rollback capabilities
- Scale each environment independently
