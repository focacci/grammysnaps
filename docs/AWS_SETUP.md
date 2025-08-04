# 🚀 GrammySnaps AWS Infrastructure Setup

I've created a comprehensive AWS deployment infrastructure for your GrammySnaps application using Terraform and GitHub Actions. Here's what has been set up:

## 📁 New Files Created

### Terraform Infrastructure (`/aws-infrastructure/`)

- `main.tf` - Main Terraform configuration with providers and S3 state management
- `variables.tf` - All configurable variables for the infrastructure
- `networking.tf` - VPC, subnets, security groups, and networking components
- `database.tf` - RDS PostgreSQL database with backup and monitoring
- `load-balancer.tf` - Application Load Balancer, SSL certificates, and CloudFront CDN
- `ecs.tf` - ECS Fargate cluster, task definitions, and services
- `ecr.tf` - ECR repositories and GitHub Actions IAM setup
- `outputs.tf` - All outputs and DNS setup instructions
- `terraform.tfvars.example` - Example configuration file
- `.gitignore` - Terraform-specific gitignore
- `README.md` - Comprehensive setup and usage guide

### CI/CD Pipeline

- `.github/workflows/deploy.yml` - GitHub Actions workflow for automated deployment
- Updated existing `.github/workflows/api-tests.yml` (referenced for consistency)

### Deployment Scripts & Documentation

- `scripts/setup-infrastructure.sh` - Automated setup script
- `DEPLOYMENT_CHECKLIST.md` - Step-by-step deployment checklist
- `api/scripts/migrate.ts` - Database migration script

### Docker Optimizations

- Updated `api/Dockerfile` with multi-stage builds and security improvements
- Updated `web/Dockerfile` with security improvements and health checks
- Updated `web/nginx.conf` with enhanced security headers and caching

## 🏗️ Infrastructure Components

### Core Services

- **ECS Fargate**: Containerized API and web applications
- **RDS PostgreSQL**: Managed database with automated backups
- **Application Load Balancer**: Traffic distribution and SSL termination
- **CloudFront CDN**: Global content delivery and caching
- **S3**: Image storage with proper CORS and security
- **ECR**: Container image repositories

### Networking & Security

- **VPC**: Isolated network with public/private/database subnets
- **NAT Gateways**: Secure internet access for private subnets
- **Security Groups**: Least-privilege network access
- **SSL Certificate**: Automated certificate management via ACM
- **IAM Roles**: Principle of least privilege for all services

### Monitoring & Operations

- **CloudWatch Logs**: Centralized logging for all services
- **Parameter Store**: Secure secret management
- **Health Checks**: Application and infrastructure monitoring
- **Auto-scaling**: Ready for traffic growth

## 🚀 Quick Start

### 1. Prerequisites Setup

```bash
# Install required tools
# - AWS CLI (aws configure)
# - Terraform (>= 1.0)
# - Docker

# Verify AWS access
aws sts get-caller-identity
```

### 2. Configure Secrets

```bash
# Copy and edit configuration
cp aws-infrastructure/terraform.tfvars.example aws-infrastructure/terraform.tfvars

# Set required secrets in aws-infrastructure/terraform.tfvars:
# - jwt_secret (32+ character secure string)
# - aws_access_key_id (for S3 access)
# - aws_secret_access_key (for S3 access)
```

### 3. Deploy Infrastructure

```bash
# Run automated setup
./scripts/setup-infrastructure.sh

# Deploy infrastructure
cd aws-infrastructure
terraform plan
terraform apply
```

### 4. Configure DNS

Follow the DNS setup instructions in the Terraform output to:

- Validate SSL certificates
- Point your domain to CloudFront

### 5. Set Up CI/CD

- Get GitHub Actions role ARN from Terraform output
- Add `AWS_ROLE_ARN` secret to your GitHub repository
- Push to main branch to trigger deployment

## 🎯 Key Features

### Zero-Downtime Deployments

- Blue-green deployments via ECS
- Health checks ensure service availability
- Automatic rollback on failure

### Database Persistence

- RDS with automated backups (7-day retention)
- Multi-AZ deployment for production
- Point-in-time recovery available
- Database runs independently of application deployments

### Security Best Practices

- All secrets stored in AWS Parameter Store (encrypted)
- Database in private subnets (no public access)
- Container images scanned for vulnerabilities
- SSL/TLS encryption everywhere
- Proper IAM roles with least privilege

### Cost Optimization

- t3.micro RDS instance (free tier eligible)
- Fargate spot pricing ready
- CloudFront caching reduces origin requests
- ECR lifecycle policies for image cleanup

### Scalability Ready

- Auto-scaling policies can be easily added
- Load balancer handles traffic distribution
- Database can be scaled vertically/horizontally
- CDN provides global performance

## 📋 Next Steps

1. **Follow the Deployment Checklist** (`DEPLOYMENT_CHECKLIST.md`)
2. **Review the detailed README** (`terraform/README.md`)
3. **Set up monitoring dashboards** (CloudWatch)
4. **Configure backup verification**
5. **Plan disaster recovery procedures**

## 🔧 Daily Operations

### View Application Logs

```bash
aws logs tail /ecs/grammysnaps-api --follow
aws logs tail /ecs/grammysnaps-web --follow
```

### Scale Services

```bash
aws ecs update-service --cluster grammysnaps-cluster --service grammysnaps-api --desired-count 2
```

### Database Migration

```bash
# Run via ECS task
aws ecs run-task --cluster grammysnaps-cluster --task-definition grammysnaps-api --overrides '{"containerOverrides":[{"name":"api","command":["npm","run","migrate"]}]}'
```

## 🌍 Domain Configuration

Your application will be available at:

- **Primary**: https://grammysnaps.dev
- **API**: https://grammysnaps.dev/api
- **Health Check**: https://grammysnaps.dev/api/health

## 💰 Estimated Monthly Costs

For a typical small-scale deployment:

- **RDS t3.micro**: ~$15/month
- **ECS Fargate**: ~$20-40/month (depending on traffic)
- **ALB**: ~$16/month
- **CloudFront**: ~$1-5/month (depending on traffic)
- **S3**: ~$1-10/month (depending on storage)
- **Data Transfer**: ~$5-20/month (depending on traffic)

**Total**: ~$58-106/month (can be optimized further)

## 🆘 Support

- Check `DEPLOYMENT_CHECKLIST.md` for troubleshooting
- Review `terraform/README.md` for detailed documentation
- Monitor CloudWatch logs for application issues
- Use AWS support for infrastructure problems

This infrastructure is production-ready and follows AWS best practices for security, scalability, and reliability. The setup supports your requirements for persistent database deployments, comprehensive CI/CD with testing, and proper environment variable management.

🎉 **You're ready to deploy GrammySnaps to AWS!**
