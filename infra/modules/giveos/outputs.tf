output "application_uuid" {
  description = "UUID de la aplicación en Coolify"
  value       = coolify_application.web.uuid
}

output "application_url" {
  description = "URL asignada a la aplicación"
  value       = local.domain_url
}
