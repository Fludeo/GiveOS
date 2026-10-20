resource "coolify_environment" "custom_env" {
  count        = var.environment_name != "production" ? 1 : 0
  project_uuid = var.project_uuid
  name         = var.environment_name
}

resource "random_password" "better_auth_secret" {
  length  = 36
  special = false
}

locals {
  domain_url = startswith(var.app_domain, "http") ? var.app_domain : "https://${var.app_domain}"
}

resource "coolify_application_github_app" "web" {
  name             = var.app_name
  project_uuid     = var.project_uuid
  server_uuid      = var.server_uuid
  environment_name = var.environment_name

  git_repository  = var.git_repository
  git_branch      = var.git_branch
  github_app_uuid = var.github_app_uuid

  build_pack     = var.build_pack
  ports_exposes  = var.ports_exposes
  domains        = local.domain_url

  health_check_enabled       = true
  health_check_path          = "/health-check"
  health_check_method        = "GET"
  health_check_return_code   = 200
  health_check_response_text = "OK"

  instant_deploy        = var.instant_deploy
  force_domain_override = var.force_domain_override

  depends_on = [coolify_environment.custom_env]
}

resource "coolify_envs_bulk" "envs" {
  resource_type = "application"
  resource_uuid = coolify_application_github_app.web.uuid
  variables = {
    NODE_ENV           = "production"
    PORT               = var.ports_exposes
    DATABASE_URL       = var.database_url
    BETTER_AUTH_SECRET = random_password.better_auth_secret.result
    ORIGIN             = local.domain_url
    BETTER_AUTH_URL    = local.domain_url
  }
}
