# Multi-Environment Deployment Guide

This guide explains how to deploy GrammySnaps to multiple environments using the same Terraform codebase.

## 🏗️ Current Setup

- **Staging**: `grammysnaps.dev` in `us-east-2`
- **Production**: `grammysnaps.com` in `us-east-1` (or `us-east-2`)

## 📁 File Structure

```
aws-infrastructure/
├── main.tf                      # Main Terraform configuration
├── variables.tf                 # Variable definitions
├── outputs.tf                   # Output definitions
├── terraform.staging.tfvars     # Staging environment config
├── terraform.production.tfvars  # Production environment config
├── load-balancer.tf             # SSL and load balancer setup
├── route53.tf                   # DNS configuration
└── ... (other .tf files)
```

## 🚀 Deployment Commands

### Deploy to Staging

```bash
cd aws-infrastructure

# Plan staging deployment
terraform plan -var-file="terraform.staging.tfvars"

# Apply staging deployment
terraform apply -var-file="terraform.staging.tfvars"

# Or use the SSL setup script
../scripts/setup-ssl.sh staging
```

### Deploy to Production

```bash
cd aws-infrastructure

# Plan production deployment
terraform plan -var-file="terraform.production.tfvars"

# Apply production deployment
terraform apply -var-file="terraform.production.tfvars"

# Or use the SSL setup script
../scripts/setup-ssl.sh production
```

## 🔧 Key Differences Between Environments

| Feature              | Staging                | Production                |
| -------------------- | ---------------------- | ------------------------- |
| **Domain**           | grammysnaps.dev        | grammysnaps.com           |
| **Region**           | us-east-2              | us-east-1                 |
| **API CPU**          | 512                    | 1024                      |
| **API Memory**       | 1024 MB                | 2048 MB                   |
| **DB Instance**      | db.t3.micro            | db.t3.small               |
| **DB Storage**       | 20 GB                  | 50 GB                     |
| **Backup Retention** | 7 days                 | 30 days                   |
| **Resource Names**   | grammysnaps-staging-\* | grammysnaps-production-\* |

## 🔐 Secrets Management

Each environment uses separate secrets:

### Staging Secrets

- Stored in: `grammysnaps-staging-*` secrets
- Used by: Staging ECS tasks

### Production Secrets

- Stored in: `grammysnaps-production-*` secrets
- Used by: Production ECS tasks

**Important**: Update `terraform.production.tfvars` with production-specific secrets before deploying.

## 🌐 DNS Setup

### Staging (grammysnaps.dev)

1. Domain managed by Porkbun
2. Nameservers point to Route 53
3. SSL certificates automatically validated

### Production (grammysnaps.com)

1. Set up domain registrar to point to Route 53
2. Update nameservers (will be output after terraform apply)
3. SSL certificates automatically validated

## 📊 State Management

Both environments use the same Terraform state file but with different resource names based on the `environment` variable.

### Resource Naming Convention

- **Staging**: `grammysnaps-staging-api`, `grammysnaps-staging-web`
- **Production**: `grammysnaps-production-api`, `grammysnaps-production-web`

## 🔄 CI/CD Integration

### GitHub Actions Deployment

Update your deployment scripts to support multiple environments:

```bash
# Deploy staging on main branch
./scripts/deploy staging

# Deploy production on release tags
./scripts/deploy production
```

## 📋 Pre-Production Checklist

Before deploying to production:

- [ ] Update `terraform.production.tfvars` with production secrets
- [ ] Register production domain (`grammysnaps.com`)
- [ ] Configure production DNS
- [ ] Set up production monitoring
- [ ] Test staging environment thoroughly
- [ ] Backup production database strategy
- [ ] Set up production alerts

## 🚨 Safety Best Practices

### 1. Always Plan First

```bash
terraform plan -var-file="terraform.production.tfvars"
```

### 2. Use Different AWS Regions

- Staging: `us-east-2`
- Production: `us-east-1`
- Provides isolation and disaster recovery

### 3. Separate Secrets

- Never share secrets between environments
- Use different AWS access keys for each environment

### 4. Database Backups

- Staging: 7-day retention
- Production: 30-day retention + manual backups

## 🔧 Troubleshooting

### Wrong Environment Deployed

1. Check the `environment` variable in your tfvars file
2. Verify resource names in AWS console
3. Use `terraform show` to see current state

### DNS Issues

1. Verify nameservers are correct
2. Check Route 53 hosted zone
3. Wait for DNS propagation (up to 48 hours)

### SSL Certificate Issues

1. Check certificate status in AWS Certificate Manager
2. Verify DNS validation records
3. Monitor with `./scripts/monitor-dns-update.sh`

## 📈 Scaling Considerations

### Staging → Production Promotion

1. Test thoroughly in staging
2. Database migration planning
3. Zero-downtime deployment strategy
4. Rollback procedures

### Multi-Region Setup

If you need multiple regions:

1. Create separate Terraform directories
2. Use Terraform modules for shared components
3. Set up cross-region replication
4. Implement global load balancing
