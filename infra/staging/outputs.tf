output "application_uuid" {
  description = "UUID de la aplicación staging en Coolify"
  value       = module.staging_app.application_uuid
}

output "staging_url" {
  description = "URL asignada al entorno de Staging"
  value       = module.staging_app.application_url
}
