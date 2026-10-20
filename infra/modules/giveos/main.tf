resource "coolify_project" "project" {
  name        = var.project_name
  description = var.project_description
}

resource "coolify_application" "web" {
  name             = var.app_name
  project_uuid     = coolify_project.project.uuid
  server_uuid      = var.server_uuid
  environment_name = var.environment_name

  git_repository   = var.git_repository
  git_branch       = var.git_branch

  build_pack       = var.build_pack
  ports_exposes    = var.ports_exposes
  domains          = "https://${var.app_domain}"

  instant_deploy   = var.instant_deploy
}
