output "project_uuid" {
  description = "UUID del proyecto GiveOS en Coolify"
  value       = coolify_project.giveos.uuid
}

output "application_uuid" {
  description = "UUID de la aplicación GiveOS en Coolify"
  value       = coolify_application.web.uuid
}

output "app_url" {
  description = "URL pública de acceso a la aplicación"
  value       = "https://${var.app_domain}"
}
