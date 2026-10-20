output "project_uuid" {
  description = "UUID del proyecto en Coolify"
  value       = coolify_project.project.uuid
}

output "application_uuid" {
  description = "UUID de la aplicación en Coolify"
  value       = coolify_application.web.uuid
}

output "app_url" {
  description = "URL pública de acceso"
  value       = "https://${var.app_domain}"
}
