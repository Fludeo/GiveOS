# ==============================================================================
# Proyecto en Coolify
# ==============================================================================
resource "coolify_project" "giveos" {
  name        = var.project_name
  description = "Ecosistema GiveOS - Gastronomía, Recetas e Inventario (giveo.net)"
}

# ==============================================================================
# Aplicación Web GiveOS (SvelteKit 2 + Node Adapter + Dockerfile)
# ==============================================================================
resource "coolify_application" "web" {
  name           = "giveos-web"
  project_uuid   = coolify_project.giveos.uuid
  server_uuid    = var.server_uuid
  environment_name = var.environment_name

  git_repository = var.git_repository
  git_branch     = var.git_branch

  build_pack     = var.build_pack
  ports_exposes  = "3000"
  domains        = "https://${var.app_domain}"

  # Despliegue automático una vez aprovisionado
  instant_deploy = true
}
