output "state_bucket_name" {
  value       = aws_s3_bucket.terraform_state.id
  description = "Use this bucket in backend.hcl for subsequent Terraform stacks."
}

output "state_region" {
  value       = var.aws_region
  description = "Region of the Terraform state bucket."
}
