output "project_uuid" {
  description = "UUID del proyecto Producción en Coolify"
  value       = module.production_app.project_uuid
}

output "application_uuid" {
  description = "UUID de la aplicación Producción en Coolify"
  value       = module.production_app.application_uuid
}

output "production_url" {
  description = "URL pública de acceso a Producción"
  value       = module.production_app.app_url
}
