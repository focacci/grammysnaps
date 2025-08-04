# Deployment Guide

## Overview

This project uses a two-tier deployment strategy:

- **Staging**: Automatic deployment via GitHub Actions when code is pushed to `main`
- **Production**: Manual deployment from your local machine using release branches

## Quick Start

### NPM Scripts (Recommended)

```bash
# Deploy current branch to staging
npm run deploy:staging

# Deploy current branch to production (requires RELEASE- branch name)
npm run deploy:production

# Monitor deployment status
npm run status staging
npm run status production
```

### Manual Scripts

```bash
# Deploy specific branch to staging
./scripts/deploy -e staging -b main

# Deploy specific branch to production
./scripts/deploy -e production -b RELEASE-v1.2.0

# Monitor deployment
./scripts/deployment-status staging
```

## Automatic Staging Deployment

Any push to the `main` branch automatically deploys to staging in `us-east-2`.

**Staging URL**: https://grammysnaps-alb-1397736712.us-east-2.elb.amazonaws.com

## Manual Production Deployment

Production deployments must be initiated manually and require:

1. A release branch with name starting with `RELEASE-`
2. Local execution of the deploy script

### Production Deployment Steps

1. **Create a release branch**:

   ```bash
   git checkout main
   git pull origin main
   git checkout -b RELEASE-v1.2.0
   git push origin RELEASE-v1.2.0
   ```

2. **Deploy to production** (choose one):

   ```bash
   # Using npm script (uses current branch automatically)
   npm run deploy:production

   # Using direct script
   ./scripts/deploy -e production -b RELEASE-v1.2.0
   ```

3. **Monitor deployment**:
   ```bash
   npm run status production
   # or
   ./scripts/deployment-status production
   ```

**Production URL**: https://grannysnaps.dev

## Deployment Scripts

### NPM Scripts

The project includes convenient npm scripts that automatically detect your current branch:

```bash
npm run deploy:staging     # Deploy current branch to staging
npm run deploy:production  # Deploy current branch to production
npm run status             # Monitor deployment status (requires environment arg)
```

**Benefits of NPM scripts**:

- Automatically uses current branch
- Shorter commands
- Consistent with Node.js workflow

### `./scripts/deploy`

Manual deployment script with required arguments:

```bash
./scripts/deploy -e <environment> -b <branch>
```

**Arguments**:

- `-e, --environment`: `staging` (us-east-2) or `production` (us-east-1)
- `-b, --branch`: Branch to checkout before deploying

**Examples**:

```bash
# Deploy staging from main
./scripts/deploy -e staging -b main

# Deploy production from release branch
./scripts/deploy -e production -b RELEASE-v1.2.0
```

**Requirements**:

- No unstaged changes in git (will show helpful error with git status)
- Valid AWS credentials configured
- Docker installed and running
- Production deployments require branch starting with `RELEASE-`

**Error Handling**:
The script provides detailed feedback for common issues:

- **Unstaged changes**: Shows full git status and helpful commands
- **Invalid branch**: Clear error messages with examples
- **AWS issues**: Credential validation and helpful debugging info

### `./scripts/deployment-status`

Real-time deployment monitoring:

```bash
./scripts/deployment-status <environment>
```

**Features**:

- Live updates every 10 seconds with color-coded status
- Shows service status, task counts, and rollout state
- Displays green success message when deployment completes
- Auto-exits on successful completion
- Shows deployment timing and application URL

**Examples**:

```bash
# Monitor staging deployment
./scripts/deployment-status staging

# Monitor production deployment
./scripts/deployment-status production
```

**Sample Output**:

```
📊 Deployment Status - staging
📍 Region: us-east-2 | Cluster: grammysnaps-cluster
⏰ Monitoring since: Mon Aug  4 14:30:00 2025

✅ API Service
   Status: ACTIVE | Rollout: COMPLETED
   Tasks: 1/1 running, 0 pending
   Started: 14:30:15

✅ Web Service
   Status: ACTIVE | Rollout: COMPLETED
   Tasks: 1/1 running, 0 pending
   Started: 14:30:18

🎉 DEPLOYMENT COMPLETED SUCCESSFULLY! 🎉
✅ All services are running and stable
⏱️  Total deployment time: 120s
🌐 Application URL: https://grammysnaps-alb-1397736712.us-east-2.elb.amazonaws.com
```

## Environment Details

| Environment | Region    | Cluster                  | Domain          | URL                                                            |
| ----------- | --------- | ------------------------ | --------------- | -------------------------------------------------------------- |
| Staging     | us-east-2 | grammysnaps-cluster      | ALB endpoint    | https://grammysnaps-alb-1397736712.us-east-2.elb.amazonaws.com |
| Production  | us-east-1 | grammysnaps-prod-cluster | grannysnaps.dev | https://grannysnaps.dev                                        |

**Infrastructure**:

- **Container Registry**: Amazon ECR (environment-specific repositories)
- **Compute**: AWS ECS Fargate with Application Load Balancer
- **Database**: Amazon RDS PostgreSQL with secrets management
- **Storage**: Amazon S3 for image uploads
- **CDN**: CloudFront (production only)

## Prerequisites

1. **AWS CLI** configured with appropriate permissions for ECS, ECR, and related services
2. **Docker** installed and running (for building container images)
3. **jq** for JSON parsing in status script (`brew install jq` or `apt-get install jq`)
4. **Git** with clean working directory (no unstaged changes)
5. **Node.js** and npm (for running npm scripts)

## Workflow Examples

### Staging Deployment

```bash
# Quick staging deployment of current branch
git add .
git commit -m "Feature: Add new functionality"
npm run deploy:staging
npm run status staging
```

### Production Release

```bash
# Create and deploy production release
git checkout main
git pull origin main
git checkout -b RELEASE-v1.2.0
git push origin RELEASE-v1.2.0
npm run deploy:production
npm run status production
```

### Emergency Rollback

```bash
# Quick rollback by redeploying previous release
git checkout RELEASE-v1.1.0
npm run deploy:production
npm run status production
```

## Troubleshooting

### Common Issues

1. **Unstaged changes**:

   ```
   ❌ Deployment failed: You have unstaged changes
   ```

   **Solution**: Commit or stash changes before deploying

   ```bash
   git add .
   git commit -m "Your commit message"
   # or
   git stash
   ```

2. **AWS credentials**:

   ```
   ❌ Error: AWS credentials not configured or invalid
   ```

   **Solution**: Configure AWS CLI with valid credentials

   ```bash
   aws configure
   aws sts get-caller-identity  # Verify credentials
   ```

3. **Branch naming for production**:

   ```
   ❌ Error: Production deployments require a branch starting with 'RELEASE-'
   ```

   **Solution**: Use proper release branch naming

   ```bash
   git checkout -b RELEASE-v1.2.0
   ```

4. **Docker daemon not running**:

   ```
   ❌ Error: Cannot connect to Docker daemon
   ```

   **Solution**: Start Docker Desktop or docker service

   ```bash
   # macOS/Windows
   open -a Docker

   # Linux
   sudo systemctl start docker
   ```

5. **Missing jq for status monitoring**:

   ```
   ❌ Error: 'jq' is required but not installed
   ```

   **Solution**: Install jq

   ```bash
   # macOS
   brew install jq

   # Ubuntu/Debian
   sudo apt-get install jq
   ```

### Getting Help

```bash
# Deploy script help
./scripts/deploy --help

# Check current AWS configuration
aws sts get-caller-identity

# View ECS service status
aws ecs describe-services --cluster grammysnaps-cluster --services grammysnaps-api grammysnaps-web

# Check recent deployments
aws ecs list-tasks --cluster grammysnaps-cluster --service-name grammysnaps-api

# View container logs
aws logs tail /ecs/grammysnaps-api --follow
```

### Debug Commands

```bash
# Check current git status
git status

# View recent commits
git log --oneline -5

# Check Docker is running
docker ps

# Test AWS connectivity
aws sts get-caller-identity

# Check ECR repositories
aws ecr describe-repositories --region us-east-2
```
