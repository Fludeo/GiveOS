# Infraestructura GiveOS con Terraform & Coolify 🚀

Este directorio contiene la definición de Infraestructura como Código (IaC) para aprovisionar y desplegar **GiveOS** en un servidor gestionado por [Coolify](https://coolify.io) utilizando el proveedor oficial de la comunidad: **[coolify-terraform/coolify](https://registry.terraform.io/providers/coolify-terraform/coolify/latest)**.

---

## 📋 Requisitos Previos

1. **Terraform** v1.5.0 o superior instalado.
2. Instancia de **Coolify v4** activa (en la nube o self-hosted en tu VPS).
3. **API Token de Coolify**:
   - Ingresa a tu panel de Coolify -> **Keys & Tokens** -> **API Tokens**.
   - Crea un token con permisos de lectura y escritura.
4. **Server UUID**:
   - En Coolify, ve a **Servers** y selecciona tu servidor de despliegue.
   - Copia el UUID que figura en la URL o configuración del servidor.

---

## 🛠️ Configuración Rápida

### 1. Crear archivo de variables locales

Copia el archivo de ejemplo:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Completa con tus credenciales y configuración en `terraform.tfvars`:

```hcl
coolify_endpoint = "https://coolify.tudominio.com/api/v1"
coolify_token    = "1|abcdef1234567890..."
server_uuid      = "abcdef12-3456-7890-abcd-ef1234567890"
app_domain       = "giveo.net"
git_repository   = "https://github.com/Fludeo/GiveOS.git"
git_branch       = "main"
build_pack       = "dockerfile"
```

> **Nota:** También puedes configurar las credenciales mediante variables de entorno en lugar del archivo:
> ```bash
> export COOLIFY_ENDPOINT="https://coolify.tudominio.com/api/v1"
> export COOLIFY_TOKEN="tu-token"
> ```

---

## 🚀 Despliegue con Terraform

### 1. Inicializar el proveedor

Descarga el proveedor `coolify-terraform/coolify` desde el Terraform Registry:

```bash
terraform init
```

### 2. Previsualizar los cambios

```bash
terraform plan
```

### 3. Aplicar y desplegar

```bash
terraform apply
```

Terraform creará el proyecto `GiveOS` y la aplicación vinculada a `https://github.com/Fludeo/GiveOS.git`, asignará el dominio `giveo.net` con certificados SSL automáticos y disparará el primer despliegue con Docker.

---

## 📦 Estructura de Archivos

- **`versions.tf`**: Declaración del proveedor `coolify-terraform/coolify` y versión de Terraform.
- **`providers.tf`**: Configuración del endpoint y token de acceso a la API de Coolify.
- **`variables.tf`**: Variables parametrizables (dominio, repositorio, tokens, servidor).
- **`main.tf`**: Definición de los recursos (`coolify_project` y `coolify_application`).
- **`outputs.tf`**: Salidas informativas (UUID de la app, URL de acceso).
- **`terraform.tfvars.example`**: Plantilla de valores lista para copiar.
