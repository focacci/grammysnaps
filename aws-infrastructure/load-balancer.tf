# ACM Certificate for SSL
resource "aws_acm_certificate" "main" {
  domain_name               = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.project_name}-cert"
  }
}

# Certificate validation (will wait for DNS records to be added)
# Commented out for initial deployment - enable after DNS is configured
# resource "aws_acm_certificate_validation" "main" {
#   certificate_arn = aws_acm_certificate.main.arn
#   # Note: DNS validation records must be added manually to your domain
#   # Use terraform output domain_validation_options to see required records
#   
#   timeouts {
#     create = "10m"
#   }
# }

# ACM Certificate for CloudFront (must be in us-east-1)
resource "aws_acm_certificate" "cloudfront" {
  provider                  = aws.us_east_1
  domain_name               = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.project_name}-cloudfront-cert"
  }
}

# Certificate validation for CloudFront certificate
# Commented out for initial deployment - enable after DNS is configured
# resource "aws_acm_certificate_validation" "cloudfront" {
#   provider        = aws.us_east_1
#   certificate_arn = aws_acm_certificate.cloudfront.arn
#   
#   timeouts {
#     create = "10m"
#   }
# }

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = var.environment == "production" ? true : false

  tags = {
    Name = "${var.project_name}-alb"
  }
}

# Target Groups
resource "aws_lb_target_group" "api" {
  name        = "${var.project_name}-api-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/api/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = {
    Name = "${var.project_name}-api-tg"
  }
}

resource "aws_lb_target_group" "web" {
  name        = "${var.project_name}-web-tg"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = {
    Name = "${var.project_name}-web-tg"
  }
}

# ALB Listeners
resource "aws_lb_listener" "web_http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

# HTTPS listener for web traffic
# Commented out for initial deployment - enable after DNS is configured
# resource "aws_lb_listener" "web_https" {
#   load_balancer_arn = aws_lb.main.arn
#   port              = "443"
#   protocol          = "HTTPS"
#   ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
#   certificate_arn   = aws_acm_certificate.main.arn
# 
#   default_action {
#     type             = "forward"
#     target_group_arn = aws_lb_target_group.web.arn
#   }
# }

# API routing rule for HTTP listener
resource "aws_lb_listener_rule" "api_http" {
  listener_arn = aws_lb_listener.web_http.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}

# API routing rule for HTTPS listener
# Commented out for initial deployment - enable after DNS is configured
# resource "aws_lb_listener_rule" "api" {
#   listener_arn = aws_lb_listener.web_https.arn
#   priority     = 100
# 
#   action {
#     type             = "forward"
#     target_group_arn = aws_lb_target_group.api.arn
#   }
# 
#   condition {
#     path_pattern {
#       values = ["/api/*"]
#     }
#   }
# }

# CloudFront Distribution for static assets and caching
# Commented out for initial deployment - enable after DNS is configured
# resource "aws_cloudfront_distribution" "main" {
#   origin {
#     domain_name = aws_lb.main.dns_name
#     origin_id   = "ALB-${var.project_name}"
# 
#     custom_origin_config {
#       http_port              = 80
#       https_port             = 443
#       origin_protocol_policy = "https-only"
#       origin_ssl_protocols   = ["TLSv1.2"]
#     }
#   }
# 
#   enabled             = true
#   is_ipv6_enabled     = true
#   comment             = "${var.project_name} CloudFront Distribution"
#   default_root_object = "index.html"
# 
#   aliases = [var.domain_name, "www.${var.domain_name}"]
# 
#   default_cache_behavior {
#     allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
#     cached_methods         = ["GET", "HEAD"]
#     target_origin_id       = "ALB-${var.project_name}"
#     compress               = true
#     viewer_protocol_policy = "redirect-to-https"
# 
#     forwarded_values {
#       query_string = true
#       headers      = ["Host", "Authorization", "Content-Type"]
# 
#       cookies {
#         forward = "all"
#       }
#     }
# 
#     min_ttl     = 0
#     default_ttl = 3600
#     max_ttl     = 86400
#   }
# 
#   # Cache behavior for API routes
#   ordered_cache_behavior {
#     path_pattern           = "/api/*"
#     allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
#     cached_methods         = ["GET", "HEAD"]
#     target_origin_id       = "ALB-${var.project_name}"
#     compress               = true
#     viewer_protocol_policy = "redirect-to-https"
# 
#     forwarded_values {
#       query_string = true
#       headers      = ["*"]
# 
#       cookies {
#         forward = "all"
#       }
#     }
# 
#     min_ttl     = 0
#     default_ttl = 0
#     max_ttl     = 0
#   }
# 
#   # Cache behavior for static assets
#   ordered_cache_behavior {
#     path_pattern           = "/assets/*"
#     allowed_methods        = ["GET", "HEAD"]
#     cached_methods         = ["GET", "HEAD"]
#     target_origin_id       = "ALB-${var.project_name}"
#     compress               = true
#     viewer_protocol_policy = "redirect-to-https"
# 
#     forwarded_values {
#       query_string = false
# 
#       cookies {
#         forward = "none"
#       }
#     }
# 
#     min_ttl     = 86400
#     default_ttl = 86400
#     max_ttl     = 31536000
#   }
# 
#   price_class = "PriceClass_100"
# 
#   restrictions {
#     geo_restriction {
#       restriction_type = "none"
#     }
#   }
# 
#   viewer_certificate {
#     acm_certificate_arn      = aws_acm_certificate.cloudfront.arn
#     ssl_support_method       = "sni-only"
#     minimum_protocol_version = "TLSv1.2_2021"
#   }
# 
#   tags = {
#     Name = "${var.project_name}-cloudfront"
#   }
# }
