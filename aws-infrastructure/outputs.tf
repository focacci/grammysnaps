output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "database_subnet_ids" {
  description = "IDs of the database subnets"
  value       = aws_subnet.database[*].id
}

output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

output "rds_port" {
  description = "RDS instance port"
  value       = aws_db_instance.main.port
}

output "alb_dns_name" {
  description = "DNS name of the load balancer"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the load balancer"
  value       = aws_lb.main.zone_id
}

# output "cloudfront_domain_name" {
#   description = "Domain name of the CloudFront distribution"
#   value       = aws_cloudfront_distribution.main.domain_name
# }

# output "cloudfront_hosted_zone_id" {
#   description = "Hosted zone ID of the CloudFront distribution"
#   value       = aws_cloudfront_distribution.main.hosted_zone_id
# }

output "s3_bucket_name" {
  description = "Name of the S3 bucket for images"
  value       = aws_s3_bucket.images.bucket
}

output "ecr_api_repository_url" {
  description = "URL of the API ECR repository"
  value       = aws_ecr_repository.api.repository_url
}

output "ecr_web_repository_url" {
  description = "URL of the web ECR repository"
  value       = aws_ecr_repository.web.repository_url
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "ecs_api_service_name" {
  description = "Name of the API ECS service"
  value       = aws_ecs_service.api.name
}

output "ecs_web_service_name" {
  description = "Name of the web ECS service"
  value       = aws_ecs_service.web.name
}

output "github_actions_role_arn" {
  description = "ARN of the GitHub Actions IAM role"
  value       = aws_iam_role.github_actions.arn
}

output "acm_certificate_arn" {
  description = "ARN of the ACM certificate"
  value       = aws_acm_certificate.main.arn
}

output "domain_validation_options" {
  description = "Domain validation options for ACM certificate"
  value       = aws_acm_certificate.main.domain_validation_options
}

output "nameservers_instructions" {
  description = "Instructions for setting up DNS"
  value = <<-EOT
    To complete the setup, you need to:
    
    1. For now, you can access the application directly via the load balancer:
       - Application: http://${aws_lb.main.dns_name}
       - API Health Check: http://${aws_lb.main.dns_name}/api/health
    
    2. To set up proper DNS and HTTPS later:
       - Uncomment the certificate validation and CloudFront resources in load-balancer.tf
       - Create DNS validation records for SSL certificates
       - Set up domain CNAME records pointing to the load balancer or CloudFront
    
    3. SSL Certificate validation records needed:
       ${join("\n       ", [for dvo in aws_acm_certificate.main.domain_validation_options : "${dvo.resource_record_name} CNAME ${dvo.resource_record_value}"])}
  EOT
}
