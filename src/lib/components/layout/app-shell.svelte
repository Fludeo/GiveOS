<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance } from '$app/forms';
	import {
		getBusinessOpenStatus,
		parseWeeklySchedule,
		type Business,
		type BusinessRole
	} from '#lib/features/businesses/domain/business.entity';
	import type { AuthUser } from '#lib/features/auth/domain/auth.entity';
	import { Button } from '#lib/components/ui/button';
	import { Badge } from '#lib/components/ui/badge';
	import CakeSlice from '@lucide/svelte/icons/cake-slice';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import Package from '@lucide/svelte/icons/package';
	import Settings from '@lucide/svelte/icons/settings';
	import Store from '@lucide/svelte/icons/store';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Phone from '@lucide/svelte/icons/phone';
	import Clock from '@lucide/svelte/icons/clock';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';

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

	const openStatus = $derived(getBusinessOpenStatus(activeBusiness.openingHours));
	const parsedSchedule = $derived(parseWeeklySchedule(activeBusiness.openingHours));

	const navItems = $derived([
		{
			id: 'dashboard' as const,
			label: 'Dashboard',
			href: '/dashboard',
			icon: LayoutDashboard
		},
		{
			id: 'orders' as const,
			label: 'Órdenes',
			href: '/orders',
			icon: ShoppingBag
		},
		{
			id: 'inventory' as const,
			label: 'Inventario y Recetas',
			href: '/inventory',
			icon: Package
		},
		{
			id: 'settings' as const,
			label: 'Configuración',
			href: '/settings',
			icon: Settings
		}
	]);
</script>

<div class="flex h-screen h-dvh w-full overflow-hidden bg-muted/20">
	<!-- Sidebar lateral fijo en escritorio (siempre de la altura de la pantalla) -->
	<aside class="hidden h-full w-72 shrink-0 flex-col border-r border-border bg-background lg:flex">
		<!-- Logo e Información del Negocio -->
		<div class="shrink-0 space-y-4 border-b border-border p-6">
			<div class="flex items-center gap-3">
				<div class="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
					<CakeSlice class="size-5" />
				</div>
				<div class="min-w-0">
					<p class="text-base font-bold tracking-tight text-foreground">GiveOS</p>
					<p class="truncate text-xs text-muted-foreground">by Giveo • giveo.net</p>
				</div>
			</div>

			<!-- Tarjeta del Negocio -->
			<div class="space-y-2.5 rounded-xl border border-border bg-muted/30 p-3.5">
				<div class="flex items-center justify-between gap-2">
					<span class="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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
		</div>

		<!-- Menú de Navegación Principal -->
		<nav class="flex-1 space-y-1.5 overflow-y-auto p-4">
			<div class="pb-3">
				<Button href="/orders/new" class="w-full justify-center gap-2 shadow-xs">
					<Plus class="size-4" />
					<span>Nueva Orden de Compra</span>
				</Button>
			</div>

			<p class="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
				Menú Principal
			</p>
			{#each navItems as item (item.id)}
				{@const Icon = item.icon}
				{@const active = currentSection === item.id}
				<a
					href={item.href}
					class="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors {active
						? 'bg-primary text-primary-foreground shadow-xs'
						: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
				>
					<Icon class="size-4 shrink-0" />
					<span>{item.label}</span>
				</a>
			{/each}
		</nav>

		<!-- Pie del Sidebar: Usuario y Cerrar sesión -->
		<div class="shrink-0 border-t border-border p-4">
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
		</div>
	</aside>

	<!-- Contenedor Derecho: Barra móvil + Encabezado de sección + Contenido (Scrollable independientemente) -->
	<div class="flex h-full min-w-0 flex-1 flex-col overflow-y-auto">
		<!-- Navegación compacta para pantallas móviles (< lg) -->
		<div class="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-6 py-3.5 lg:hidden">
			<div class="flex items-center gap-2.5">
				<div class="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
					<CakeSlice class="size-4" />
				</div>
				<span class="font-bold text-foreground">{activeBusiness.name}</span>
				<span
					class="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[11px] font-medium"
				>
					<span
						class="size-2 rounded-full {openStatus.isOpen ? 'bg-emerald-500' : 'bg-red-500'}"
					></span>
					<span>{openStatus.isOpen ? 'Abierto' : 'Cerrado'}</span>
				</span>
				<Button
					type="button"
					variant="outline"
					size="sm"
					class="h-6 px-2 text-xs"
					onclick={() => (showScheduleModal = true)}
				>
					Ver
				</Button>
			</div>
			<div class="flex flex-wrap items-center gap-1.5">
				{#each navItems as item (item.id)}
					<a
						href={item.href}
						class="rounded-lg px-3 py-1.5 text-xs font-medium {currentSection === item.id
							? 'bg-primary text-primary-foreground'
							: 'text-muted-foreground hover:bg-muted'}"
					>
						{item.label}
					</a>
				{/each}
			</div>
		</div>

		<!-- Encabezado superior de la sección activa -->
		<header class="shrink-0 border-b border-border bg-background">
			<div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 sm:px-8">
				<div class="space-y-1.5">
					<div class="flex flex-wrap items-center gap-2.5">
						<h1 class="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
						<Badge variant="outline" class="text-xs">{activeBusiness.name}</Badge>
					</div>
					<p class="text-sm text-muted-foreground">{description}</p>
				</div>

				{#if headerActions}
					<div class="flex items-center gap-3">
						{@render headerActions()}
					</div>
				{/if}
			</div>
		</header>

		<!-- Contenido principal de la página -->
		<main class="mx-auto w-full max-w-6xl flex-1 space-y-8 px-6 py-8 sm:px-8">
			{@render children()}
		</main>
	</div>
</div>

<!-- Modal de Horarios de Atención (al hacer clic en "Ver" en Mi Negocio) -->
{#if showScheduleModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
		role="dialog"
		aria-modal="true"
		aria-labelledby="schedule-modal-title"
	>
		<div class="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
			<div class="flex items-start justify-between gap-4 border-b border-border p-6">
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

			<div class="space-y-3 p-6">
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

			<div class="flex items-center justify-between gap-3 border-t border-border bg-muted/20 px-6 py-4">
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
