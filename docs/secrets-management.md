# AWS Secrets Manager Integration

This document explains how environment variables and secrets are managed in the grammysnaps application using AWS Secrets Manager.

## Overview

The application uses AWS Secrets Manager to store sensitive configuration data securely. This provides several benefits:

- **Security**: Secrets are encrypted at rest and in transit
- **Rotation**: Secrets can be rotated automatically
- **Audit**: All access to secrets is logged
- **Organization**: Related secrets are grouped together
- **Environment Separation**: Different environments have separate secrets

## Secret Organization

Secrets are organized into the following groups:

### 1. Database Secrets (`grammysnaps-dev-database-secrets`)

```json
{
  "host": "database-endpoint.amazonaws.com",
  "port": 5432,
  "database": "grammysnaps",
  "username": "grammysnaps_user",
  "password": "generated-secure-password",
  "database_url": "postgresql://user:pass@host:port/db"
}
```

### 2. JWT Secret (`grammysnaps-dev-jwt-secret`)

- Contains a randomly generated 64-character secret for JWT token signing

### 3. AWS Credentials (`grammysnaps-dev-aws-credentials`)

```json
{
  "access_key_id": "AKIA...",
  "secret_access_key": "secret-key",
  "region": "us-east-2",
  "s3_bucket_name": "grammysnaps-images-dev"
}
```

### 4. Application Configuration (`grammysnaps-dev-app-secrets`)

```json
{
  "cors_origins": "[\"https://grannysnaps.dev\",\"https://www.grannysnaps.dev\"]",
  "vite_api_url": "https://grannysnaps.dev/api",
  "vite_node_env": "production",
  "invite_key": "secure-32-character-key-for-invites",
  "smtp_host": "smtp.gmail.com",
  "smtp_port": 587,
  "smtp_user": "your-email@gmail.com",
  "smtp_password": "app-password"
}
```

## How It Works

### In Production (ECS)

1. ECS task definitions reference secrets by ARN
2. AWS automatically injects secrets as environment variables
3. Application code reads from standard environment variables
4. No secrets are stored in container images or configuration files

### In Development

1. Secrets are fetched from AWS Secrets Manager using the AWS SDK
2. A utility script can generate `.env.local` files from secrets
3. Fallback to local environment variables for offline development

## Usage

### 1. Managing Secrets (CLI)

Use the provided management script:

```bash
# List all secrets
./scripts/manage-secrets.sh list

# Get a specific secret
./scripts/manage-secrets.sh get database-secrets host

# Create local .env file from secrets
./scripts/manage-secrets.sh create-env

# Rotate JWT secret
./scripts/manage-secrets.sh rotate-jwt

# Update SMTP settings
./scripts/manage-secrets.sh update-smtp smtp.gmail.com 587 user@gmail.com password
```

### 2. In Node.js Application

```typescript
import { secretsManager } from "./utils/secrets-manager";

// Initialize all secrets at startup
const config = await secretsManager.initialize();

// Use specific secrets
const jwtSecret = await secretsManager.getJwtSecret();
const dbConfig = await secretsManager.getDatabaseConfig();

// Setup database connection
const pool = new Pool({
  connectionString: dbConfig.database_url,
});

// Setup JWT
const token = jwt.sign(payload, jwtSecret);
```

### 3. In React/Vite Frontend

```typescript
import { env } from "./utils/environment";

// Initialize environment configuration
env.logConfig(); // Only logs in development

// Get API URL for requests
const apiUrl = env.getApiUrl();
const loginEndpoint = env.getApiEndpoint("/auth/login");

// Environment checks
if (env.isProduction()) {
  // Production-only code
  console.log("Running in production mode");
}

// Make API calls with proper URL
fetch(env.getApiEndpoint("/api/users"))
  .then((response) => response.json())
  .then((data) => console.log(data));
```

### 3. Environment Variables in ECS

The following environment variables are automatically available in your ECS tasks:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:port/db
DB_HOST=database-endpoint.amazonaws.com
DB_PORT=5432
DB_NAME=grammysnaps
DB_USER=grammysnaps_user
DB_PASSWORD=secure-password

# JWT
JWT_SECRET=64-character-secret

# AWS
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=secret-key
S3_BUCKET_NAME=grammysnaps-images-dev

# Application
CORS_ORIGINS=["https://grannysnaps.dev"]
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=user@gmail.com
SMTP_PASSWORD=app-password

# Frontend (Vite)
VITE_API_URL=https://grannysnaps.dev/api
VITE_NODE_ENV=production

# Invite System
INVITE_KEY=secure-32-character-key-for-invites
```

## Security Best Practices

### 1. IAM Permissions

- ECS execution role has minimal permissions to read only required secrets
- Secrets are accessible only by the specific application

### 2. Encryption

- All secrets are encrypted using AWS KMS
- Encryption keys are managed by AWS

### 3. Rotation

- Database passwords can be rotated automatically
- JWT secrets should be rotated periodically
- API keys should be rotated when compromised

### 4. Audit

- All secret access is logged in CloudTrail
- Monitor for unauthorized access attempts

## Local Development Setup

### Option 1: Use AWS Secrets (Recommended)

1. Configure AWS CLI: `aws configure`
2. Generate local env file: `./scripts/manage-secrets.sh create-env`
3. Use the generated `.env.local` file

### Option 2: Manual Environment Variables

Create a `.env.local` file with required variables:

```bash
DATABASE_URL=postgresql://localhost:5432/grammysnaps_dev
JWT_SECRET=your-local-jwt-secret
AWS_REGION=us-east-2
# ... other variables
```

## Adding New Secrets

### 1. Update Terraform

Add new secrets to `aws-infrastructure/secrets.tf`:

```hcl
resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    # existing secrets...
    new_api_key = var.new_api_key
  })
}
```

### 2. Update Variables

Add to `aws-infrastructure/variables.tf`:

```hcl
variable "new_api_key" {
  description = "New API key for external service"
  type        = string
  sensitive   = true
}
```

### 3. Update ECS Task Definition

Add to the `secrets` section in `aws-infrastructure/ecs.tf`:

```hcl
{
  name      = "NEW_API_KEY"
  valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:new_api_key::"
}
```

### 4. Apply Changes

```bash
terraform plan
terraform apply
```

## Troubleshooting

### Common Issues

1. **Permission Denied**: Ensure your AWS credentials have `secretsmanager:GetSecretValue` permission
2. **Secret Not Found**: Check the secret name format: `{project}-{environment}-{secret-type}`
3. **JSON Parse Error**: Ensure secret values are valid JSON when storing complex data

### Debugging

```bash
# Check if secret exists
aws secretsmanager describe-secret --secret-id grammysnaps-dev-database-secrets

# Get secret value (be careful not to log this)
aws secretsmanager get-secret-value --secret-id grammysnaps-dev-database-secrets

# Check ECS task logs
aws logs describe-log-groups --log-group-name-prefix "/ecs/grammysnaps"
```

## Migration from Parameter Store

If you're migrating from AWS Systems Manager Parameter Store:

1. Export existing parameter values
2. Create corresponding secrets in Secrets Manager
3. Update ECS task definitions to use secrets instead of parameters
4. Deploy the updated infrastructure
5. Clean up old parameters

The new secrets system provides better organization and security compared to individual parameters.
