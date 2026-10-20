output "project_uuid" {
  description = "UUID del proyecto Staging en Coolify"
  value       = module.staging_app.project_uuid
}

output "application_uuid" {
  description = "UUID de la aplicación Staging en Coolify"
  value       = module.staging_app.application_uuid
}

output "staging_url" {
  description = "URL pública de acceso a Staging"
  value       = module.staging_app.app_url
}
