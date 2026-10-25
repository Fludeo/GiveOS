<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import {
		getBusinessOpenStatus,
		parseWeeklySchedule,
		type Business,
		type BusinessRole
	} from '#lib/features/businesses/domain/business.entity';
	import type { AuthUser } from '#lib/features/auth/domain/auth.entity';
	import { Button } from '#lib/components/ui/button';
	import { Badge } from '#lib/components/ui/badge';
	import ScanFace from '@lucide/svelte/icons/scan-face';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
	import Package from '@lucide/svelte/icons/package';
	import Settings from '@lucide/svelte/icons/settings';
	import Store from '@lucide/svelte/icons/store';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Phone from '@lucide/svelte/icons/phone';
	import Clock from '@lucide/svelte/icons/clock';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import PanelLeftClose from '@lucide/svelte/icons/panel-left-close';
	import PanelLeftOpen from '@lucide/svelte/icons/panel-left-open';
	import ThemeToggle from '#lib/components/theme-toggle.svelte';

	let {
		user,
		activeBusiness,
		businesses: _businesses,
		currentSection,
		title,
		description,
		headerActions,
		children
	}: {
		user: AuthUser;
		activeBusiness: Business;
		businesses?: Array<Business & { role: BusinessRole }>;
		currentSection: 'dashboard' | 'orders' | 'recipes' | 'inventory' | 'settings';
		title: string;
		description: string;
		headerActions?: Snippet;
		children: Snippet;
	} = $props();

	let showScheduleModal = $state(false);
	let isCollapsed = $state(false);

	$effect(() => {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('giveos_sidebar_collapsed');
			if (saved !== null) {
				isCollapsed = saved === 'true';
			} else if (window.innerWidth < 1280) {
				isCollapsed = true;
			}
		}
	});

	function toggleSidebar() {
		isCollapsed = !isCollapsed;
		if (typeof window !== 'undefined') {
			localStorage.setItem('giveos_sidebar_collapsed', String(isCollapsed));
		}
	}

	const openStatus = $derived(getBusinessOpenStatus(activeBusiness.openingHours));
	const parsedSchedule = $derived(parseWeeklySchedule(activeBusiness.openingHours));
	const isNewOrderRoute = $derived(page.url.pathname.startsWith('/orders/new'));

	const navItems = $derived([
		{
			id: 'dashboard' as const,
			label: 'Dashboard',
			mobileLabel: 'Inicio',
			href: '/dashboard',
			icon: LayoutDashboard
		},
		{
			id: 'orders' as const,
			label: 'Órdenes',
			mobileLabel: 'Órdenes',
			href: '/orders',
			icon: ShoppingBag
		},
		{
			id: 'inventory' as const,
			label: 'Inventario y Recetas',
			mobileLabel: 'Inventario',
			href: '/inventory',
			icon: Package
		},
		{
			id: 'settings' as const,
			label: 'Configuración',
			mobileLabel: 'Ajustes',
			href: '/settings',
			icon: Settings
		}
	]);

	const leftDockItems = $derived(navItems.slice(0, 2));
	const rightDockItems = $derived(navItems.slice(2, 4));
</script>

<div class="flex h-screen h-dvh w-full overflow-hidden bg-muted/20">
	<!-- Sidebar lateral en escritorio con modo comprimido/expandido -->
	<aside
		class="hidden h-full shrink-0 flex-col border-r border-border bg-background transition-all duration-200 lg:flex {isCollapsed
			? 'w-20'
			: 'w-64 xl:w-72'}"
	>
		<!-- Logo, Nombre y Botón de Toggle -->
		<div class="shrink-0 border-b border-border {isCollapsed ? 'p-3 text-center' : 'p-5'}">
			<div class="flex items-center {isCollapsed ? 'flex-col gap-2' : 'justify-between gap-3'}">
				<div class="flex items-center gap-3 min-w-0">
					<div
						class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground shadow-xs"
					>
						<ScanFace class="size-6" />
					</div>
					{#if !isCollapsed}
						<div class="min-w-0">
							<p class="text-base font-bold tracking-tight text-foreground">GiveOS</p>
							<p class="truncate text-xs text-muted-foreground">by Giveo • giveo.net</p>
						</div>
					{/if}
				</div>

				<Button
					type="button"
					variant="ghost"
					size="icon"
					class="size-8 text-muted-foreground hover:text-foreground"
					onclick={toggleSidebar}
					title={isCollapsed ? 'Expandir barra lateral' : 'Comprimir barra lateral'}
				>
					{#if isCollapsed}
						<PanelLeftOpen class="size-4" />
					{:else}
						<PanelLeftClose class="size-4" />
					{/if}
				</Button>
			</div>

			<!-- Tarjeta del Negocio (modo expandido vs colapsado) -->
			{#if !isCollapsed}
				<div class="mt-4 space-y-2.5 rounded-xl border border-border bg-muted/30 p-3.5">
					<div class="flex items-center justify-between gap-2">
						<span
							class="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
						>
							<Store class="size-3.5" />
							Mi Negocio
						</span>

						<span
							class="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground"
							title={openStatus.isOpen
								? `Abierto ahora (${openStatus.activeBlock?.open}–${openStatus.activeBlock?.close})`
								: 'Cerrado en este momento'}
						>
							<span
								class="size-2 rounded-full {openStatus.isOpen ? 'bg-emerald-500' : 'bg-red-500'}"
							></span>
							<span>{openStatus.isOpen ? 'Abierto' : 'Cerrado'}</span>
						</span>
					</div>

					<p class="truncate text-sm font-semibold text-foreground">{activeBusiness.name}</p>

					{#if activeBusiness.whatsapp}
						<p class="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
							<Phone class="size-3 shrink-0" />
							<span>{activeBusiness.whatsapp}</span>
						</p>
					{/if}

					<div class="flex items-center justify-between border-t border-border/60 pt-2">
						<span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
							<Clock class="size-3" />
							<span>Horarios</span>
						</span>
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="h-6 px-2.5 text-xs"
							onclick={() => (showScheduleModal = true)}
						>
							Ver
						</Button>
					</div>
				</div>
			{:else}
				<div class="mt-3 flex justify-center">
					<button
						type="button"
						onclick={() => (showScheduleModal = true)}
						class="flex size-8 items-center justify-center rounded-lg border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors"
						title="{activeBusiness.name} — {openStatus.isOpen ? 'Abierto' : 'Cerrado'} (Clic para ver horarios)"
					>
						<span
							class="size-2.5 rounded-full {openStatus.isOpen ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-red-500 ring-2 ring-red-500/20'}"
						></span>
					</button>
				</div>
			{/if}
		</div>

		<!-- Menú de Navegación Principal -->
		<nav class="flex-1 space-y-1.5 overflow-y-auto {isCollapsed ? 'p-2' : 'p-4'}">
			<div class="pb-2">
				{#if !isCollapsed}
					<Button href="/orders/new" variant="tertiary" class="w-full justify-center gap-2 shadow-xs font-semibold">
						<ShoppingCart class="size-4" />
						<span>Nueva Orden</span>
					</Button>
				{:else}
					<Button
						href="/orders/new"
						variant="tertiary"
						size="icon"
						class="w-full h-10 justify-center shadow-xs"
						title="Nueva Orden"
					>
						<ShoppingCart class="size-4" />
					</Button>
				{/if}
			</div>

			{#if !isCollapsed}
				<p class="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
					Menú Principal
				</p>
			{/if}

			{#each navItems as item (item.id)}
				{@const Icon = item.icon}
				{@const active = currentSection === item.id}
				<a
					href={item.href}
					title={item.label}
					class="flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors {isCollapsed
						? 'justify-center px-0'
						: 'px-3.5'} {active
						? 'bg-primary text-primary-foreground shadow-xs'
						: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
				>
					<Icon class="size-4 shrink-0" />
					{#if !isCollapsed}
						<span class="truncate">{item.label}</span>
					{/if}
				</a>
			{/each}
		</nav>

		<!-- Pie del Sidebar: Usuario y Cerrar sesión -->
		<div class="shrink-0 border-t border-border {isCollapsed ? 'p-2' : 'p-4'}">
			{#if !isCollapsed}
				<div class="flex items-center justify-between gap-3 rounded-xl bg-muted/30 p-3">
					<div class="min-w-0">
						<p class="truncate text-sm font-medium text-foreground">{user.name}</p>
						<p class="truncate text-xs text-muted-foreground">{user.email}</p>
					</div>
					<form method="POST" action="/?/signOut" use:enhance>
						<Button
							type="submit"
							variant="ghost"
							size="icon"
							class="size-8 text-muted-foreground hover:text-destructive"
							title="Cerrar sesión"
						>
							<LogOut class="size-4" />
						</Button>
					</form>
				</div>
			{:else}
				<div class="flex flex-col items-center gap-2">
					<div
						class="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
						title="{user.name} ({user.email})"
					>
						{user.name.charAt(0).toUpperCase()}
					</div>
					<form method="POST" action="/?/signOut" use:enhance>
						<Button
							type="submit"
							variant="ghost"
							size="icon"
							class="size-8 text-muted-foreground hover:text-destructive"
							title="Cerrar sesión"
						>
							<LogOut class="size-4" />
						</Button>
					</form>
				</div>
			{/if}
		</div>
	</aside>

	<!-- Contenedor Derecho: Barra móvil + Encabezado de sección + Contenido -->
	<div class="flex h-full min-w-0 flex-1 flex-col overflow-y-auto">
		<!-- Barra superior compacta para pantallas móviles (< lg) -->
		<div
			class="shrink-0 flex items-center justify-between gap-2 border-b border-border bg-background px-4 py-2.5 sm:px-6 lg:hidden"
		>
			<div class="flex min-w-0 items-center gap-2.5">
				<div
					class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground shadow-2xs"
				>
					<ScanFace class="size-4.5" />
				</div>
				<span class="truncate text-sm font-bold text-foreground max-w-[140px] sm:max-w-[240px]">
					{activeBusiness.name}
				</span>
				<button
					type="button"
					onclick={() => (showScheduleModal = true)}
					class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium transition-colors hover:bg-muted"
					title="Ver horarios de atención"
				>
					<span
						class="size-2 rounded-full {openStatus.isOpen ? 'bg-emerald-500' : 'bg-red-500'}"
					></span>
					<span>{openStatus.isOpen ? 'Abierto' : 'Cerrado'}</span>
				</button>
			</div>

			<div class="flex shrink-0 items-center gap-1.5">
				<ThemeToggle />
				<div
					class="flex size-7 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary"
					title="{user.name} ({user.email})"
				>
					{user.name.charAt(0).toUpperCase()}
				</div>
				<form method="POST" action="/?/signOut" use:enhance>
					<Button
						type="submit"
						variant="ghost"
						size="icon"
						class="size-8 text-muted-foreground hover:text-destructive"
						title="Cerrar sesión"
					>
						<LogOut class="size-4" />
					</Button>
				</form>
			</div>
		</div>

		<!-- Encabezado superior de la sección activa -->
		<header class="shrink-0 border-b border-border bg-background">
			<div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4 lg:px-8">
				<div class="space-y-1 min-w-0">
					<div class="flex flex-wrap items-center gap-2">
						<h1 class="text-lg sm:text-2xl font-bold tracking-tight text-foreground">{title}</h1>
						<Badge variant="outline" class="hidden text-xs lg:inline-flex">
							{activeBusiness.name}
						</Badge>
					</div>
					<p class="text-xs sm:text-sm text-muted-foreground">{description}</p>
				</div>

				{#if headerActions}
					<div class="flex items-center gap-2 sm:gap-3 shrink-0">
						{@render headerActions()}
						<div class="hidden h-5 w-px bg-border lg:block"></div>
						<div class="hidden lg:block">
							<ThemeToggle />
						</div>
					</div>
				{:else}
					<div class="hidden items-center gap-3 shrink-0 lg:flex">
						<ThemeToggle />
					</div>
				{/if}
			</div>
		</header>

		<!-- Contenido principal de la página (con espaciado inferior para el Bottom Dock en mobile) -->
		<main class="w-full flex-1 space-y-6 px-4 pt-4 pb-28 sm:px-6 sm:pt-5 lg:px-8 lg:py-6">
			{@render children()}
		</main>
	</div>

	<!-- Bottom Dock de Navegación Mobile (< lg): 2 secciones + Botón Central + 2 secciones -->
	<nav
		aria-label="Navegación principal móvil"
		class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.08)] lg:hidden"
	>
		<div class="mx-auto grid h-16 max-w-lg grid-cols-5 items-center px-2">
			<!-- 2 Ítems Izquierdos (Inicio, Órdenes) -->
			{#each leftDockItems as item (item.id)}
				{@const Icon = item.icon}
				{@const active =
					currentSection === item.id && !(item.id === 'orders' && isNewOrderRoute)}
				<a
					href={item.href}
					class="group flex flex-col items-center justify-center gap-1 py-1.5 text-center transition-colors {active
						? 'text-primary'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					<div
						class="flex h-7 w-11 items-center justify-center rounded-full transition-colors {active
							? 'bg-primary/12 text-primary'
							: 'group-hover:bg-muted/60'}"
					>
						<Icon class="size-4.5 shrink-0" />
					</div>
					<span class="text-[10px] leading-none {active ? 'font-bold' : 'font-medium'}">
						{item.mobileLabel}
					</span>
				</a>
			{/each}

			<!-- Botón Central Destacado: Nueva Orden (preparado para futura acción "Continuar Orden") -->
			<div class="flex flex-col items-center justify-center">
				<a
					href="/orders/new"
					aria-label="Nueva Orden"
					title="Nueva Orden"
					class="group relative -mt-6 flex flex-col items-center justify-center focus-visible:outline-none"
				>
					<div
						class="flex size-13 items-center justify-center rounded-2xl shadow-lg ring-4 ring-background transition-all duration-150 group-active:scale-95 {isNewOrderRoute
							? 'bg-primary text-primary-foreground shadow-primary/30'
							: 'bg-tertiary text-tertiary-foreground hover:brightness-95'}"
					>
						<ShoppingCart class="size-5.5 stroke-[2.25]" />
					</div>
					<span
						class="mt-1 text-[10px] leading-none font-bold tracking-tight {isNewOrderRoute
							? 'text-primary'
							: 'text-foreground'}"
					>
						Nueva Orden
					</span>
				</a>
			</div>

			<!-- 2 Ítems Derechos (Inventario, Ajustes) -->
			{#each rightDockItems as item (item.id)}
				{@const Icon = item.icon}
				{@const active = currentSection === item.id}
				<a
					href={item.href}
					class="group flex flex-col items-center justify-center gap-1 py-1.5 text-center transition-colors {active
						? 'text-primary'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					<div
						class="flex h-7 w-11 items-center justify-center rounded-full transition-colors {active
							? 'bg-primary/12 text-primary'
							: 'group-hover:bg-muted/60'}"
					>
						<Icon class="size-4.5 shrink-0" />
					</div>
					<span class="text-[10px] leading-none {active ? 'font-bold' : 'font-medium'}">
						{item.mobileLabel}
					</span>
				</a>
			{/each}
		</div>
	</nav>
</div>

<!-- Modal de Horarios de Atención -->
{#if showScheduleModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
		role="dialog"
		aria-modal="true"
		aria-labelledby="schedule-modal-title"
	>
		<div class="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
			<div class="flex items-start justify-between gap-4 border-b border-border p-5">
				<div class="space-y-1">
					<div class="flex items-center gap-2">
						<span
							class="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-foreground"
						>
							<span
								class="size-2 rounded-full {openStatus.isOpen ? 'bg-emerald-500' : 'bg-red-500'}"
							></span>
							<span>{openStatus.isOpen ? 'Abierto ahora' : 'Cerrado ahora'}</span>
						</span>
					</div>
					<h2 id="schedule-modal-title" class="text-lg font-bold text-foreground">
						Horarios de {activeBusiness.name}
					</h2>
				</div>
				<Button
					type="button"
					size="icon"
					variant="ghost"
					class="size-8 text-muted-foreground hover:text-foreground"
					onclick={() => (showScheduleModal = false)}
					title="Cerrar"
				>
					<X class="size-4" />
				</Button>
			</div>

			<div class="space-y-3 p-5">
				{#if parsedSchedule}
					<div class="divide-y divide-border/60 rounded-xl border border-border bg-background">
						{#each parsedSchedule as dayItem (dayItem.day)}
							{@const isToday = dayItem.day === openStatus.todayKey}
							<div
								class="flex items-center justify-between gap-3 px-4 py-2.5 text-xs {isToday
									? 'bg-primary/5 font-semibold'
									: ''}"
							>
								<div class="flex items-center gap-2">
									<span class="text-foreground">{dayItem.label}</span>
									{#if isToday}
										<Badge variant="secondary" class="px-1.5 py-0 text-[10px]">Hoy</Badge>
									{/if}
								</div>

								{#if dayItem.enabled && dayItem.blocks.length > 0}
									<span class="font-mono text-foreground">
										{dayItem.blocks.map((b) => `${b.open}–${b.close}`).join(' / ')}
									</span>
								{:else}
									<span class="italic text-muted-foreground">Cerrado</span>
								{/if}
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-muted-foreground">
						{activeBusiness.openingHours || 'Sin horarios configurados.'}
					</p>
				{/if}
			</div>

			<div class="flex items-center justify-between gap-3 border-t border-border bg-muted/20 px-5 py-3.5">
				<Button
					href="/settings"
					variant="outline"
					size="sm"
					onclick={() => (showScheduleModal = false)}
				>
					Editar horarios
				</Button>
				<Button type="button" size="sm" onclick={() => (showScheduleModal = false)}>
					Cerrar
				</Button>
			</div>
		</div>
	</div>
{/if}
