# GrammySnaps AWS Deployment Guide

This guide walks you through deploying the GrammySnaps application to AWS using Terraform and GitHub Actions.

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **Domain** registered (grammysnaps.dev via Porkbun)
3. **GitHub repository** with the code
4. **Local tools**:
   - [Terraform](https://terraform.io) (>= 1.0)
   - [AWS CLI](https://aws.amazon.com/cli/) (>= 2.0)
   - Docker

## Architecture Overview

The infrastructure includes:

- **ECS Fargate** for containerized applications
- **RDS PostgreSQL** for the database
- **Application Load Balancer** for traffic distribution
- **CloudFront** for CDN and SSL termination
- **S3** for image storage
- **ECR** for container images
- **Route 53** for DNS (optional)

## Step 1: Configure AWS Credentials

```bash
aws configure
```

Set your AWS access key, secret key, region (us-east-1), and output format.

## Step 2: Set Up Terraform Variables

```bash
# Copy the example variables file
cp aws-infrastructure/terraform.tfvars.example aws-infrastructure/terraform.tfvars

# Edit the variables file
nano aws-infrastructure/terraform.tfvars
```

Set the following secrets in `aws-infrastructure/terraform.tfvars`:

```hcl
# Required secrets
jwt_secret = "your-super-secret-jwt-key-minimum-32-characters"
aws_access_key_id = "AKIA..."  # For S3 access from the app
aws_secret_access_key = "..."  # For S3 access from the app
```

## Step 3: Run Infrastructure Setup

```bash
./scripts/setup-infrastructure.sh
```

This script will:

- Create S3 bucket for Terraform state
- Create DynamoDB table for state locking
- Initialize Terraform

## Step 4: Deploy Infrastructure

```bash
cd aws-infrastructure

# Review the planned changes
terraform plan

# Apply the infrastructure
terraform apply
```

**Note**: The initial `terraform apply` may fail with SSL certificate validation errors. This is expected - you need to set up DNS first.

## Step 5: Configure DNS

After the first Terraform run, you'll get output with DNS instructions. You need to:

1. **Create DNS records** for SSL certificate validation
2. **Set up domain routing** to CloudFront

### Option A: Using Route 53 (Recommended)

If you want to use Route 53 for DNS management:

```bash
# Add this to your aws-infrastructure/main.tf or create a new dns.tf file
resource "aws_route53_zone" "main" {
  name = var.domain_name
  tags = {
    Name = "${var.project_name}-zone"
  }
}

resource "aws_route53_record" "main" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}

# Certificate validation
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.main.zone_id
}

resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]

  timeouts {
    create = "5m"
  }
}
```

Then update your domain's nameservers at Porkbun to use Route 53's nameservers.

### Option B: Manual DNS Setup

1. **At your DNS provider** (Porkbun or another), create these records:
   - `grammysnaps.dev` → ALIAS/CNAME to CloudFront domain
   - `www.grammysnaps.dev` → ALIAS/CNAME to CloudFront domain
   - Certificate validation CNAME records (shown in Terraform output)

## Step 6: Complete Infrastructure Deployment

After setting up DNS:

```bash
# Run terraform apply again to complete the setup
terraform apply
```

## Step 7: Set Up GitHub Actions

1. **Get the GitHub Actions IAM Role ARN** from Terraform output:

   ```bash
   terraform output github_actions_role_arn
   ```

2. **Add GitHub Secrets** in your repository settings:

   - `AWS_ROLE_ARN`: The IAM role ARN from step 1

3. **Push to main branch** to trigger the first deployment

## Step 8: Initial Database Setup

The database will be created automatically, but you need to run initial migrations:

```bash
# Option 1: Run migrations through ECS task
aws ecs run-task \
  --cluster grammysnaps-cluster \
  --task-definition grammysnaps-api \
  --overrides '{
    "containerOverrides": [{
      "name": "api",
      "command": ["npm", "run", "migrate"]
    }]
  }'

# Option 2: Connect to RDS directly and run your SQL scripts
# (Use the RDS endpoint from Terraform output)
```

## Application URLs

After deployment:

- **Main site**: https://grammysnaps.dev
- **API**: https://grammysnaps.dev/api
- **Health check**: https://grammysnaps.dev/api/health

## Monitoring and Maintenance

### View Logs

```bash
# API logs
aws logs tail /ecs/grammysnaps-api --follow

# Web logs
aws logs tail /ecs/grammysnaps-web --follow
```

### Scale Services

```bash
# Scale API service
aws ecs update-service \
  --cluster grammysnaps-cluster \
  --service grammysnaps-api \
  --desired-count 2

# Scale Web service
aws ecs update-service \
  --cluster grammysnaps-cluster \
  --service grammysnaps-web \
  --desired-count 2
```

### Database Backups

RDS automatically creates backups daily. To restore:

1. Go to AWS RDS Console
2. Select your database
3. Choose "Restore to point in time"

### Zero-Downtime Deployments

The GitHub Actions workflow performs zero-downtime deployments by:

1. Building new container images
2. Updating ECS services with new images
3. ECS gradually replaces old containers with new ones
4. Health checks ensure new containers are healthy before removing old ones

## Cost Optimization

- **RDS**: Start with `db.t3.micro` (free tier eligible)
- **ECS**: Use minimal CPU/memory allocations initially
- **CloudFront**: Caches static assets to reduce origin requests
- **S3**: Uses lifecycle policies to manage old container images

## Troubleshooting

### SSL Certificate Issues

- Ensure DNS validation records are created correctly
- Wait up to 30 minutes for validation to complete
- Check certificate status in AWS Certificate Manager

### ECS Service Issues

```bash
# Check service status
aws ecs describe-services \
  --cluster grammysnaps-cluster \
  --services grammysnaps-api grammysnaps-web

# Check task status
aws ecs list-tasks \
  --cluster grammysnaps-cluster \
  --service grammysnaps-api
```

### Database Connection Issues

- Verify security groups allow traffic between ECS and RDS
- Check Parameter Store values for database credentials
- Ensure database is in "available" state

## Security Considerations

- Database is in private subnets with no public access
- ECS tasks run in private subnets
- All secrets stored in AWS Parameter Store (encrypted)
- SSL/TLS termination at CloudFront
- Security groups follow principle of least privilege
- ECR repositories scan images for vulnerabilities

## Backup and Disaster Recovery

- **Database**: Automated daily backups with 7-day retention
- **Application**: Stateless containers can be redeployed quickly
- **Images**: S3 bucket has versioning enabled
- **Infrastructure**: Terraform state is backed up in S3

## Future Improvements

1. **Multi-region deployment** for better availability
2. **Auto-scaling** based on CPU/memory metrics
3. **Enhanced monitoring** with CloudWatch dashboards
4. **WAF** for additional security
5. **Redis cache** for session management and caching
