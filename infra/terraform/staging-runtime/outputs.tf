output "alb_dns_name" {
  value       = aws_lb.staging.dns_name
  description = "Public ALB DNS name behind the delegated staging hostnames."
}

output "alb_arn" { value = aws_lb.staging.arn }
output "ecs_cluster_name" { value = aws_ecs_cluster.staging.name }
output "ecs_service_name" { value = aws_ecs_service.web.name }
output "log_group_name" { value = aws_cloudwatch_log_group.web.name }
