variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_username" {
  description = "Database username"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
  type        = string
}

variable "operator_private_key" {
  description = "Operator wallet private key"
  type        = string
  sensitive   = true
}

variable "asset_hub_vault_address" {
  description = "Asset Hub Vault contract address"
  type        = string
}

variable "xcm_proxy_address" {
  description = "XCM Proxy contract address"
  type        = string
}
