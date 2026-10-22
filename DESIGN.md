# Sistema de Diseño y Guía de Arquitectura de UI — GiveOS (Cakes)

Documento normativo de arquitectura de interfaz de usuario y patrones de diseño para el proyecto **GiveOS / Cakes**. Este documento detalla la abstracción del sistema basada en el estándar **shadcn-svelte** adaptado a **Svelte 5** y **Tailwind CSS v4**, permitiendo cambios globales de tema o marca sin alterar la lógica de los componentes ni de las vistas.

---

## 1. Filosofía de Abstracción y Arquitectura shadcn

- **Patrón shadcn (Component Ownership):** El proyecto sigue el paradigma de diseño de **shadcn / shadcn-svelte**, donde los componentes de UI no se instalan como una librería de dependencias de caja negra, sino que residen directamente en el código fuente (`src/lib/components/ui/`), dándonos control total sobre la estructura, accesibilidad y personalización.
- **Configuración (`components.json`):** Los alias, convenciones y rutas del sistema respetan la especificación oficial de shadcn:
  - Componentes UI: `#lib/components/ui`
  - Utilidades: `#lib/utils`
  - Estilos base: `src/routes/layout.css`
- **Skill de Shadcn Instalado en el Repositorio:** El proyecto cuenta con un skill especializado de **shadcn** ubicado en [`.agents/skills/shadcn/`](file:///c:/Users/noah1/OneDrive/Documentos/GitHub/cakes/.agents/skills/shadcn/). Este skill asiste tanto a los desarrolladores como a los agentes de IA en:
  - Búsqueda, instalación y composición de nuevos componentes siguiendo la arquitectura existente.
  - Reglas de composición, formularios, iconografía y adaptación entre Radix y Base UI.
  - Generación de estados, matrices de diseño y consistencia con las guías de estilo oficiales.
- **Desacoplamiento Absoluto de Colores:** Ningún componente ni vista utiliza colores fijos o nombres de paletas físicas (prohibido `bg-[#...]` o clases fijas como `text-blue-600` para elementos de diseño). Todo se construye sobre los **tokens semánticos de shadcn** mapeados a variables CSS (`var(--...)`) y al motor de Tailwind.
- **Motor de Variantes (`tailwind-variants`):** Cada componente shadcn define sus variantes estructurales y visuales usando `tv(...)`, asegurando contratos de props tipados (`variant`, `size`, etc.).
- **Unión Segura de Clases:** Toda combinación de estilos pasa por la utilidad `cn(...)` (`clsx` + `tailwind-merge`), estándar de shadcn para evitar conflictos en cascada.
- **Theming Dinámico:** Cambiar el tema completo (Light/Dark u otro esquema de marca) consiste únicamente en intercambiar las variables CSS en `:root` y `.dark` o alternar la clase `.dark` en el elemento raíz del DOM.

---

## 2. Abstracción de Tokens Semánticos (CSS Variables + `@theme`)

El sistema abstrae los valores de color en roles funcionales dentro de `layout.css` bajo directivas de Tailwind CSS v4:

### 2.1 Tokens Principales y su Rol
- `--background` / `--foreground`: Base de la vista y texto principal estándar.
- `--primary` / `--primary-foreground`: Acciones de máxima jerarquía, foco principal, botones de acción primaria (CTA).
- `--secondary` / `--secondary-foreground`: Acciones complementarias y navegación de soporte.
- `--tertiary` / `--tertiary-foreground`: Acentos de categoría, atención secundaria y elementos destacados específicos.
- `--accent` / `--accent-foreground`: Píldoras de estado dinámico o realces visuales frescos.
- `--muted` / `--muted-foreground`: Fondos tenues (filas alternadas, tarjetas deshabilitadas) y texto descriptivo secundario / placeholders.
- `--card` / `--card-foreground`: Superficies elevadas (tarjetas, paneles, contenedores de contenido).
- `--popover` / `--popover-foreground`: Elementos flotantes como desplegables, tooltips y modales.
- `--border` / `--input`: Delimitación estructural de contenedores, divisores y bordes de campos de entrada.
- `--destructive` / `--destructive-foreground`: Acciones críticas irreversibles y estados de error.
- `--ring`: Indicador de foco accesible (`focus-visible`).
- `--radius`: Redondeo base proporcional para la curvatura de botones, inputs y tarjetas.

---

## 3. Arquitectura de Componentes shadcn (`#lib/components/ui`)

El proyecto sigue la convención de componentes atómicos de **shadcn**, organizados de forma modular e independiente de la lógica del negocio:

```text
src/lib/components/ui/
├── button/
│   ├── button.svelte    # Componente con variantes y slot/render snippet
│   └── index.ts         # Exportación pública y tipado de variantes
├── card/
│   ├── card.svelte      # Contenedor raíz
│   ├── card-header.svelte
│   ├── card-title.svelte
│   ├── card-description.svelte
│   ├── card-content.svelte
│   └── index.ts         # Exportación como namespace (Card.Root, Card.Header...)
├── badge/
│   ├── badge.svelte
│   └── index.ts
├── calendar/
│   ├── calendar.svelte
│   ├── calendar-header.svelte
│   ├── calendar-heading.svelte
│   ├── calendar-prev-button.svelte
│   ├── calendar-next-button.svelte
│   ├── calendar-grid.svelte
│   ├── calendar-grid-head.svelte
│   ├── calendar-grid-row.svelte
│   ├── calendar-head-cell.svelte
│   ├── calendar-grid-body.svelte
│   ├── calendar-cell.svelte
│   ├── calendar-day.svelte
│   └── index.ts
├── popover/
│   ├── popover-content.svelte
│   ├── popover.variants.ts
│   └── index.ts
├── date-picker/
│   ├── date-picker.svelte
│   └── index.ts
├── input/
│   ├── input.svelte
│   └── index.ts
├── label/
│   ├── label.svelte
│   └── index.ts
├── pagination/
│   └── table-pagination.svelte
└── toast/
    ├── toast.svelte.ts  # Estado reactivo global con Runas Svelte 5
    └── toaster.svelte   # Contenedor de visualización
```

### 3.1 Patrón de Implementación shadcn (con Svelte 5)
Cada componente primitivo adopta la estructura clásica de shadcn adaptada a Svelte 5 con runas y separación de módulos:

```svelte
<script lang="ts" module>
  import { tv, type VariantProps } from 'tailwind-variants';

  export const componentVariants = tv({
    base: 'clases-base-compartidas focus-visible:ring-ring',
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-input bg-background hover:bg-muted text-foreground',
        ghost: 'hover:bg-primary/10 hover:text-primary',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        muted: 'bg-muted text-muted-foreground'
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        default: 'h-9 px-4 py-2 text-sm',
        lg: 'h-10 px-8 text-base'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  });

  export type ComponentVariant = VariantProps<typeof componentVariants>['variant'];
  export type ComponentSize = VariantProps<typeof componentVariants>['size'];
</script>

<script lang="ts">
  import { cn } from '#lib/utils';
  let { class: className, variant = 'default', size = 'default', children, ...restProps } = $props();
</script>

<button class={cn(componentVariants({ variant, size }), className)} {...restProps}>
  {@render children?.()}
</button>
```

---

## 4. Patrones de Layout Estructural

### 4.1 Shell de Aplicación (`app-shell.svelte`)
- **División Responsiva:** Barra lateral de navegación (`Sidebar`) colapsable + barra superior de contexto (`Top Header`) con estado operacional + área principal (`main`) de scroll independiente.
- **Jerarquía de Superficies:** 
  - Fondo general: `bg-background`
  - Paneles de navegación y tarjetas: `bg-card` con bordes sutiles `border-border`
  - Estado de selección/activo en menús: `bg-primary/10 text-primary`

### 4.2 Composición de Pantallas
- **Cabecera de Página:** Título de nivel 1 con descripción opcional y ranura de acciones (`headerActions`) a la derecha.
- **Secciones:** Organizadas en tarjetas semánticas (`<Card.Root>`) o rejillas responsivas (`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`).
- **Tablas y Listados:** Encabezados muted (`bg-muted/50 text-muted-foreground`), filas con hover interactivo (`hover:bg-muted/40 transition-colors`), y paginación desacoplada al pie (`TablePagination`).

---

## 5. Reglas de Implementación para Nuevas Funcionalidades

1. **Tokens siempre:** Utilizar clases semánticas (`text-foreground`, `text-muted-foreground`, `bg-card`, `border-border`, `bg-primary`, etc.) en lugar de paletas fijas de Tailwind.
2. **Iconos Lucide:** Importar siempre directamente desde `@lucide/svelte/icons/<icono>` para facilitar el tree-shaking óptimo.
3. **Manejo de Formularios:** Usar siempre pares `<Label>` e `<Input>` / selectores con estilos coherentes basados en tokens de `--input` y foco `--ring`.
4. **Interactividad y Modales:** Mantener el estado en runas de Svelte 5 (`$state(...)`), separando la vista en componentes modales independientes ubicados en carpetas `_components/modals/`.
5. **Catálogo de Referencia:** Cualquier nuevo componente base o variación debe reflejarse en la ruta [`/ui-design`](file:///c:/Users/noah1/OneDrive/Documentos/GitHub/cakes/src/routes/ui-design/+page.svelte) como playground de verificación.
