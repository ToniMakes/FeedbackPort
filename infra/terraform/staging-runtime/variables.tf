variable "aws_region" {
  type    = string
  default = "ap-southeast-2"
}

variable "domain_name" {
  type    = string
  default = "fp-staging.tonimakes.com"
}

variable "hosted_zone_id" {
  type        = string
  description = "Route 53 hosted zone ID output by staging-base."
}

variable "certificate_arn" {
  type        = string
  description = "Validated ACM certificate ARN output by staging-base."
}

variable "container_image" {
  type        = string
  description = "ECR image URI pinned to a commit tag or digest. Use a valid bootstrap image until CI/CD deploys the app."
  default     = "public.ecr.aws/docker/library/node:22-bookworm-slim"
}

variable "desired_count" {
  type        = number
  description = "Keep at zero until a built image is deployed; temporary layer is destroyed when idle."
  default     = 0
}

variable "task_cpu" {
  type    = number
  default = 256
}

variable "task_memory" {
  type    = number
  default = 512
}

variable "runtime_secret_arns" {
  type        = map(string)
  description = "Secret ARNs output by staging-base; values themselves never enter Terraform."
}

variable "ecs_execution_role_arn" {
  type        = string
  description = "Task execution role ARN output by staging-base."
}

variable "ecs_task_role_arn" {
  type        = string
  description = "Application task role ARN output by staging-base."
}

variable "default_tenant_slug" {
  type        = string
  description = "Optional local/fallback tenant slug; leave empty for host-based staging routing."
  default     = ""
}
