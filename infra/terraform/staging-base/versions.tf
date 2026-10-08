terraform {
  required_version = ">= 1.10.0, < 2.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {}
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "feedbackport"
      Environment = "staging"
      ManagedBy   = "terraform"
      Layer       = "base"
    }
  }
}

# AWS Budgets is managed through its us-east-1 service endpoint; workload resources remain in Sydney.
provider "aws" {
  alias  = "billing"
  region = "us-east-1"
}
