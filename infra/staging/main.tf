module "staging_app" {
  source = "../modules/giveos"

  project_name        = "GiveOS-Staging"
  project_description = "Ambiente de Pruebas y Validación GiveOS (giveo.net)"
  environment_name    = "staging"
  app_name            = "giveos-staging"

  server_uuid    = var.server_uuid
  app_domain     = var.app_domain
  git_repository = var.git_repository
  git_branch     = var.git_branch
  build_pack     = var.build_pack
  ports_exposes  = "3000"
  instant_deploy = true
}
