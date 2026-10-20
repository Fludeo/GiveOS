module "production_app" {
  source = "../modules/giveos"

  project_uuid     = var.project_uuid
  environment_name = "production"
  server_uuid      = var.server_uuid

  app_name        = "giveos-production"
  app_domain      = var.app_domain
  git_repository  = var.git_repository
  git_branch      = var.git_branch
  github_app_uuid = var.github_app_uuid
  build_pack      = var.build_pack
  ports_exposes   = "3000"

  database_url          = "postgres://${var.shared_db_user}:${var.shared_db_password}@${var.shared_db_host}:5432/${var.shared_db_name}"
  instant_deploy        = true
  force_domain_override = var.force_domain_override
}
