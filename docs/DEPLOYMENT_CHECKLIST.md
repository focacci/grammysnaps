# GrammySnaps AWS Deployment Checklist

## Pre-Deployment Setup

### 1. Local Environment

- [ ] AWS CLI installed and configured (`aws configure`)
- [ ] Terraform installed (>= 1.0)
- [ ] Docker installed and running
- [ ] Git repository set up with all code

### 2. AWS Account Setup

- [ ] AWS account with appropriate permissions
- [ ] AWS credentials configured locally
- [ ] Billing alerts set up (recommended)

### 3. Domain Setup

- [ ] Domain `grannysnaps.dev` registered with Porkbun
- [ ] Domain management access available

## Infrastructure Deployment

### 4. Terraform Configuration

- [ ] Copy `aws-infrastructure/terraform.tfvars.example` to `aws-infrastructure/terraform.tfvars`
- [ ] Set `jwt_secret` (minimum 32 characters, cryptographically secure)
- [ ] Set `aws_access_key_id` for S3 access
- [ ] Set `aws_secret_access_key` for S3 access
- [ ] Review other variables in `aws-infrastructure/terraform.tfvars`

### 5. Initial Infrastructure Setup

- [ ] Run `./scripts/setup-infrastructure.sh`
- [ ] S3 bucket for Terraform state created
- [ ] DynamoDB table for state locking created
- [ ] Terraform initialized successfully

### 6. Deploy Infrastructure (First Pass)

```bash
cd aws-infrastructure
terraform plan
terraform apply
```

- [ ] VPC and networking components created
- [ ] RDS PostgreSQL database created
- [ ] ECS cluster created
- [ ] ECR repositories created
- [ ] Load balancer created
- [ ] S3 bucket for images created
- [ ] IAM roles and policies created

**Note**: SSL certificate validation will fail initially - this is expected.

### 7. DNS Configuration

Choose one option:

#### Option A: Route 53 (Recommended)

- [ ] Add Route 53 configuration to Terraform (see README)
- [ ] Run `terraform apply` again
- [ ] Update nameservers at Porkbun to Route 53 nameservers
- [ ] Wait for DNS propagation (up to 48 hours)

#### Option B: Manual DNS at Porkbun

- [ ] Get CloudFront distribution domain from Terraform output
- [ ] Create ALIAS/CNAME records at Porkbun:
  - `grannysnaps.dev` → CloudFront domain
  - `www.grannysnaps.dev` → CloudFront domain
- [ ] Create certificate validation CNAME records from Terraform output
- [ ] Wait for certificate validation (up to 30 minutes)

### 8. Complete Infrastructure Deployment

```bash
terraform apply
```

- [ ] SSL certificate validated and active
- [ ] CloudFront distribution configured
- [ ] All services healthy

## Application Deployment

### 9. GitHub Repository Setup

- [ ] Code pushed to GitHub repository
- [ ] GitHub Actions workflow files in place

### 10. GitHub Secrets Configuration

- [ ] Get GitHub Actions role ARN: `terraform output github_actions_role_arn`
- [ ] Add to GitHub repository secrets:
  - `AWS_ROLE_ARN`: The IAM role ARN from Terraform output

### 11. Initial Deployment

- [ ] Push to `main` branch to trigger deployment
- [ ] Monitor GitHub Actions workflow
- [ ] API and Web containers built and pushed to ECR
- [ ] ECS services updated with new containers
- [ ] Services healthy and running

### 12. Database Initialization

- [ ] Database tables created (via migration script or manual setup)
- [ ] Initial data seeded if needed

## Post-Deployment Verification

### 13. Application Testing

- [ ] Visit https://grannysnaps.dev
- [ ] Web application loads correctly
- [ ] API health check: https://grannysnaps.dev/api/health
- [ ] User registration works
- [ ] User login works
- [ ] Image upload works
- [ ] Collection creation/joining works

### 14. Monitoring Setup

- [ ] CloudWatch logs accessible for API: `/ecs/grammysnaps-api`
- [ ] CloudWatch logs accessible for Web: `/ecs/grammysnaps-web`
- [ ] RDS monitoring enabled
- [ ] Set up CloudWatch alarms (recommended)

### 15. Security Verification

- [ ] SSL certificate active (A+ rating on SSL Labs)
- [ ] HTTPS redirect working
- [ ] Security headers present
- [ ] Database not publicly accessible
- [ ] ECS tasks in private subnets

### 16. Performance Testing

- [ ] Page load times acceptable
- [ ] Image upload performance acceptable
- [ ] API response times good
- [ ] CDN caching working (check response headers)

## Ongoing Maintenance

### 17. Backup Verification

- [ ] RDS automated backups configured (7-day retention)
- [ ] S3 bucket versioning enabled
- [ ] Terraform state backed up in S3

### 18. Cost Monitoring

- [ ] AWS Cost Explorer set up
- [ ] Billing alerts configured
- [ ] Resource utilization monitored

### 19. Security Updates

- [ ] Container images scanned for vulnerabilities (ECR)
- [ ] Regular dependency updates planned
- [ ] Security patches applied regularly

## Troubleshooting Common Issues

### Certificate Validation Fails

- Verify DNS records are created correctly
- Wait up to 30 minutes for validation
- Check AWS Certificate Manager console

### ECS Tasks Fail to Start

- Check CloudWatch logs for container errors
- Verify environment variables in Parameter Store
- Check security groups allow traffic

### Database Connection Issues

- Verify RDS is in "available" state
- Check security groups between ECS and RDS
- Verify database credentials in Parameter Store

### High Costs

- Check ECS service desired counts
- Review RDS instance size
- Monitor S3 storage usage
- Check NAT Gateway usage

## Emergency Procedures

### Rollback Deployment

```bash
# Rollback ECS services to previous task definition
aws ecs update-service --cluster grammysnaps-cluster --service grammysnaps-api --task-definition <previous-task-def-arn>
aws ecs update-service --cluster grammysnaps-cluster --service grammysnaps-web --task-definition <previous-task-def-arn>
```

### Scale Down for Cost Savings

```bash
# Scale to zero (emergency cost saving)
aws ecs update-service --cluster grammysnaps-cluster --service grammysnaps-api --desired-count 0
aws ecs update-service --cluster grammysnaps-cluster --service grammysnaps-web --desired-count 0
```

### Database Recovery

- RDS automated backups available for point-in-time recovery
- Use AWS Console or CLI to restore from backup
- Update Parameter Store with new database endpoint if needed

## Success Criteria

✅ **Deployment is successful when:**

- Application accessible at https://grannysnaps.dev
- All features working correctly
- SSL certificate valid
- Monitoring and logging active
- Backups configured
- CI/CD pipeline functional

## Next Steps After Deployment

1. **Set up monitoring dashboards**
2. **Configure auto-scaling policies**
3. **Implement additional security measures (WAF, GuardDuty)**
4. **Set up development/staging environments**
5. **Document operational procedures**
6. **Plan disaster recovery procedures**
