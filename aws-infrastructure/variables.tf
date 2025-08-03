variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-2"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "grammysnaps"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "grannysnaps.dev"
}

variable "api_cpu" {
  description = "CPU units for API service"
  type        = number
  default     = 512
}

variable "api_memory" {
  description = "Memory for API service"
  type        = number
  default     = 1024
}

variable "web_cpu" {
  description = "CPU units for web service"
  type        = number
  default     = 256
}

variable "web_memory" {
  description = "Memory for web service"
  type        = number
  default     = 512
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "RDS max allocated storage"
  type        = number
  default     = 100
}

variable "db_backup_retention_period" {
  description = "RDS backup retention period"
  type        = number
  default     = 7
}

variable "db_backup_window" {
  description = "RDS backup window"
  type        = string
  default     = "03:00-04:00"
}

variable "db_maintenance_window" {
  description = "RDS maintenance window"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

variable "github_repo" {
  description = "GitHub repository for CI/CD"
  type        = string
  default     = "focacci/grammysnaps"
}

variable "jwt_secret" {
  description = "JWT secret for API authentication"
  type        = string
  sensitive   = true
}

variable "aws_access_key_id" {
  description = "AWS access key ID for S3"
  type        = string
  sensitive   = true
}

variable "aws_secret_access_key" {
  description = "AWS secret access key for S3"
  type        = string
  sensitive   = true
}
