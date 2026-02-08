terraform {
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

variable "do_token" {}
variable "github_repo" {
  default = "gabikreal1/LiquiDOT"
}
variable "github_branch" {
  default = "main"
}

# Environment variables (passed from GitHub Secrets via TF_VAR_)
variable "db_password" {
  sensitive = true
}
variable "algebra_subgraph_url" {}
variable "algebra_subgraph_api_key" {
  sensitive = true
}
variable "asset_hub_rpc_url" {}
variable "moonbeam_rpc_url" {}
variable "cors_origin" {
  default = "*"
}
variable "asset_hub_vault_address" {}
variable "xcm_proxy_address" {}
variable "moonbeam_xcm_proxy_address" {}
variable "relayer_private_key" {
  sensitive = true
}

provider "digitalocean" {
  token = var.do_token
}

# ------------------------------------------------------
# MANAGED POSTGRES DATABASE
# ------------------------------------------------------
resource "digitalocean_database_cluster" "postgres" {
  name       = "liquidot-db"
  engine     = "pg"
  version    = "15"
  size       = "db-s-1vcpu-1gb"
  region     = "nyc1"
  node_count = 1
}

resource "digitalocean_database_db" "liquidot" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = "liquidot"
}

resource "digitalocean_database_user" "liquidot" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = "liquidot"
}

# ------------------------------------------------------
# APP PLATFORM
# ------------------------------------------------------
resource "digitalocean_app" "backend" {
  spec {
    name   = "liquidot-backend"
    region = "nyc"

    service {
      name               = "backend"
      dockerfile_path    = "Backend/Dockerfile"
      source_dir         = "Backend"
      instance_size_slug = "basic-xxs"
      instance_count     = 1
      http_port          = 3001

      github {
        repo           = var.github_repo
        branch         = var.github_branch
        deploy_on_push = true
      }

      # Database connection
      env {
        key   = "DATABASE_HOST"
        value = digitalocean_database_cluster.postgres.host
        type  = "SECRET"
      }
      env {
        key   = "DATABASE_PORT"
        value = tostring(digitalocean_database_cluster.postgres.port)
      }
      env {
        key   = "DATABASE_USER"
        value = digitalocean_database_user.liquidot.name
      }
      env {
        key   = "DATABASE_PASSWORD"
        value = digitalocean_database_user.liquidot.password
        type  = "SECRET"
      }
      env {
        key   = "DATABASE_NAME"
        value = digitalocean_database_db.liquidot.name
      }
      env {
        key   = "DATABASE_SSL"
        value = "true"
      }

      # App Configuration
      env {
        key   = "NODE_ENV"
        value = "production"
      }
      env {
        key   = "PORT"
        value = "3001"
      }
      env {
        key   = "CORS_ORIGIN"
        value = var.cors_origin
      }

      # RPC & API
      env {
        key   = "ASSET_HUB_RPC_URL"
        value = var.asset_hub_rpc_url
      }
      env {
        key   = "MOONBEAM_RPC_URL"
        value = var.moonbeam_rpc_url
      }
      env {
        key   = "ALGEBRA_SUBGRAPH_URL"
        value = var.algebra_subgraph_url
      }
      env {
        key   = "ALGEBRA_SUBGRAPH_API_KEY"
        value = var.algebra_subgraph_api_key
        type  = "SECRET"
      }

      # Contract Addresses
      env {
        key   = "ASSET_HUB_VAULT_ADDRESS"
        value = var.asset_hub_vault_address
      }
      env {
        key   = "XCM_PROXY_ADDRESS"
        value = var.xcm_proxy_address
      }
      env {
        key   = "MOONBEAM_XCM_PROXY_ADDRESS"
        value = var.moonbeam_xcm_proxy_address
      }

      # Keys
      env {
        key   = "RELAYER_PRIVATE_KEY"
        value = var.relayer_private_key
        type  = "SECRET"
      }

      # Health check
      health_check {
        http_path = "/api/health"
      }
    }
  }
}

# ------------------------------------------------------
# PROJECT
# ------------------------------------------------------
resource "digitalocean_project" "liquidot" {
  name        = "liquidot-backend"
  description = "Liquidot Backend Infrastructure"
  purpose     = "Web Application"
  environment = "Production"
}

resource "digitalocean_project_resources" "app_association" {
  project = digitalocean_project.liquidot.id
  resources = [
    digitalocean_app.backend.urn,
    digitalocean_database_cluster.postgres.urn
  ]
}

# ------------------------------------------------------
# OUTPUTS
# ------------------------------------------------------
output "app_url" {
  value       = digitalocean_app.backend.live_url
  description = "The live URL of the deployed application"
}

output "database_host" {
  value       = digitalocean_database_cluster.postgres.host
  description = "Database host"
  sensitive   = true
}

output "database_port" {
  value       = digitalocean_database_cluster.postgres.port
  description = "Database port"
}
