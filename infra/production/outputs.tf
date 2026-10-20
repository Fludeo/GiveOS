output "application_uuid" {
  description = "UUID de la aplicación de producción en Coolify"
  value       = module.production_app.application_uuid
}

output "production_url" {
  description = "URL asignada a Producción"
  value       = module.production_app.application_url
}
