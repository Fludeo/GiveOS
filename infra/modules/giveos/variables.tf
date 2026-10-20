variable "project_uuid" {
  type        = string
  description = "UUID del proyecto GiveOS en Coolify"
}

variable "environment_name" {
  type        = string
  description = "Nombre del entorno en Coolify (staging / production)"
}

variable "server_uuid" {
  type        = string
  description = "UUID del servidor de Coolify donde se desplegará la aplicación"
}

variable "app_name" {
  type        = string
  description = "Nombre de la aplicación en Coolify"
  default     = "giveos-web"
}

variable "app_domain" {
  type        = string
  description = "Dominio o subdominio público asignado (ej. staging.giveo.net o giveo.net)"
}

variable "git_repository" {
  type        = string
  description = "Repositorio Git de la aplicación (formato Org/Repo)"
  default     = "Fludeo/GiveOS"
}

variable "github_app_uuid" {
  type        = string
  description = "UUID de la GitHub App para Fludeo en Coolify"
  default     = "y0ws0cww48swog8848kw8o4w"
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

variable "ports_exposes" {
  type        = string
  description = "Puertos expuestos del contenedor"
  default     = "3000"
}

variable "database_url" {
  type        = string
  description = "Cadena de conexión a PostgreSQL de la instancia compartida"
  sensitive   = true
}

variable "instant_deploy" {
  type        = bool
  description = "Disparar despliegue inmediato al aprovisionar"
  default     = true
}

variable "force_domain_override" {
  type        = bool
  description = "Forzar sobreescritura de dominio en caso de conflicto"
  default     = false
}
