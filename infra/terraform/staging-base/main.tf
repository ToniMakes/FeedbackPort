data "aws_caller_identity" "current" {}

resource "aws_ecr_repository" "web" {
  name                 = "feedbackport-web-staging"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_ecr_lifecycle_policy" "web" {
  repository = aws_ecr_repository.web.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the latest 20 pushed images for rollback"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 20
      }
      action = { type = "expire" }
    }]
  })
}

resource "aws_route53_zone" "staging" {
  name = var.domain_name
}

resource "aws_acm_certificate" "staging" {
  domain_name               = var.domain_name
  subject_alternative_names = ["*.board.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle { create_before_destroy = true }
}

resource "aws_route53_record" "acm_validation" {
  for_each = toset([var.domain_name, "*.board.${var.domain_name}"])

  name = one([
    for dvo in aws_acm_certificate.staging.domain_validation_options : dvo.resource_record_name
    if dvo.domain_name == each.key
  ])
  allow_overwrite = true
  records = [one([
    for dvo in aws_acm_certificate.staging.domain_validation_options : dvo.resource_record_value
    if dvo.domain_name == each.key
  ])]
  ttl = 60
  type = one([
    for dvo in aws_acm_certificate.staging.domain_validation_options : dvo.resource_record_type
    if dvo.domain_name == each.key
  ])
  zone_id = aws_route53_zone.staging.zone_id
}

resource "aws_secretsmanager_secret" "runtime" {
  for_each                = var.runtime_secret_names
  name                    = "feedbackport/staging/${each.value}"
  description             = "Runtime secret for FeedbackPort staging. Value managed outside Terraform."
  recovery_window_in_days = 7
}

resource "aws_iam_role" "ecs_execution" {
  name = "feedbackport-staging-ecs-execution"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "ecs_execution_base" {
  name = "pull-staging-image-and-write-staging-logs"
  role = aws_iam_role.ecs_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage"]
        Resource = aws_ecr_repository.web.arn
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/ecs/feedbackport/staging/web:log-stream:*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "read-feedbackport-staging-runtime-secrets"
  role = aws_iam_role.ecs_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [for secret in aws_secretsmanager_secret.runtime : secret.arn]
    }]
  })
}

resource "aws_iam_role" "ecs_task" {
  name = "feedbackport-staging-ecs-task"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_openid_connect_provider" "github" {
  count          = var.enable_github_deployment ? 1 : 0
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

resource "aws_iam_role" "github_deploy" {
  count = var.enable_github_deployment ? 1 : 0
  name  = "feedbackport-staging-github-deploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github[0].arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:environment:staging"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_ecr_push" {
  count = var.enable_github_deployment ? 1 : 0
  name  = "push-staging-web-image"
  role  = aws_iam_role.github_deploy[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:CompleteLayerUpload",
          "ecr:InitiateLayerUpload",
          "ecr:PutImage",
          "ecr:UploadLayerPart",
        ]
        Resource = aws_ecr_repository.web.arn
      }
    ]
  })
}

resource "aws_budgets_budget" "monthly" {
  provider     = aws.billing
  count        = var.budget_notification_email == "" ? 0 : 1
  name         = "feedbackport-monthly-30-usd"
  budget_type  = "COST"
  limit_amount = "30"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 50
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_notification_email]
  }
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_notification_email]
  }
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_notification_email]
  }
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.budget_notification_email]
  }
}
