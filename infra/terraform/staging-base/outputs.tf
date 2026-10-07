output "ecr_repository_url" {
  value       = aws_ecr_repository.web.repository_url
  description = "Immutable-tag ECR repository for staging images."
}

output "route53_name_servers" {
  value       = aws_route53_zone.staging.name_servers
  description = "Add these NS records in Namecheap to delegate fp-staging.tonimakes.com."
}

output "hosted_zone_id" {
  value       = aws_route53_zone.staging.zone_id
  description = "Pass to staging-runtime to create ALB alias records."
}

output "certificate_arn" {
  value       = aws_acm_certificate.staging.arn
  description = "ACM certificate ARN; wait for ISSUED status after DNS delegation before applying staging-runtime."
}

output "certificate_validation_records" {
  value = [for record in aws_route53_record.acm_validation : {
    name    = record.fqdn
    type    = record.type
    records = record.records
  }]
  description = "DNS validation records created in the delegated Route 53 zone."
}

output "runtime_secret_arns" {
  value       = { for name, secret in aws_secretsmanager_secret.runtime : name => secret.arn }
  description = "Secret containers to populate manually; no secret values are in Terraform state."
}

output "ecs_execution_role_arn" { value = aws_iam_role.ecs_execution.arn }
output "ecs_task_role_arn" { value = aws_iam_role.ecs_task.arn }
output "github_deploy_role_arn" {
  value       = var.enable_github_deployment ? aws_iam_role.github_deploy[0].arn : null
  description = "Null while GitHub OIDC deployment is disabled by the current AWS Free Plan organization policy."
}
