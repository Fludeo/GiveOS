variable "project_name" {
  type        = string
  description = "Nombre del proyecto en Coolify"
}

variable "project_description" {
  type        = string
  description = "Descripción del proyecto"
  default     = "Ecosistema GiveOS (giveo.net)"
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

variable "ports_exposes" {
  type        = string
  description = "Puertos expuestos del contenedor"
  default     = "3000"
}

variable "instant_deploy" {
  type        = bool
  description = "Disparar despliegue inmediato al aprovisionar"
  default     = true
}
