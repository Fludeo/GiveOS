variable "coolify_endpoint" {
  type        = string
  description = "URL base de la API de Coolify (ej. https://coolify.tudominio.com/api/v1)"
}

variable "coolify_token" {
  type        = string
  description = "Token de API Bearer de Coolify"
  sensitive   = true
}

variable "server_uuid" {
  type        = string
  description = "UUID del servidor de Coolify donde se desplegará Producción"
}

variable "app_domain" {
  type        = string
  description = "Dominio público de producción (ej. giveo.net)"
  default     = "giveo.net"
}

variable "git_repository" {
  type        = string
  description = "URL del repositorio Git"
  default     = "https://github.com/Fludeo/GiveOS.git"
}

variable "git_branch" {
  type        = string
  description = "Rama de producción a desplegar"
  default     = "main"
}

variable "build_pack" {
  type        = string
  description = "Buildpack a utilizar (dockerfile o nixpacks)"
  default     = "dockerfile"
}
