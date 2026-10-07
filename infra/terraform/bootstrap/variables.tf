variable "aws_region" {
  description = "AWS region where the Terraform state bucket is created."
  type        = string
  default     = "ap-southeast-2"
}

variable "state_bucket_name" {
  description = "Globally unique S3 bucket name for Terraform state."
  type        = string
}
