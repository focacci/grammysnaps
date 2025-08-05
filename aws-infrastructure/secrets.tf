# AWS Secrets Manager for sensitive environment variables
# This provides better security and organization than Parameter Store for secrets

# Main application secrets
resource "aws_secretsmanager_secret" "app_secrets" {
  name        = "${var.project_name}-${var.environment}-app-secrets"
  description = "Application secrets for ${var.project_name} ${var.environment} environment"

  tags = {
    Name        = "${var.project_name}-app-secrets"
    Environment = var.environment
  }
}

# JWT Secret
resource "aws_secretsmanager_secret" "jwt_secret" {
  name        = "${var.project_name}-${var.environment}-jwt-secret"
  description = "JWT signing secret for ${var.project_name}"

  tags = {
    Name        = "${var.project_name}-jwt-secret"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = var.jwt_secret
}

# JWT Refresh Secret
resource "aws_secretsmanager_secret" "jwt_refresh_secret" {
  name        = "${var.project_name}-${var.environment}-jwt-refresh-secret"
  description = "JWT refresh token signing secret for ${var.project_name}"

  tags = {
    Name        = "${var.project_name}-jwt-refresh-secret"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "jwt_refresh_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_refresh_secret.id
  secret_string = var.jwt_refresh_secret
}

# Database secrets (consolidated)
resource "aws_secretsmanager_secret" "database_secrets" {
  name        = "${var.project_name}-${var.environment}-database-secrets"
  description = "Database connection secrets for ${var.project_name}"

  tags = {
    Name        = "${var.project_name}-database-secrets"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "database_secrets" {
  secret_id = aws_secretsmanager_secret.database_secrets.id
  secret_string = jsonencode({
    host     = split(":", aws_db_instance.main.endpoint)[0]
    port     = aws_db_instance.main.port
    database = aws_db_instance.main.db_name
    dbname   = aws_db_instance.main.db_name  # Add dbname field for migration script compatibility
    username = aws_db_instance.main.username
    password = random_password.db_password.result
    # Construct the full DATABASE_URL for easier use
    database_url = "postgresql://${aws_db_instance.main.username}:${random_password.db_password.result}@${split(":", aws_db_instance.main.endpoint)[0]}:${aws_db_instance.main.port}/${aws_db_instance.main.db_name}"
  })
}

# AWS credentials for S3 access
resource "aws_secretsmanager_secret" "aws_credentials" {
  name        = "${var.project_name}-${var.environment}-aws-credentials"
  description = "AWS credentials for S3 access"

  tags = {
    Name        = "${var.project_name}-aws-credentials"
    Environment = var.environment
  }
}

# Note: In production, you should use IAM roles instead of access keys
# This is kept for backward compatibility
resource "aws_secretsmanager_secret_version" "aws_credentials" {
  secret_id = aws_secretsmanager_secret.aws_credentials.id
  secret_string = jsonencode({
    access_key_id     = var.aws_access_key_id
    secret_access_key = var.aws_secret_access_key
    region           = var.aws_region
    s3_bucket_name   = aws_s3_bucket.images.bucket
  })
}

# Application configuration secrets
resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    # API Configuration
    cors_origins = jsonencode([
      "https://${var.domain_name}",
      "https://www.${var.domain_name}",
      "http://localhost:3000",
      "http://localhost:5173"
    ])
    
    # Frontend Configuration
    vite_api_url = "https://${var.domain_name}/api"
    vite_node_env = var.environment
    
    # Invite system
    invite_key = var.invite_key != "" ? var.invite_key : random_password.invite_key.result
    
    # Email/SMTP settings (add your own)
    smtp_host     = var.smtp_host
    smtp_port     = var.smtp_port
    smtp_user     = var.smtp_user
    smtp_password = var.smtp_password
    
    # External API keys (add as needed)
    # google_client_id     = var.google_client_id
    # google_client_secret = var.google_client_secret
    # stripe_secret_key    = var.stripe_secret_key
  })
}

# IAM policy for ECS tasks to access Secrets Manager
resource "aws_iam_role_policy" "ecs_secrets_access" {
  name = "${var.project_name}-ecs-secrets-access"
  role = aws_iam_role.ecs_task_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          aws_secretsmanager_secret.app_secrets.arn,
          aws_secretsmanager_secret.jwt_secret.arn,
          aws_secretsmanager_secret.jwt_refresh_secret.arn,
          aws_secretsmanager_secret.database_secrets.arn,
          aws_secretsmanager_secret.aws_credentials.arn
        ]
      }
    ]
  })
}

# Output the secret ARNs for use in ECS task definitions
output "secrets_arns" {
  description = "ARNs of the secrets for use in ECS task definitions"
  value = {
    app_secrets        = aws_secretsmanager_secret.app_secrets.arn
    jwt_secret         = aws_secretsmanager_secret.jwt_secret.arn
    jwt_refresh_secret = aws_secretsmanager_secret.jwt_refresh_secret.arn
    database_secrets   = aws_secretsmanager_secret.database_secrets.arn
    aws_credentials    = aws_secretsmanager_secret.aws_credentials.arn
  }
  sensitive = true
}
