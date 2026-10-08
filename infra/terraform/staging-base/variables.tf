variable "aws_region" {
  type        = string
  description = "AWS region for the staging base resources."
  default     = "ap-southeast-2"
}

variable "domain_name" {
  type        = string
  description = "Delegated staging zone and apex hostname."
  default     = "fp-staging.tonimakes.com"
}

variable "github_repository" {
  type        = string
  description = "GitHub owner/repository allowed to deploy through the staging environment."
  default     = "ToniMakes/FeedbackPort"
}

variable "runtime_secret_names" {
  type        = set(string)
  description = "Runtime secret names. Terraform creates empty secret containers; the user adds values separately."
  default = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "TURNSTILE_SECRET_KEY",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  ]
}

variable "enable_github_deployment" {
  type        = bool
  description = "Create GitHub Actions OIDC provider and deploy role. AWS Free Plan organization policies may deny OIDC provider creation."
  default     = false
}

variable "budget_notification_email" {
  type        = string
  description = "Owner email for AWS Budget notifications. Set this in ignored terraform.tfvars; never commit personal contact details."
  default     = ""
}

variable "monthly_budget_usd" {
  type        = number
  description = "Monthly AWS Budget limit in USD. Alerts fire at 50%, 80% and 100% of actual spend and at 100% of forecast; this is monitoring, not a spending cap."
  default     = 5
}

