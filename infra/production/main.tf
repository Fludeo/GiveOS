module "production_app" {
  source = "../modules/giveos"

  project_name        = "GiveOS"
  project_description = "Ecosistema GiveOS Producción (giveo.net)"
  environment_name    = "production"
  app_name            = "giveos-production"

  server_uuid    = var.server_uuid
  app_domain     = var.app_domain
  git_repository = var.git_repository
  git_branch     = var.git_branch
  build_pack     = var.build_pack
  ports_exposes  = "3000"
  instant_deploy = true
}
