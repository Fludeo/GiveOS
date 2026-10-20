variable "coolify_endpoint" {
  type        = string
  description = "URL base de la API de Coolify (ej. https://coolify.fludeo.dev)"
  default     = "https://coolify.fludeo.dev"
}

variable "coolify_token" {
  type        = string
  description = "Token de API Bearer de Coolify"
  sensitive   = true
}

variable "project_uuid" {
  type        = string
  description = "UUID del proyecto GiveOS en Coolify"
  default     = "9uhbzx40dcbouy0duislxnm9"
}

variable "server_uuid" {
  type        = string
  description = "UUID del servidor de Coolify donde se desplegará Producción"
  default     = "ico40sgwswocc8sccwkc804o"
}

variable "github_app_uuid" {
  type        = string
  description = "UUID de la GitHub App para Fludeo"
  default     = "y0ws0cww48swog8848kw8o4w"
}

variable "app_domain" {
  type        = string
  description = "Dominio público de producción (ej. giveo.net)"
  default     = "giveo.net"
}

variable "git_repository" {
  type        = string
  description = "Repositorio Git (formato Org/Repo)"
  default     = "Fludeo/GiveOS"
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

variable "force_domain_override" {
  type        = bool
  description = "Forzar la asignación del dominio si ya está en uso"
  default     = true
}

variable "shared_db_host" {
  type        = string
  description = "Host interno de la DB Postgres compartida de producción"
  default     = "i8cc4cwow8o8gw0cgwowgc8o"
}

variable "shared_db_user" {
  type        = string
  description = "Usuario de la DB Postgres"
  default     = "postgres"
}

variable "shared_db_password" {
  type        = string
  description = "Contraseña de la DB Postgres compartida de producción"
  sensitive   = true
  default     = "QtwvaMipCBrp8qxKB3ZRIhxh61TAuI69KV7pN2qJEKURsfNqckkobWmqVzWA9GcV"
}

variable "shared_db_name" {
  type        = string
  description = "Nombre de la base de datos dentro de la instancia compartida"
  default     = "giveos_prod"
}
