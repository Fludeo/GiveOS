# Infraestructura GiveOS con Terraform & Coolify 🚀

Estructura multi-entorno con Infraestructura como Código (IaC) para gestionar **Staging** y **Producción** de **GiveOS** ([giveo.net](https://giveo.net)) en [Coolify](https://coolify.io) a través del proveedor [coolify-terraform/coolify](https://registry.terraform.io/providers/coolify-terraform/coolify/latest).

---

## 📁 Estructura del Directorio `infra/`

```
infra/
├── modules/
│   └── giveos/              # Módulo reutilizable de aplicación en Coolify
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       └── versions.tf
├── staging/                 # Entorno de Staging (staging.giveo.net)
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── providers.tf
│   ├── versions.tf
│   └── terraform.tfvars.example
├── production/              # Entorno de Producción (giveo.net)
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── providers.tf
│   ├── versions.tf
│   └── terraform.tfvars.example
└── .gitignore               # Excluye .tfstate, .terraform y *.tfvars
```

---

## 🛠️ Despliegue de Staging (`staging.giveo.net`)

1. Navega al directorio de staging:
   ```bash
   cd infra/staging
   ```
2. Copia y completa tus variables:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```
3. Inicializa y aplica:
   ```bash
   terraform init
   terraform plan
   terraform apply
   ```

* **Dominio por defecto**: `https://staging.giveo.net`
* **Rama por defecto**: `staging`
* **Proyecto en Coolify**: `GiveOS-Staging`

---

## 🚀 Despliegue de Producción (`giveo.net`)

1. Navega al directorio de producción:
   ```bash
   cd infra/production
   ```
2. Copia y completa tus variables:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```
3. Inicializa y aplica:
   ```bash
   terraform init
   terraform plan
   terraform apply
   ```

* **Dominio por defecto**: `https://giveo.net`
* **Rama por defecto**: `main`
* **Proyecto en Coolify**: `GiveOS`
