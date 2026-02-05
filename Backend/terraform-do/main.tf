terraform {
  required_providers {
    digitalocean = {
      source = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

variable "do_token" {}
variable "pvt_key" {}

provider "digitalocean" {
  token = var.do_token
}

resource "digitalocean_project" "liquidot" {
  name        = "liquidot-backend"
  description = "Liquidot Backend Infrastructure"
  purpose     = "Web Application"
  environment = "Production"
}

resource "digitalocean_droplet" "backend" {
  image  = "docker-20-04"
  name   = "liquidot-backend-droplet"
  region = "nyc1"
  size   = "s-1vcpu-1gb"
  ssh_keys = [
    data.digitalocean_ssh_key.terraform.id
  ]
  
  user_data = file("cloud-init.yaml")

  tags = ["liquidot", "backend"]
}

resource "digitalocean_project_resources" "droplet_association" {
  project = digitalocean_project.liquidot.id
  resources = [
    digitalocean_droplet.backend.urn
  ]
}

data "digitalocean_ssh_key" "terraform" {
  name = "Terraform"
}

output "ip_address" {
  value = digitalocean_droplet.backend.ipv4_address
}
