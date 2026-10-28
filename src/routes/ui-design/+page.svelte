<script lang="ts">
	import { Button } from '#lib/components/ui/button';
	import { Badge } from '#lib/components/ui/badge';
	import * as Card from '#lib/components/ui/card';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import { DatePicker } from '#lib/components/ui/date-picker';
	import TablePagination from '#lib/components/ui/pagination/table-pagination.svelte';
	import { toast } from '#lib/components/ui/toast/toast.svelte';
	import ThemeToggle from '#lib/components/theme-toggle.svelte';

	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Check from '@lucide/svelte/icons/check';
	import Clock from '@lucide/svelte/icons/clock';
	import AlertTriangle from '@lucide/svelte/icons/triangle-alert';
	import Info from '@lucide/svelte/icons/info';
	import Plus from '@lucide/svelte/icons/plus';
	import Minus from '@lucide/svelte/icons/minus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Search from '@lucide/svelte/icons/search';
	import CakeSlice from '@lucide/svelte/icons/cake-slice';
	import Package from '@lucide/svelte/icons/package';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Star from '@lucide/svelte/icons/star';
	import Tag from '@lucide/svelte/icons/tag';
	import Layers from '@lucide/svelte/icons/layers';
	import ChefHat from '@lucide/svelte/icons/chef-hat';
	import GraphHub from '@lucide/svelte/icons/graph-hub';
	import CirclePile from '@lucide/svelte/icons/circle-pile';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import X from '@lucide/svelte/icons/x';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';

	// Estado interactivo para controles de demostración
	let demoInputText = $state('Torta Ópera 24cm');
	let demoInputError = $state('');
	let demoQuantity = $state(3);
	let demoSelectValue = $state('cake');
	let demoToggle = $state(true);
	let demoCheckbox1 = $state(true);
	let demoCheckbox2 = $state(false);
	let demoDate = $state('2026-10-22');

	// Estado interactivo para paginación
	let demoCurrentPage = $state(2);
	let demoPageSize = $state(10);
	const demoTotalItems = 45;

	// Estado interactivo para Tabs
	let activeDemoTab = $state<'stock' | 'recipes' | 'products'>('stock');

	// Estado interactivo para Modal
	let showDemoModal = $state(false);

	const sections = [
		{ id: 'colors', label: 'Colores y Tokens' },
		{ id: 'buttons', label: 'Botones' },
		{ id: 'badges', label: 'Badges y Estados' },
		{ id: 'cards', label: 'Tarjetas y KPIs' },
		{ id: 'forms', label: 'Formularios y Entradas' },
		{ id: 'tabs', label: 'Pestañas y Navegación' },
		{ id: 'tables', label: 'Tablas y Paginación' },
		{ id: 'feedback', label: 'Feedback y Toasts' },
		{ id: 'modals', label: 'Modales y Diálogos' }
	];
</script>

<svelte:head>
	<title>Sistema de Diseño UI — GiveOS</title>
</svelte:head>

<div class="min-h-screen bg-background text-foreground antialiased">
	<!-- Header Sticky -->
	<header class="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md px-6 py-4">
		<div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
			<div class="flex items-center gap-3">
				<Button variant="ghost" size="sm" href="/dashboard" class="gap-1.5 text-xs text-muted-foreground">
					<ArrowLeft class="size-4" />
					<span>Volver al Dashboard</span>
				</Button>
				<div class="h-4 w-px bg-border"></div>
				<div>
					<h1 class="text-base font-bold text-foreground flex items-center gap-2">
						<span>GiveOS Design System</span>
						<Badge variant="outline" class="font-mono text-[10px] text-primary border-primary/30 bg-primary/5">
							v1.0 • Runes Mode
						</Badge>
					</h1>
					<p class="text-xs text-muted-foreground">
						Catálogo vivo de componentes, tokens y patrones UI con sus estados interactivos
					</p>
				</div>
			</div>

			<!-- Navegación Rápida a Secciones -->
			<div class="flex items-center gap-3">
				<nav class="flex flex-wrap items-center gap-1.5 overflow-x-auto py-1">
					{#each sections as section}
						<a
							href="#{section.id}"
							class="rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
						>
							{section.label}
						</a>
					{/each}
				</nav>
				<div class="h-4 w-px bg-border"></div>
				<ThemeToggle />
			</div>
		</div>
	</header>

	<!-- Contenido Central Escroleable -->
	<main class="mx-auto max-w-7xl px-6 py-10 space-y-16">

		<!-- ==================================================================== -->
		<!-- 1. COLORES Y TOKENS                                                  -->
		<!-- ==================================================================== -->
		<section id="colors" class="space-y-4 scroll-mt-24">
			<div class="border-b border-border pb-2">
				<h2 class="text-lg font-bold text-foreground">1. Paleta de Colores y Tokens de Marca</h2>
				<p class="text-xs text-muted-foreground">Sistema basado en Tailwind CSS v4 + shadcn/ui con base neutra de <strong>Zinc</strong>, Azul como <strong>Primary</strong> (Navegación), Índigo como <strong>Secondary</strong> (Acciones), Lima como <strong>Accent</strong> y Amarillo Puro como <strong>Tertiary</strong>.</p>
			</div>

			<!-- Tokens Semánticos Principales -->
			<div class="space-y-2">
				<h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tokens Semánticos de Marca y Estado</h3>
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
					<div class="rounded-xl border border-border bg-card p-3 shadow-2xs space-y-2">
						<div class="h-14 w-full rounded-lg bg-primary shadow-inner flex items-center justify-center text-primary-foreground font-bold text-xs">Primary</div>
						<div>
							<p class="text-xs font-bold text-foreground">Primary (Blue)</p>
							<p class="font-mono text-[11px] text-muted-foreground">#2563eb / blue-600</p>
						</div>
					</div>

					<div class="rounded-xl border border-border bg-card p-3 shadow-2xs space-y-2">
						<div class="h-14 w-full rounded-lg bg-secondary shadow-inner flex items-center justify-center text-secondary-foreground font-bold text-xs">Secondary</div>
						<div>
							<p class="text-xs font-bold text-foreground">Secondary (Indigo)</p>
							<p class="font-mono text-[11px] text-muted-foreground">#4f46e5 / indigo-600</p>
						</div>
					</div>

					<div class="rounded-xl border border-border bg-card p-3 shadow-2xs space-y-2">
						<div class="h-14 w-full rounded-lg bg-lime-400 dark:bg-lime-500 shadow-inner flex items-center justify-center text-lime-950 font-bold text-xs">Accent Lima</div>
						<div>
							<p class="text-xs font-bold text-foreground">Accent (Lima)</p>
							<p class="font-mono text-[11px] text-muted-foreground">#84cc16 / lime-500</p>
						</div>
					</div>

					<div class="rounded-xl border border-border bg-card p-3 shadow-2xs space-y-2">
						<div class="h-14 w-full rounded-lg bg-tertiary shadow-inner flex items-center justify-center text-tertiary-foreground font-bold text-xs">Tertiary</div>
						<div>
							<p class="text-xs font-bold text-foreground">Tertiary (Amarillo)</p>
							<p class="font-mono text-[11px] text-muted-foreground">#facc15 / yellow-400</p>
						</div>
					</div>

					<div class="rounded-xl border border-border bg-card p-3 shadow-2xs space-y-2">
						<div class="h-14 w-full rounded-lg bg-muted border border-border shadow-inner flex items-center justify-center text-muted-foreground font-bold text-xs">Muted</div>
						<div>
							<p class="text-xs font-bold text-foreground">Muted (Zinc)</p>
							<p class="font-mono text-[11px] text-muted-foreground">#f4f4f5 / #27272a</p>
						</div>
					</div>

					<div class="rounded-xl border border-border bg-card p-3 shadow-2xs space-y-2">
						<div class="h-14 w-full rounded-lg bg-destructive shadow-inner flex items-center justify-center text-destructive-foreground font-bold text-xs">Destructive</div>
						<div>
							<p class="text-xs font-bold text-foreground">Destructive</p>
							<p class="font-mono text-[11px] text-muted-foreground">#ef4444 / red-500</p>
						</div>
					</div>

					<div class="rounded-xl border border-border bg-card p-3 shadow-2xs space-y-2">
						<div class="h-14 w-full rounded-lg bg-emerald-500 shadow-inner flex items-center justify-center text-white font-bold text-xs">Success</div>
						<div>
							<p class="text-xs font-bold text-foreground">Success</p>
							<p class="font-mono text-[11px] text-muted-foreground">#10b981 / emerald</p>
						</div>
					</div>

					<div class="rounded-xl border border-border bg-card p-3 shadow-2xs space-y-2">
						<div class="h-14 w-full rounded-lg bg-amber-500 shadow-inner flex items-center justify-center text-white font-bold text-xs">Warning</div>
						<div>
							<p class="text-xs font-bold text-foreground">Warning</p>
							<p class="font-mono text-[11px] text-muted-foreground">#f59e0b / amber</p>
						</div>
					</div>
				</div>
			</div>

			<!-- Superficies Neutras (Zinc Foundation) -->
			<div class="space-y-2 pt-1">
				<h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Superficies y Fondos Neutros (Zinc Foundation)</h3>
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
					<div class="rounded-xl border border-border bg-card p-3 shadow-2xs space-y-1.5">
						<div class="h-9 w-full rounded-md bg-background border border-border flex items-center justify-center text-[11px] font-mono text-foreground">bg-background</div>
						<p class="text-[11px] font-bold text-foreground">Background (Lienzo)</p>
						<p class="font-mono text-[10px] text-muted-foreground">#ffffff / dark: #09090b (zinc-950)</p>
					</div>

					<div class="rounded-xl border border-border bg-card p-3 shadow-2xs space-y-1.5">
						<div class="h-9 w-full rounded-md bg-card border border-border flex items-center justify-center text-[11px] font-mono text-card-foreground">bg-card</div>
						<p class="text-[11px] font-bold text-foreground">Card / Superficie</p>
						<p class="font-mono text-[10px] text-muted-foreground">#ffffff / dark: #18181b (zinc-900)</p>
					</div>

					<div class="rounded-xl border border-border bg-card p-3 shadow-2xs space-y-1.5">
						<div class="h-9 w-full rounded-md bg-muted border border-border flex items-center justify-center text-[11px] font-mono text-muted-foreground">bg-muted</div>
						<p class="text-[11px] font-bold text-foreground">Muted / Fondos Secundarios</p>
						<p class="font-mono text-[10px] text-muted-foreground">#f4f4f5 (zinc-100) / dark: #27272a (zinc-800)</p>
					</div>

					<div class="rounded-xl border border-border bg-card p-3 shadow-2xs space-y-1.5">
						<div class="h-9 w-full rounded-md border-2 border-border flex items-center justify-center text-[11px] font-mono text-muted-foreground">border-border</div>
						<p class="text-[11px] font-bold text-foreground">Bordes y Divisores</p>
						<p class="font-mono text-[10px] text-muted-foreground">#e4e4e7 (zinc-200) / dark: #27272a (zinc-800)</p>
					</div>
				</div>
			</div>
		</section>

		<!-- ==================================================================== -->
		<!-- 2. BOTONES                                                           -->
		<!-- ==================================================================== -->
		<section id="buttons" class="space-y-6 scroll-mt-24">
			<div class="border-b border-border pb-2">
				<h2 class="text-lg font-bold text-foreground">2. Botones (Button)</h2>
				<p class="text-xs text-muted-foreground">Componente nativo con variantes tipadas y soporte para etiquetas <code class="rounded bg-muted px-1.5 py-0.5">button</code> y <code class="rounded bg-muted px-1.5 py-0.5">a</code>.</p>
			</div>

			<!-- Variantes Visuales en Todos los Colores -->
			<div class="space-y-3">
				<h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Todos los Tipos de Botones en Todos los Colores del Tema</h3>
				<div class="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-5">
					<Button variant="default">Primary (Blue)</Button>
					<Button variant="secondary">Secondary (Indigo)</Button>
					<Button variant="accent">Accent (Lima)</Button>
					<Button variant="tertiary">Tertiary (Amarillo)</Button>
					<Button variant="success">Success (Emerald)</Button>
					<Button variant="warning">Warning (Amber)</Button>
					<Button variant="destructive">Destructive (Red)</Button>
					<Button variant="muted">Muted (Zinc)</Button>
					<Button variant="outline">Outline</Button>
					<Button variant="ghost">Ghost</Button>
					<Button variant="link">Link Button</Button>
				</div>
			</div>

			<!-- Matriz Completa: Todos los Tamaños en Todos los Colores -->
			<div class="space-y-3">
				<h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Matriz Completa: Todos los Tamaños en Todos los Colores</h3>
				<div class="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
					<table class="w-full text-left text-xs">
						<thead class="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
							<tr>
								<th class="p-3 pl-4">Color / Variante</th>
								<th class="p-3">Small (sm)</th>
								<th class="p-3">Default</th>
								<th class="p-3">Large (lg)</th>
								<th class="p-3 pr-4 text-center">Icon Only</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border">
							<!-- Primary (Blue) -->
							<tr class="hover:bg-muted/20">
								<td class="p-3 pl-4 font-semibold text-primary">Primary (Blue)</td>
								<td class="p-3"><Button variant="default" size="sm">Small</Button></td>
								<td class="p-3"><Button variant="default" size="default">Default</Button></td>
								<td class="p-3"><Button variant="default" size="lg">Large</Button></td>
								<td class="p-3 pr-4 text-center"><Button variant="default" size="icon" title="Primary"><Plus class="size-4" /></Button></td>
							</tr>
							<!-- Secondary (Indigo) -->
							<tr class="hover:bg-muted/20">
								<td class="p-3 pl-4 font-semibold text-secondary">Secondary (Indigo)</td>
								<td class="p-3"><Button variant="secondary" size="sm">Small</Button></td>
								<td class="p-3"><Button variant="secondary" size="default">Default</Button></td>
								<td class="p-3"><Button variant="secondary" size="lg">Large</Button></td>
								<td class="p-3 pr-4 text-center"><Button variant="secondary" size="icon" title="Secondary"><ChefHat class="size-4" /></Button></td>
							</tr>
							<!-- Accent (Lima) -->
							<tr class="hover:bg-muted/20">
								<td class="p-3 pl-4 font-semibold text-lime-600 dark:text-lime-400">Accent (Lima)</td>
								<td class="p-3"><Button variant="accent" size="sm">Small</Button></td>
								<td class="p-3"><Button variant="accent" size="default">Default</Button></td>
								<td class="p-3"><Button variant="accent" size="lg">Large</Button></td>
								<td class="p-3 pr-4 text-center"><Button variant="accent" size="icon" title="Accent Lima"><Sparkles class="size-4" /></Button></td>
							</tr>
							<!-- Tertiary (Amarillo) -->
							<tr class="hover:bg-muted/20">
								<td class="p-3 pl-4 font-semibold text-yellow-600 dark:text-yellow-400">Tertiary (Amarillo)</td>
								<td class="p-3"><Button variant="tertiary" size="sm">Small</Button></td>
								<td class="p-3"><Button variant="tertiary" size="default">Default</Button></td>
								<td class="p-3"><Button variant="tertiary" size="lg">Large</Button></td>
								<td class="p-3 pr-4 text-center"><Button variant="tertiary" size="icon" title="Tertiary"><Star class="size-4" /></Button></td>
							</tr>
							<!-- Success (Emerald) -->
							<tr class="hover:bg-muted/20">
								<td class="p-3 pl-4 font-semibold text-emerald-600 dark:text-success/90">Success (Emerald)</td>
								<td class="p-3"><Button variant="success" size="sm">Small</Button></td>
								<td class="p-3"><Button variant="success" size="default">Default</Button></td>
								<td class="p-3"><Button variant="success" size="lg">Large</Button></td>
								<td class="p-3 pr-4 text-center"><Button variant="success" size="icon" title="Success"><Check class="size-4" /></Button></td>
							</tr>
							<!-- Warning (Amber) -->
							<tr class="hover:bg-muted/20">
								<td class="p-3 pl-4 font-semibold text-amber-600 dark:text-amber-400">Warning (Amber)</td>
								<td class="p-3"><Button variant="warning" size="sm">Small</Button></td>
								<td class="p-3"><Button variant="warning" size="default">Default</Button></td>
								<td class="p-3"><Button variant="warning" size="lg">Large</Button></td>
								<td class="p-3 pr-4 text-center"><Button variant="warning" size="icon" title="Warning"><AlertTriangle class="size-4" /></Button></td>
							</tr>
							<!-- Destructive (Red) -->
							<tr class="hover:bg-muted/20">
								<td class="p-3 pl-4 font-semibold text-destructive">Destructive (Red)</td>
								<td class="p-3"><Button variant="destructive" size="sm">Small</Button></td>
								<td class="p-3"><Button variant="destructive" size="default">Default</Button></td>
								<td class="p-3"><Button variant="destructive" size="lg">Large</Button></td>
								<td class="p-3 pr-4 text-center"><Button variant="destructive" size="icon" title="Destructive"><Trash2 class="size-4" /></Button></td>
							</tr>
							<!-- Muted (Zinc) -->
							<tr class="hover:bg-muted/20">
								<td class="p-3 pl-4 font-semibold text-muted-foreground">Muted (Zinc)</td>
								<td class="p-3"><Button variant="muted" size="sm">Small</Button></td>
								<td class="p-3"><Button variant="muted" size="default">Default</Button></td>
								<td class="p-3"><Button variant="muted" size="lg">Large</Button></td>
								<td class="p-3 pr-4 text-center"><Button variant="muted" size="icon" title="Muted"><Layers class="size-4" /></Button></td>
							</tr>
							<!-- Outline (Zinc Border) -->
							<tr class="hover:bg-muted/20">
								<td class="p-3 pl-4 font-semibold text-foreground">Outline (Zinc)</td>
								<td class="p-3"><Button variant="outline" size="sm">Small</Button></td>
								<td class="p-3"><Button variant="outline" size="default">Default</Button></td>
								<td class="p-3"><Button variant="outline" size="lg">Large</Button></td>
								<td class="p-3 pr-4 text-center"><Button variant="outline" size="icon" title="Outline"><Search class="size-4" /></Button></td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>

			<!-- Estados: Con Íconos y Deshabilitados -->
			<div class="space-y-2">
				<h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estados: Con Íconos y Deshabilitado</h3>
				<div class="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-5">
					<Button class="gap-2">
						<Plus class="size-4" />
						<span>Crear Pedido</span>
					</Button>
					<Button variant="secondary" class="gap-2">
						<GraphHub class="size-4" />
						<span>Nueva Elaboración</span>
					</Button>
					<Button variant="accent" class="gap-2">
						<Sparkles class="size-4" />
						<span>Acento Lima</span>
					</Button>
					<Button variant="tertiary" class="gap-2">
						<Star class="size-4" />
						<span>Atajo Terciario</span>
					</Button>
					<Button variant="outline" class="gap-2">
						<SlidersHorizontal class="size-4" />
						<span>Filtros Avanzados</span>
					</Button>
					<Button variant="destructive" class="gap-2">
						<Trash2 class="size-4" />
						<span>Eliminar Ítem</span>
					</Button>
					<Button disabled>
						<span>Acción Deshabilitada</span>
					</Button>
					<Button variant="outline" disabled class="gap-2">
						<Clock class="size-4" />
						<span>En Procesamiento...</span>
					</Button>
				</div>
			</div>
		</section>

		<!-- ==================================================================== -->
		<!-- 3. BADGES Y ESTADOS                                                  -->
		<!-- ==================================================================== -->
		<section id="badges" class="space-y-6 scroll-mt-24">
			<div class="border-b border-border pb-2">
				<h2 class="text-lg font-bold text-foreground">3. Badges y Etiquetas de Estado</h2>
				<p class="text-xs text-muted-foreground">Etiquetas visuales para tipos de insumo, estado de orden y cobro de pedidos.</p>
			</div>

			<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
				<!-- Badges Primitivas -->
				<div class="rounded-2xl border border-border bg-card p-5 space-y-3">
					<h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Variantes Estándar (Todos los Tokens)</h3>
					<div class="flex flex-wrap gap-2">
						<Badge variant="default">Primary</Badge>
						<Badge variant="secondary">Secondary</Badge>
						<Badge variant="accent">Accent (Lima)</Badge>
						<Badge variant="tertiary">Tertiary (Amarillo)</Badge>
						<Badge variant="success">Success</Badge>
						<Badge variant="warning">Warning</Badge>
						<Badge variant="destructive">Destructive</Badge>
						<Badge variant="muted">Muted</Badge>
						<Badge variant="outline">Outline</Badge>
					</div>
				</div>

				<!-- Estados de Orden de Compra -->
				<div class="rounded-2xl border border-border bg-card p-5 space-y-3">
					<h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estados de Pedido / Órdenes</h3>
					<div class="flex flex-wrap gap-2">
						<span class="inline-flex items-center gap-1.5 rounded-full bg-secondary/10 px-2.5 py-0.5 text-xs font-bold text-secondary">
							<span class="size-1.5 rounded-full bg-secondary"></span>
							Por Confirmar
						</span>
						<span class="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-700">
							<span class="size-1.5 rounded-full bg-amber-500"></span>
							Pendiente
						</span>
						<span class="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-bold text-sky-700">
							<span class="size-1.5 rounded-full bg-sky-500"></span>
							En Producción
						</span>
						<span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
							<Check class="size-3" />
							Entregado
						</span>
						<span class="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-bold text-destructive">
							<X class="size-3" />
							Cancelado
						</span>
					</div>
				</div>

				<!-- Tipos de Ítem en Inventario -->
				<div class="rounded-2xl border border-border bg-card p-5 space-y-3">
					<h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipos de Ítem (GiveOS)</h3>
					<div class="flex flex-wrap gap-2">
						<Badge variant="outline" class="border-tertiary/40 bg-tertiary/20 text-yellow-900 dark:text-yellow-300 text-xs font-semibold">
							Materia Prima (Insumo)
						</Badge>
						<Badge variant="secondary" class="gap-1.5 text-xs">
							<GraphHub class="size-3.5" />
							<span>Sub-ensamble (Elaboración)</span>
						</Badge>
						<Badge variant="outline" class="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 text-xs">
							Producto Final
						</Badge>
						<Badge variant="outline" class="border-amber-500/30 bg-amber-500/10 text-amber-700 text-xs">
							<Sparkles class="size-3 mr-1" />
							Combo Comercial
						</Badge>
					</div>
				</div>
			</div>
		</section>

		<!-- ==================================================================== -->
		<!-- 4. TARJETAS Y KPIS                                                   -->
		<!-- ==================================================================== -->
		<section id="cards" class="space-y-6 scroll-mt-24">
			<div class="border-b border-border pb-2">
				<h2 class="text-lg font-bold text-foreground">4. Tarjetas y Módulos KPI (Card)</h2>
				<p class="text-xs text-muted-foreground">Estructuras modulares con <code class="rounded bg-muted px-1.5 py-0.5">Card.Root</code>, <code class="rounded bg-muted px-1.5 py-0.5">Card.Header</code> y <code class="rounded bg-muted px-1.5 py-0.5">Card.Content</code>. Rework con íconos ampliados alineados horizontalmente al valor numérico.</p>
			</div>

			<!-- KPIs en Grid (Rework con Ícono Alineado al Número) -->
			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Estilo Principal (Con Contenedor de Color Suave)
					</h3>
					<Badge variant="outline" class="text-[10px] text-primary border-primary/30">Recomendado</Badge>
				</div>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<!-- KPI 1: Primary (Blue) -->
					<Card.Root class="border-border bg-card shadow-xs">
						<Card.Header class="p-4 sm:p-5 pb-2 space-y-1.5">
							<Card.Description class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Productos en Venta
							</Card.Description>
							<div class="flex items-center gap-3 pt-0.5">
								<div class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
									<CakeSlice class="size-6" />
								</div>
								<Card.Title class="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
									28
								</Card.Title>
							</div>
						</Card.Header>
						<Card.Content class="p-4 sm:p-5 pt-0">
							<p class="text-xs text-muted-foreground">
								4 combos • 24 productos simples
							</p>
						</Card.Content>
					</Card.Root>

					<!-- KPI 2: Secondary (Indigo) -->
					<Card.Root class="border-secondary/30 bg-secondary/5 shadow-xs">
						<Card.Header class="p-4 sm:p-5 pb-2 space-y-1.5">
							<Card.Description class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Elaboraciones y Sub-recetas
							</Card.Description>
							<div class="flex items-center gap-3 pt-0.5">
								<div class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary/15 text-secondary">
									<GraphHub class="size-6" />
								</div>
								<Card.Title class="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-secondary">
									16
								</Card.Title>
							</div>
						</Card.Header>
						<Card.Content class="p-4 sm:p-5 pt-0">
							<p class="text-xs text-muted-foreground">
								Bases, rellenos y coberturas estándar
							</p>
						</Card.Content>
					</Card.Root>

					<!-- KPI 3: Accent (Lima) -->
					<Card.Root class="border-lime-500/30 bg-lime-500/5 shadow-xs">
						<Card.Header class="p-4 sm:p-5 pb-2 space-y-1.5">
							<Card.Description class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Atajos y Destacados
							</Card.Description>
							<div class="flex items-center gap-3 pt-0.5">
								<div class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-lime-400/20 text-lime-800 dark:text-lime-300">
									<Sparkles class="size-6" />
								</div>
								<Card.Title class="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-lime-700 dark:text-lime-300">
									12
								</Card.Title>
							</div>
						</Card.Header>
						<Card.Content class="p-4 sm:p-5 pt-0">
							<p class="text-xs text-muted-foreground font-mono">
								Productos con acceso rápido
							</p>
						</Card.Content>
					</Card.Root>

					<!-- KPI 4: Muted (Zinc) -->
					<Card.Root class="border-border bg-muted/40 shadow-xs">
						<Card.Header class="p-4 sm:p-5 pb-2 space-y-1.5">
							<Card.Description class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Capacidad de Producción
							</Card.Description>
							<div class="flex items-center gap-3 pt-0.5">
								<div class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
									<Layers class="size-6" />
								</div>
								<Card.Title class="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
									82%
								</Card.Title>
							</div>
						</Card.Header>
						<Card.Content class="p-4 sm:p-5 pt-0">
							<p class="text-xs text-muted-foreground font-mono">
								Turno mañana y tarde al 90%
							</p>
						</Card.Content>
					</Card.Root>

					<!-- KPI 5: Success (Emerald) -->
					<Card.Root class="border-emerald-500/30 bg-emerald-500/5 shadow-xs">
						<Card.Header class="p-4 sm:p-5 pb-2 space-y-1.5">
							<Card.Description class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Stock en Mostrador
							</Card.Description>
							<div class="flex items-center gap-3 pt-0.5">
								<div class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600">
									<Package class="size-6" />
								</div>
								<Card.Title class="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-emerald-600">
									45 u
								</Card.Title>
							</div>
						</Card.Header>
						<Card.Content class="p-4 sm:p-5 pt-0">
							<p class="text-xs text-muted-foreground">
								Listo para despacho inmediato
							</p>
						</Card.Content>
					</Card.Root>

					<!-- KPI 6: Destructive (Red) -->
					<Card.Root class="border-destructive/30 bg-destructive/5 shadow-xs">
						<Card.Header class="p-4 sm:p-5 pb-2 space-y-1.5">
							<Card.Description class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Insumos Bajo Mínimo
							</Card.Description>
							<div class="flex items-center gap-3 pt-0.5">
								<div class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
									<AlertTriangle class="size-6" />
								</div>
								<Card.Title class="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-destructive">
									3
								</Card.Title>
							</div>
						</Card.Header>
						<Card.Content class="p-4 sm:p-5 pt-0">
							<p class="text-xs text-muted-foreground">
								Requieren reposición de compra
							</p>
						</Card.Content>
					</Card.Root>
				</div>
			</div>

			<!-- Variante Alternativa: Con Ícono Directo Grande (Sin contenedor de fondo) -->
			<div class="space-y-3 pt-2">
				<h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Variante B (Ícono Directo Grande sin Contenedor)
				</h3>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<Card.Root class="border-border bg-card shadow-xs">
						<Card.Header class="p-4 sm:p-5 pb-2 space-y-1.5">
							<Card.Description class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Productos Comerciales
							</Card.Description>
							<div class="flex items-center gap-3 pt-0.5">
								<CakeSlice class="size-7 text-primary shrink-0" />
								<Card.Title class="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
									28
								</Card.Title>
							</div>
						</Card.Header>
						<Card.Content class="p-4 sm:p-5 pt-0">
							<p class="text-xs text-muted-foreground">
								4 combos • 24 productos simples
							</p>
						</Card.Content>
					</Card.Root>

					<Card.Root class="border-amber-500/30 bg-amber-500/5 shadow-xs">
						<Card.Header class="p-4 sm:p-5 pb-2 space-y-1.5">
							<Card.Description class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Pedidos Pendientes
							</Card.Description>
							<div class="flex items-center gap-3 pt-0.5">
								<Clock class="size-7 text-amber-500 shrink-0" />
								<Card.Title class="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-amber-600">
									12
								</Card.Title>
							</div>
						</Card.Header>
						<Card.Content class="p-4 sm:p-5 pt-0">
							<p class="text-xs text-muted-foreground font-mono">
								18 unidades por entregar
							</p>
						</Card.Content>
					</Card.Root>

					<Card.Root class="border-border bg-card shadow-xs">
						<Card.Header class="p-4 sm:p-5 pb-2 space-y-1.5">
							<Card.Description class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Stock en Mostrador
							</Card.Description>
							<div class="flex items-center gap-3 pt-0.5">
								<Package class="size-7 text-emerald-600 shrink-0" />
								<Card.Title class="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-emerald-600">
									45 u
								</Card.Title>
							</div>
						</Card.Header>
						<Card.Content class="p-4 sm:p-5 pt-0">
							<p class="text-xs text-muted-foreground">
								Listo para despacho inmediato
							</p>
						</Card.Content>
					</Card.Root>

					<Card.Root class="border-red-500/30 bg-red-500/5 shadow-xs">
						<Card.Header class="p-4 sm:p-5 pb-2 space-y-1.5">
							<Card.Description class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Insumos Bajo Mínimo
							</Card.Description>
							<div class="flex items-center gap-3 pt-0.5">
								<AlertTriangle class="size-7 text-red-500 shrink-0" />
								<Card.Title class="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-red-600">
									3
								</Card.Title>
							</div>
						</Card.Header>
						<Card.Content class="p-4 sm:p-5 pt-0">
							<p class="text-xs text-muted-foreground">
								Requieren reposición de compra
							</p>
						</Card.Content>
					</Card.Root>
				</div>
			</div>

			<!-- Tarjeta Interactiva y Tarjeta Empty State -->
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
				<!-- Tarjeta de Contenido / Ficha -->
				<Card.Root class="border-border bg-card shadow-xs">
					<Card.Header class="p-5 border-b border-border">
						<div class="flex items-center justify-between">
							<div class="space-y-1">
								<Card.Title class="text-base font-bold text-foreground">Ficha Técnica de Producto</Card.Title>
								<Card.Description class="text-xs text-muted-foreground">Estructura de costos e ingredientes</Card.Description>
							</div>
							<span class="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">PRD-001</span>
						</div>
					</Card.Header>
					<Card.Content class="p-5 space-y-4">
						<p class="text-xs text-muted-foreground leading-relaxed">
							Torta Selva Negra elaborada con bizcochuelo de chocolate, chantilly y cerezas al marrasquino.
						</p>
						<div class="flex items-center gap-2">
							<Badge variant="secondary" class="gap-1 font-mono text-xs font-semibold">
								<CirclePile class="size-3.5" />
								<span>Rendimiento: 12 porciones</span>
							</Badge>
						</div>
						<div class="flex items-center justify-between pt-2 border-t border-border text-xs">
							<span class="text-muted-foreground">Precio de Lista:</span>
							<strong class="font-mono text-sm text-foreground">$ 18.500,00</strong>
						</div>
					</Card.Content>
				</Card.Root>

				<!-- Empty State -->
				<div class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center space-y-3">
					<div class="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
						<ShoppingBag class="size-6" />
					</div>
					<div class="space-y-1">
						<h3 class="text-sm font-bold text-foreground">No se encontraron órdenes</h3>
						<p class="text-xs text-muted-foreground max-w-xs">
							Intenta modificar los filtros de búsqueda o registra una nueva orden para este período.
						</p>
					</div>
					<Button size="sm" class="gap-1.5 shadow-2xs">
						<Plus class="size-3.5" />
						<span>Nueva Orden</span>
					</Button>
				</div>
			</div>
		</section>

		<!-- ==================================================================== -->
		<!-- 5. FORMULARIOS Y ENTRADAS                                            -->
		<!-- ==================================================================== -->
		<section id="forms" class="space-y-6 scroll-mt-24">
			<div class="border-b border-border pb-2">
				<h2 class="text-lg font-bold text-foreground">5. Formularios y Entradas de Usuario (Form Controls)</h2>
				<p class="text-xs text-muted-foreground">Inputs, Steppers numéricos, Selects y validación reactiva con runes de Svelte 5.</p>
			</div>

			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				<!-- Input Estándar y con Ícono -->
				<div class="rounded-2xl border border-border bg-card p-5 space-y-4">
					<h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inputs de Texto y Búsqueda</h3>

					<div class="space-y-1.5">
						<Label class="text-xs font-medium">Nombre de Producto <span class="text-destructive">*</span></Label>
						<Input bind:value={demoInputText} placeholder="Ej. Lemon Pie..." />
					</div>

					<div class="space-y-1.5">
						<Label class="text-xs font-medium">Buscador con Ícono</Label>
						<div class="relative">
							<Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input placeholder="Buscar por código o cliente..." class="pl-9" />
						</div>
					</div>

					<div class="space-y-1.5">
						<Label class="text-xs font-medium text-muted-foreground">Campo Deshabilitado</Label>
						<Input value="COD-AUTOMATICO-992" disabled class="bg-muted/50 font-mono text-xs cursor-not-allowed" />
					</div>
				</div>

				<!-- Stepper Numérico y Select -->
				<div class="rounded-2xl border border-border bg-card p-5 space-y-4">
					<h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Control de Cantidad y Select</h3>

					<div class="space-y-1.5">
						<div class="flex items-center justify-between">
							<Label class="text-xs font-medium">Cantidad de Unidades</Label>
							<span class="font-mono text-xs font-bold text-primary">{demoQuantity} u</span>
						</div>
						<div class="flex items-center">
							<Button
								type="button"
								variant="outline"
								size="icon"
								onclick={() => (demoQuantity = Math.max(1, demoQuantity - 1))}
								class="size-9 rounded-r-none border-r-0 hover:bg-accent active:scale-95"
							>
								<Minus class="size-3.5" />
							</Button>
							<Input
								type="number"
								min="1"
								bind:value={demoQuantity}
								class="h-9 w-20 rounded-none text-center font-mono font-bold shadow-none"
							/>
							<Button
								type="button"
								variant="outline"
								size="icon"
								onclick={() => (demoQuantity = demoQuantity + 1)}
								class="size-9 rounded-l-none border-l-0 hover:bg-accent active:scale-95"
							>
								<Plus class="size-3.5" />
							</Button>
						</div>
					</div>

					<div class="space-y-1.5">
						<Label class="text-xs font-medium">Categoría de Venta</Label>
						<select
							bind:value={demoSelectValue}
							class="w-full h-9 rounded-md border border-input bg-transparent px-3 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						>
							<option value="cake">Tortas y Pasteles</option>
							<option value="individual">Porciones Individuales</option>
							<option value="bakery">Panadería & Masas</option>
							<option value="beverage">Bebidas</option>
						</select>
					</div>
				</div>

				<!-- Checkbox, Switch y Error State -->
				<div class="rounded-2xl border border-border bg-card p-5 space-y-4">
					<h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Toggles y Validación</h3>

					<div class="space-y-2">
						<label class="flex items-center gap-2.5 text-xs text-foreground cursor-pointer">
							<input
								type="checkbox"
								bind:checked={demoCheckbox1}
								class="size-4 rounded border-input text-primary focus:ring-ring cursor-pointer"
							/>
							<span>Habilitado para venta en mostrador</span>
						</label>

						<label class="flex items-center gap-2.5 text-xs text-foreground cursor-pointer">
							<input
								type="checkbox"
								bind:checked={demoCheckbox2}
								class="size-4 rounded border-input text-primary focus:ring-ring cursor-pointer"
							/>
							<span>Requiere confirmación previa de seña</span>
						</label>
					</div>

					<div class="space-y-1.5 pt-2 border-t border-border">
						<Label class="text-xs font-semibold">Selector de Fecha (DatePicker shadcn)</Label>
						<DatePicker bind:value={demoDate} />
						<p class="text-[11px] text-muted-foreground font-mono">Valor seleccionado: {demoDate || '(ninguno)'}</p>
					</div>

					<div class="space-y-1.5 pt-2 border-t border-border">
						<Label class="text-xs font-medium text-destructive">Campo con Error de Validación</Label>
						<Input
							value="Stock negativo invalido"
							class="border-destructive focus-visible:ring-destructive text-destructive font-mono text-xs"
						/>
						<p class="text-[11px] text-destructive">El stock inicial no puede ser inferior a 0.</p>
					</div>
				</div>
			</div>
		</section>

		<!-- ==================================================================== -->
		<!-- 6. PESTAÑAS Y NAVEGACIÓN                                             -->
		<!-- ==================================================================== -->
		<section id="tabs" class="space-y-6 scroll-mt-24">
			<div class="border-b border-border pb-2">
				<h2 class="text-lg font-bold text-foreground">6. Pestañas y Navegación Segmentada (Tabs)</h2>
				<p class="text-xs text-muted-foreground">Control interactivo unificado para alternar entre contextos principales.</p>
			</div>

			<div class="rounded-2xl border border-border bg-card p-6 space-y-5">
				<!-- Barra de Pestañas -->
				<div class="flex items-center gap-1 rounded-2xl border border-border bg-card p-1.5 w-fit shadow-2xs">
					<button
						type="button"
						onclick={() => (activeDemoTab = 'stock')}
						class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-colors cursor-pointer {activeDemoTab === 'stock'
							? 'bg-primary text-primary-foreground shadow-xs font-semibold'
							: 'text-muted-foreground hover:text-foreground'}"
					>
						<Package class="size-4" />
						<span>Inventario de Insumos</span>
					</button>

					<button
						type="button"
						onclick={() => (activeDemoTab = 'recipes')}
						class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-colors cursor-pointer {activeDemoTab === 'recipes'
							? 'bg-primary text-primary-foreground shadow-xs font-semibold'
							: 'text-muted-foreground hover:text-foreground'}"
					>
						<GraphHub class="size-4" />
						<span>Estructura de Recetas</span>
					</button>

					<button
						type="button"
						onclick={() => (activeDemoTab = 'products')}
						class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-colors cursor-pointer {activeDemoTab === 'products'
							? 'bg-primary text-primary-foreground shadow-xs font-semibold'
							: 'text-muted-foreground hover:text-foreground'}"
					>
						<Tag class="size-4" />
						<span>Productos de Venta</span>
					</button>
				</div>

				<!-- Contenido de la Pestaña Activa -->
				<div class="rounded-xl border border-border bg-muted/10 p-5 text-xs text-muted-foreground">
					{#if activeDemoTab === 'stock'}
						<p>📦 <strong>Vista Inventario activa:</strong> Supervisión de insumos básicos (harina, huevos, manteca), unidades de medida y alertas de reposición.</p>
					{:else if activeDemoTab === 'recipes'}
						<p>🥣 <strong>Vista Recetas activa:</strong> Árbol multinivel de elaboraciones y sub-recetas (bizcochuelo, ganache, crema pastelera).</p>
					{:else}
						<p>🏷️ <strong>Vista Productos de Venta activa:</strong> Catálogo comercial para el módulo de facturación, precios y combos promocionales.</p>
					{/if}
				</div>
			</div>
		</section>

		<!-- ==================================================================== -->
		<!-- 7. TABLAS Y PAGINACIÓN                                               -->
		<!-- ==================================================================== -->
		<section id="tables" class="space-y-6 scroll-mt-24">
			<div class="border-b border-border pb-2">
				<h2 class="text-lg font-bold text-foreground">7. Tablas de Datos y Paginación</h2>
				<p class="text-xs text-muted-foreground">Estructura de tablas estilizadas con filas cebra, estados y paginador interactivo.</p>
			</div>

			<div class="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead class="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
							<tr>
								<th class="p-3.5 pl-5">Código</th>
								<th class="p-3.5">Nombre del Ítem</th>
								<th class="p-3.5">Tipo</th>
								<th class="p-3.5 text-right">Stock Actual</th>
								<th class="p-3.5 text-right">Mínimo</th>
								<th class="p-3.5">Estado</th>
								<th class="p-3.5 pr-5 text-right">Acciones</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border">
							<tr class="hover:bg-muted/30 transition-colors">
								<td class="p-3.5 pl-5 font-mono font-semibold text-primary">INS-001</td>
								<td class="p-3.5 font-medium text-foreground">Harina 0000 Ultra Blanca</td>
								<td class="p-3.5">
									<Badge variant="outline" class="border-blue-500/30 bg-blue-500/10 text-blue-700 text-[11px]">
										Materia Prima
									</Badge>
								</td>
								<td class="p-3.5 text-right font-mono font-bold text-foreground">45.00 kg</td>
								<td class="p-3.5 text-right font-mono text-muted-foreground">10.00 kg</td>
								<td class="p-3.5">
									<span class="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
										<Check class="size-3" />
										Óptimo
									</span>
								</td>
								<td class="p-3.5 pr-5 text-right">
									<Button variant="ghost" size="sm" class="h-7 px-2 text-xs">Editar</Button>
								</td>
							</tr>

							<tr class="hover:bg-muted/30 transition-colors">
								<td class="p-3.5 pl-5 font-mono font-semibold text-primary">INS-004</td>
								<td class="p-3.5 font-medium text-foreground">Crema de Leche 38%</td>
								<td class="p-3.5">
									<Badge variant="outline" class="border-blue-500/30 bg-blue-500/10 text-blue-700 text-[11px]">
										Materia Prima
									</Badge>
								</td>
								<td class="p-3.5 text-right font-mono font-bold text-amber-600">3.50 L</td>
								<td class="p-3.5 text-right font-mono text-muted-foreground">5.00 L</td>
								<td class="p-3.5">
									<span class="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-700">
										<Clock class="size-3" />
										Alerta Stock
									</span>
								</td>
								<td class="p-3.5 pr-5 text-right">
									<Button variant="ghost" size="sm" class="h-7 px-2 text-xs">Editar</Button>
								</td>
							</tr>

							<tr class="hover:bg-muted/30 transition-colors">
								<td class="p-3.5 pl-5 font-mono font-semibold text-primary">CMB-002</td>
								<td class="p-3.5 font-medium text-foreground">Combo Merienda Familiar (Torta + 6 Muffins)</td>
								<td class="p-3.5">
									<Badge variant="accent" class="text-[11px] gap-1">
										<Sparkles class="size-2.5" />
										Combo
									</Badge>
								</td>
								<td class="p-3.5 text-right font-mono font-bold text-foreground">12.00 u</td>
								<td class="p-3.5 text-right font-mono text-muted-foreground">3.00 u</td>
								<td class="p-3.5">
									<span class="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-700">
										<Sparkles class="size-3" />
										Promoción
									</span>
								</td>
								<td class="p-3.5 pr-5 text-right">
									<Button variant="ghost" size="sm" class="h-7 px-2 text-xs">Editar</Button>
								</td>
							</tr>

							<tr class="hover:bg-muted/30 transition-colors bg-red-500/5">
								<td class="p-3.5 pl-5 font-mono font-semibold text-primary">REC-012</td>
								<td class="p-3.5 font-medium text-foreground">Bizcochuelo Vainilla 20cm</td>
								<td class="p-3.5">
									<Badge variant="secondary" class="text-[11px]">
										Elaboración
									</Badge>
								</td>
								<td class="p-3.5 text-right font-mono font-bold text-red-600">0.00 u</td>
								<td class="p-3.5 text-right font-mono text-muted-foreground">4.00 u</td>
								<td class="p-3.5">
									<span class="inline-flex items-center gap-1 rounded bg-red-500/10 px-2 py-0.5 text-[11px] font-bold text-red-700">
										<AlertTriangle class="size-3" />
										Sin Stock
									</span>
								</td>
								<td class="p-3.5 pr-5 text-right">
									<Button variant="ghost" size="sm" class="h-7 px-2 text-xs text-primary">Elaborar</Button>
								</td>
							</tr>
						</tbody>
					</table>
				</div>

				<!-- Paginador Integrado -->
				<div class="p-4 border-t border-border">
					<TablePagination
						bind:currentPage={demoCurrentPage}
						bind:pageSize={demoPageSize}
						totalItems={demoTotalItems}
						itemLabel="insumos"
					/>
				</div>
			</div>
		</section>

		<!-- ==================================================================== -->
		<!-- 8. FEEDBACK Y TOASTS                                                 -->
		<!-- ==================================================================== -->
		<section id="feedback" class="space-y-6 scroll-mt-24">
			<div class="border-b border-border pb-2">
				<h2 class="text-lg font-bold text-foreground">8. Feedback y Mensajería (Toasts)</h2>
				<p class="text-xs text-muted-foreground">Notificaciones reactivas integradas con el store <code class="rounded bg-muted px-1.5 py-0.5">toast</code> de Svelte 5. Haz clic para disparar:</p>
			</div>

			<div class="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-2xl border border-border bg-card p-6">
				<Button
					variant="outline"
					class="border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 gap-2 cursor-pointer"
					onclick={() => toast.success('Operación exitosa', 'La orden fue confirmada y despachada correctamente.')}
				>
					<Check class="size-4 text-emerald-600" />
					<span>Toast Éxito</span>
				</Button>

				<Button
					variant="outline"
					class="border-red-500/40 text-red-700 hover:bg-red-500/10 gap-2 cursor-pointer"
					onclick={() => toast.error('Error al guardar', 'No hay suficiente harina para completar la receta.')}
				>
					<X class="size-4 text-red-600" />
					<span>Toast Error</span>
				</Button>

				<Button
					variant="outline"
					class="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 gap-2 cursor-pointer"
					onclick={() => toast.warning('Atención requerida', 'El stock de manteca está por debajo del límite seguro.')}
				>
					<AlertTriangle class="size-4 text-amber-600" />
					<span>Toast Warning</span>
				</Button>

				<Button
					variant="outline"
					class="border-primary/40 text-primary hover:bg-primary/10 gap-2 cursor-pointer"
					onclick={() => toast.info('Actualización', 'Se aplicó automáticamente el descuento por escala mayorista.')}
				>
					<Info class="size-4 text-primary" />
					<span>Toast Info</span>
				</Button>
			</div>
		</section>

		<!-- ==================================================================== -->
		<!-- 9. MODALES Y DIÁLOGOS                                                -->
		<!-- ==================================================================== -->
		<section id="modals" class="space-y-6 scroll-mt-24 pb-16">
			<div class="border-b border-border pb-2">
				<h2 class="text-lg font-bold text-foreground">9. Modales y Diálogos Superpuestos (Modals)</h2>
				<p class="text-xs text-muted-foreground">Estructuras para ventanas flotantes con backdrop blur, header, contenido y botonera.</p>
			</div>

			<div class="rounded-2xl border border-border bg-card p-6 space-y-4">
				<p class="text-xs text-muted-foreground">
					Prueba el modal interactivo de confirmación y formulario con validación:
				</p>
				<Button onclick={() => (showDemoModal = true)} class="gap-2 shadow-sm cursor-pointer">
					<ExternalLink class="size-4" />
					<span>Abrir Modal de Demostración</span>
				</Button>
			</div>

			<!-- Modal Demo -->
			{#if showDemoModal}
				<div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs">
					<div class="w-full max-w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border-t sm:border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
						<!-- Header -->
						<div class="flex items-center justify-between border-b border-border pb-3">
							<div class="space-y-0.5">
								<h3 class="text-base font-bold text-foreground">Ajuste Rápido de Precio</h3>
								<p class="text-xs text-muted-foreground">
									Modifica el precio comercial de lista para este producto
								</p>
							</div>
							<button
								type="button"
								onclick={() => (showDemoModal = false)}
								class="rounded-lg p-1 text-muted-foreground hover:bg-muted cursor-pointer transition-colors"
							>
								<X class="size-5" />
							</button>
						</div>

						<!-- Body -->
						<div class="space-y-4 text-xs">
							<div class="space-y-1">
								<Label class="text-xs font-medium">Producto Seleccionado</Label>
								<Input value="Torta Selva Negra 24cm (PRD-001)" disabled class="bg-muted/50 cursor-not-allowed" />
							</div>

							<div class="space-y-1">
								<Label class="text-xs font-medium">Nuevo Precio Unitario ($)</Label>
								<Input type="number" value="18500" class="font-mono text-base font-bold text-primary" />
							</div>

							<p class="text-[11px] text-muted-foreground">
								Este cambio afectará a las nuevas órdenes que se emitan desde el comandero y catálogo.
							</p>
						</div>

						<!-- Footer -->
						<div class="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onclick={() => (showDemoModal = false)}
								class="cursor-pointer"
							>
								Cancelar
							</Button>
							<Button
								type="button"
								size="sm"
								onclick={() => {
									showDemoModal = false;
									toast.success('Precio guardado', 'Se actualizó el valor de lista correctamente.');
								}}
								class="shadow-xs cursor-pointer"
							>
								Guardar Cambios
							</Button>
						</div>
					</div>
				</div>
			{/if}
		</section>

	</main>
</div>
