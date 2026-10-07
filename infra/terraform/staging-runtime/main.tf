data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_region" "current" {}

locals {
  public_subnet_cidrs = ["10.42.0.0/24", "10.42.1.0/24"]
  public_subnet_azs   = slice(data.aws_availability_zones.available.names, 0, 2)
}

resource "aws_vpc" "staging" {
  cidr_block           = "10.42.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
}

resource "aws_internet_gateway" "staging" {
  vpc_id = aws_vpc.staging.id
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.staging.id
  cidr_block              = local.public_subnet_cidrs[count.index]
  availability_zone       = local.public_subnet_azs[count.index]
  map_public_ip_on_launch = true
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.staging.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.staging.id
  }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "alb" {
  name        = "feedbackport-staging-alb"
  description = "Public HTTP and HTTPS for the staging ALB."
  vpc_id      = aws_vpc.staging.id

  ingress {
    description = "HTTP redirect to HTTPS"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTPS app traffic"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    description = "Forward application traffic on port 3000"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "app" {
  name        = "feedbackport-staging-app"
  description = "Only the ALB can reach the Next.js container."
  vpc_id      = aws_vpc.staging.id

  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    description = "HTTPS to managed external dependencies and AWS APIs"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb" "staging" {
  name               = "feedbackport-staging"
  internal           = false
  load_balancer_type = "application"
  subnets            = aws_subnet.public[*].id
  security_groups    = [aws_security_group.alb.id]
}

resource "aws_lb_target_group" "web" {
  name        = "fp-staging-web"
  port        = 3000
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.staging.id

  health_check {
    enabled             = true
    path                = "/api/health"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.staging.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.staging.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = var.certificate_arn
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

resource "aws_route53_record" "apex" {
  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "A"
  alias {
    name                   = aws_lb.staging.dns_name
    zone_id                = aws_lb.staging.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "boards" {
  zone_id = var.hosted_zone_id
  name    = "*.board.${var.domain_name}"
  type    = "A"
  alias {
    name                   = aws_lb.staging.dns_name
    zone_id                = aws_lb.staging.zone_id
    evaluate_target_health = true
  }
}

resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/feedbackport/staging/web"
  retention_in_days = 14
}

resource "aws_ecs_cluster" "staging" {
  name = "feedbackport-staging"
}

resource "aws_ecs_task_definition" "web" {
  family                   = "feedbackport-staging-web"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = var.ecs_execution_role_arn
  task_role_arn            = var.ecs_task_role_arn

  container_definitions = jsonencode([{
    name         = "web"
    image        = var.container_image
    essential    = true
    portMappings = [{ containerPort = 3000, hostPort = 3000, protocol = "tcp" }]
    environment  = var.default_tenant_slug == "" ? [] : [{ name = "DEFAULT_TENANT_SLUG", value = var.default_tenant_slug }]
    secrets = [
      { name = "SUPABASE_SERVICE_ROLE_KEY", valueFrom = var.runtime_secret_arns["SUPABASE_SERVICE_ROLE_KEY"] },
      { name = "TURNSTILE_SECRET_KEY", valueFrom = var.runtime_secret_arns["TURNSTILE_SECRET_KEY"] },
      { name = "UPSTASH_REDIS_REST_URL", valueFrom = var.runtime_secret_arns["UPSTASH_REDIS_REST_URL"] },
      { name = "UPSTASH_REDIS_REST_TOKEN", valueFrom = var.runtime_secret_arns["UPSTASH_REDIS_REST_TOKEN"] },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.web.name
        awslogs-region        = data.aws_region.current.name
        awslogs-stream-prefix = "web"
      }
    }
    healthCheck = {
      command     = ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 20
    }
  }])
}

resource "aws_ecs_service" "web" {
  name                   = "feedbackport-staging-web"
  cluster                = aws_ecs_cluster.staging.id
  task_definition        = aws_ecs_task_definition.web.arn
  desired_count          = var.desired_count
  launch_type            = "FARGATE"
  platform_version       = "LATEST"
  enable_execute_command = false

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.https]
}
