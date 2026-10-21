# GiveOS 🍰
> Sistema Integral de Gestión Gastronómica, Recetas Multinivel, Inventario JIT y Órdenes Híbridas.  
> Marca: **Giveo** • Sitio web: [giveo.net](https://giveo.net)

---

## 🌟 Características Principales

### 1. 📊 Dashboard Analítico & Previsión de Demanda
- **Catálogo Interactivo**: Visualización de productos comerciales (simples y combos) con sus ítems asociados.
- **Gráficos de Barras Comparativos (shadcn/ui)**: Comparación en tiempo real entre demanda de pedidos e insumos disponibles en depósito.
- **Stock de Producto Terminado**: Alerta sobre capacidad de despacho inmediato en mostrador vs. necesidad de elaboración.
- **Ajuste Rápido de Stock**: Modificación directa de inventario desde el dashboard.

### 2. 🧾 Órdenes de Compra Híbridas
- **Flujo Mixto**: Combina despacho inmediato en mostrador con encargos programados en una misma comanda.
- **Cobro Obligatorio de Inmediato**: Lo inmediato se cobra 100% por adelantado; la seña calcula el porcentaje sobre el encargo pendiente.
- **Slider Dinámico de Señas**: Control deslizante con saltos de $100 y progreso visual en tiempo real.
- **Entrega Just-in-Time (JIT)**: Al completar una orden, el sistema descuenta automáticamente los insumos y materias primas correspondientes mediante su árbol de recetas.

### 3. 🧪 Recetas Multinivel & Escandallo de Costos
- **Modelo Simplificado de Inventario**: Insumos (`raw_material`) y Elaboraciones (`prepared`), permitiendo anidar recetas a cualquier nivel y vender tanto insumos directos como productos elaborados o combos.
- **Cálculo Automático de Costos**: Actualización de costos en cascada ante variaciones de precios de materias primas.
- **Unidades y Conversiones**: Soporte para gramos, kilogramos, mililitros, litros y unidades.

### 4. 🏢 Multi-Negocio & Autenticación
- **Multi-Tenant**: Soporte para múltiples negocios/sucursales por usuario con roles (`owner`, `admin`, `member`).
- **Better-Auth**: Autenticación moderna, segura y basada en sesiones SQLite/libsql.

---

## 🛠️ Stack Tecnológico

- **Framework**: [SvelteKit 2](https://kit.svelte.dev/) con **Svelte 5** (Runes: `$state`, `$derived`, `$effect`)
- **Estilos & UI**: [Tailwind CSS v4](https://tailwindcss.com/) & componentes basados en [shadcn-svelte](https://shadcn-svelte.com/)
- **Base de Datos & ORM**: [libSQL / SQLite](https://github.com/tursodatabase/libsql) con [Drizzle ORM](https://orm.drizzle.team/)
- **Autenticación**: [Better-Auth](https://better-auth.com/)
- **Iconografía**: [Lucide Icons](https://lucide.dev/)

---

## 🚀 Puesta en Marcha (Desarrollo Local)

### 1. Clonar e Instalar Dependencias

```bash
git clone https://github.com/TU_USUARIO/giveos.git
cd giveos
npm install
```

### 2. Variables de Entorno

Copia el archivo de ejemplo:

```bash
cp .env.example .env
```

Configura tus variables en `.env`:
```env
BETTER_AUTH_SECRET="tu-secreto-seguro"
BETTER_AUTH_URL="http://localhost:5173"
TURSO_DATABASE_URL="file:local.db"
```

### 3. Base de Datos

Aplica las migraciones con Drizzle:

```bash
npm run db:push
```

### 4. Iniciar Servidor de Desarrollo

```bash
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173) en tu navegador.

---

## 📦 Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo Vite.
- `npm run build`: Genera el build optimizado para producción.
- `npm run preview`: Previsualiza el build de producción localmente.
- `npm run check`: Ejecuta el análisis de tipos y diagnóstico con `svelte-check`.
- `npm run db:push`: Sincroniza el esquema Drizzle con la base de datos.
- `npm run db:studio`: Abre la interfaz visual de Drizzle Studio.

---

## 📄 Licencia

Desarrollado para el ecosistema **Giveo** ([giveo.net](https://giveo.net)).
