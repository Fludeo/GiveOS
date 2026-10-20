variable "coolify_endpoint" {
  type        = string
  description = "URL base de la API de Coolify (ej. https://app.coolify.io/api/v1 o https://coolify.tu-dominio.com/api/v1)"
}

variable "coolify_token" {
  type        = string
  description = "Token de API Bearer generado en Coolify (Keys & Tokens)"
  sensitive   = true
}

variable "server_uuid" {
  type        = string
  description = "UUID del servidor de Coolify donde se desplegará la aplicación"
}

variable "environment_name" {
  type        = string
  description = "Nombre del entorno en Coolify (ej. production, staging)"
  default     = "production"
}

variable "project_name" {
  type        = string
  description = "Nombre del proyecto en Coolify"
  default     = "GiveOS"
}

variable "app_domain" {
  type        = string
  description = "Dominio público para GiveOS (ej. giveo.net o app.giveo.net)"
  default     = "giveo.net"
}

variable "git_repository" {
  type        = string
  description = "URL del repositorio Git de la aplicación"
  default     = "https://github.com/Fludeo/GiveOS.git"
}

variable "git_branch" {
  type        = string
  description = "Rama a desplegar"
  default     = "main"
}

variable "build_pack" {
  type        = string
  description = "Buildpack a utilizar (dockerfile o nixpacks)"
  default     = "dockerfile"
}

variable "better_auth_secret" {
  type        = string
  description = "Secreto aleatorio para Better-Auth en producción"
  sensitive   = true
  default     = ""
}

variable "database_url" {
  type        = string
  description = "URL de conexión a la base de datos (Turso libSQL o SQLite persistente)"
  sensitive   = true
  default     = "file:/app/data/local.db"
}
