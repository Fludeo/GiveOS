terraform {
  required_version = ">= 1.5.0"
  required_providers {
    coolify = {
      source  = "coolify-terraform/coolify"
      version = "~> 0.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}
