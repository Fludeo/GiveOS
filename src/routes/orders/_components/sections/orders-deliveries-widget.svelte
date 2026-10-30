<script lang="ts">
	import {
		isOrderReadyToDeliver,
		ORDER_STATUS_LABELS,
		type OrderWithItems
	} from '#lib/features/orders/domain/order.entity';
	import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '#lib/components/ui/card';
	import { Button } from '#lib/components/ui/button';
	import { Badge } from '#lib/components/ui/badge';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import Clock from '@lucide/svelte/icons/clock';
	import Check from '@lucide/svelte/icons/check';
	import ChefHat from '@lucide/svelte/icons/chef-hat';
	import PackageCheck from '@lucide/svelte/icons/package-check';
	import Eye from '@lucide/svelte/icons/eye';
	import Zap from '@lucide/svelte/icons/zap';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import List from '@lucide/svelte/icons/list';
	import DollarSign from '@lucide/svelte/icons/dollar-sign';
	import CalendarCheck from '@lucide/svelte/icons/calendar-check';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { formatCurrency } from '../utils';

	interface Props {
		orders: OrderWithItems[];
		onViewOrder: (order: OrderWithItems) => void;
		onPayOrder: (order: OrderWithItems) => void;
		onDeliverOrder: (order: OrderWithItems) => void;
		onConfirmOrder: (order: OrderWithItems) => void;
		onProduceOrders?: (orders: OrderWithItems[], periodLabel: string) => void;
	}

	let {
		orders,
		onViewOrder,
		onPayOrder,
		onDeliverOrder,
		onConfirmOrder,
		onProduceOrders
	}: Props = $props();

	// Tab seleccionado: 0..6 (días de la semana), 'beyond' (+7 días), o 'all' (todos los pendientes)
	type SelectedTab = number | 'beyond' | 'all';
	let selectedTab = $state<SelectedTab>(0);
	let viewMode = $state<'table' | 'cards'>('table');
	let selectedOrderIds = $state<string[]>([]);

	$effect(() => {
		void selectedTab;
		selectedOrderIds = [];
	});

	$effect(() => {
		if (typeof window !== 'undefined') {
			try {
				const saved = localStorage.getItem('giveos-deliveries-view-mode');
				if (saved === 'table' || saved === 'cards') {
					viewMode = saved;
				}
			} catch {}
		}
	});

	function toggleView(mode: 'table' | 'cards') {
		viewMode = mode;
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem('giveos-deliveries-view-mode', mode);
			} catch {}
		}
	}

	function getStartOfDay(d: Date): Date {
		return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
	}

	function isSameDay(d1: Date, d2: Date): boolean {
		return (
			d1.getFullYear() === d2.getFullYear() &&
			d1.getMonth() === d2.getMonth() &&
			d1.getDate() === d2.getDate()
		);
	}

	const now = new Date();
	const todayStart = getStartOfDay(now);
	const weekEndLimit = new Date(todayStart.getTime() + 7 * 86400000);

	// Generamos los próximos 7 días a partir de hoy
	const days = $derived.by(() => {
		const list = [];
		for (let i = 0; i < 7; i++) {
			const date = new Date(todayStart.getTime() + i * 86400000);
			const dayOfWeek = date.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
			const dayNumber = date.getDate();
			const monthShort = date.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
			const fullLabel = date.toLocaleDateString('es-AR', {
				weekday: 'long',
				day: 'numeric',
				month: 'long'
			});

			let mainLabel = '';
			if (i === 0) mainLabel = 'Hoy';
			else if (i === 1) mainLabel = 'Mañana';
			else {
				mainLabel = `${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)} ${dayNumber}`;
			}

			const dateSubLabel = `${dayNumber} ${monthShort}`;

			// Filtramos los pedidos para este día
			const dayOrders = orders
				.filter((order) => {
					if (order.status === 'cancelled') return false;

					if (i === 0) {
						// DÍA 0 (HOY):
						// 1. Programados para hoy
						if (order.deliveryDate) {
							const orderDate = new Date(order.deliveryDate);
							if (isSameDay(orderDate, date)) return true;
							// 2. Atrasados / vencidos y aún pendientes o no confirmados
							if (
								orderDate.getTime() < todayStart.getTime() &&
								(order.status === 'pending' || order.status === 'unconfirmed')
							) {
								return true;
							}
							return false;
						}
						// 3. Entrega inmediata (sin fecha pactada) y pendiente
						if (order.status === 'pending' || order.status === 'unconfirmed') {
							return true;
						}
						return false;
					} else {
						// DÍAS 1 A 6:
						if (!order.deliveryDate) return false;
						const orderDate = new Date(order.deliveryDate);
						return isSameDay(orderDate, date);
					}
				})
				.sort((a, b) => {
					// Pendientes primero, luego por horario
					if (a.status !== 'completed' && b.status === 'completed') return -1;
					if (a.status === 'completed' && b.status !== 'completed') return 1;

					const dateA = a.deliveryDate ? new Date(a.deliveryDate).getTime() : 0;
					const dateB = b.deliveryDate ? new Date(b.deliveryDate).getTime() : 0;
					return dateA - dateB;
				});

			const pendingCount = dayOrders.filter(
				(o) => o.status === 'pending' || o.status === 'unconfirmed'
			).length;

			list.push({
				index: i,
				date,
				mainLabel,
				dateSubLabel,
				fullLabel: fullLabel.charAt(0).toUpperCase() + fullLabel.slice(1),
				orders: dayOrders,
				pendingCount,
				totalCount: dayOrders.length
			});
		}
		return list;
	});

	// Pedidos a más de 7 días (Futuros)
	const beyondOrders = $derived.by(() => {
		return orders
			.filter((order) => {
				if (order.status === 'cancelled') return false;
				if (!order.deliveryDate) return false;
				const orderDate = new Date(order.deliveryDate);
				return orderDate.getTime() >= weekEndLimit.getTime();
			})
			.sort((a, b) => {
				const dateA = a.deliveryDate ? new Date(a.deliveryDate).getTime() : 0;
				const dateB = b.deliveryDate ? new Date(b.deliveryDate).getTime() : 0;
				return dateA - dateB;
			});
	});

	const beyondPendingCount = $derived(
		beyondOrders.filter((o) => o.status === 'pending' || o.status === 'unconfirmed').length
	);

	// Todos los pedidos pendientes de entrega
	const allUpcomingOrders = $derived.by(() => {
		return orders
			.filter((order) => order.status === 'pending' || order.status === 'unconfirmed')
			.sort((a, b) => {
				const dateA = a.deliveryDate ? new Date(a.deliveryDate).getTime() : 0;
				const dateB = b.deliveryDate ? new Date(b.deliveryDate).getTime() : 0;
				return dateA - dateB;
			});
	});

	const totalWeekPending = $derived(days.reduce((acc, d) => acc + d.pendingCount, 0));
	const totalPendingOverall = $derived(allUpcomingOrders.length);

	// Datos según el tab seleccionado
	const currentViewData = $derived.by(() => {
		if (selectedTab === 'all') {
			return {
				title: 'Todos los Próximos Pedidos',
				subLabel: 'Agenda cronológica completa de pedidos pendientes de entrega',
				orders: allUpcomingOrders,
				pendingCount: allUpcomingOrders.length
			};
		}
		if (selectedTab === 'beyond') {
			return {
				title: 'Entregas a más de 7 días (Futuros)',
				subLabel: `Pedidos programados con fecha posterior al ${days[6].dateSubLabel}`,
				orders: beyondOrders,
				pendingCount: beyondPendingCount
			};
		}
		const day = days[selectedTab] ?? days[0];
		return {
			title: day.fullLabel,
			subLabel: selectedTab === 0 ? 'Entregas programadas para hoy, pedidos inmediatos y atrasados' : `Entregas programadas para el ${day.fullLabel}`,
			orders: day.orders,
			pendingCount: day.pendingCount
		};
	});

	const producibleOrdersInView = $derived(
		currentViewData.orders.filter(
			(o) => o.status === 'pending' && o.items.some((i) => i.status === 'pending_delivery')
		)
	);

	const selectedProducibleOrders = $derived(
		producibleOrdersInView.filter((o) => selectedOrderIds.includes(o.id))
	);

	function toggleSelectOrder(orderId: string) {
		if (selectedOrderIds.includes(orderId)) {
			selectedOrderIds = selectedOrderIds.filter((id) => id !== orderId);
		} else {
			selectedOrderIds = [...selectedOrderIds, orderId];
		}
	}

	function toggleSelectAllProducible() {
		if (selectedProducibleOrders.length === producibleOrdersInView.length) {
			selectedOrderIds = [];
		} else {
			selectedOrderIds = producibleOrdersInView.map((o) => o.id);
		}
	}

	function handleBatchProduce() {
		if (!onProduceOrders) return;
		const target =
			selectedProducibleOrders.length > 0 ? selectedProducibleOrders : producibleOrdersInView;
		if (target.length > 0) {
			onProduceOrders(target, currentViewData.title);
		}
	}

	function getTimingInfo(order: OrderWithItems): {
		label: string;
		timeText: string;
		isOverdue: boolean;
		isImmediate: boolean;
		badgeClass: string;
	} {
		if (!order.deliveryDate) {
			return {
				label: 'Inmediata',
				timeText: 'Inmediata',
				isOverdue: false,
				isImmediate: true,
				badgeClass: 'bg-muted text-muted-foreground border-border'
			};
		}
		const d = new Date(order.deliveryDate);
		const time = d.getTime();

		if (time < todayStart.getTime() && (order.status === 'pending' || order.status === 'unconfirmed')) {
			const dateStr = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
			return {
				label: `Atrasado (${dateStr})`,
				timeText: `${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs`,
				isOverdue: true,
				isImmediate: false,
				badgeClass: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 font-bold'
			};
		}

		// Si es hoy
		if (isSameDay(d, now)) {
			const timeStr = `${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs`;
			return {
				label: `Hoy • ${timeStr}`,
				timeText: timeStr,
				isOverdue: false,
				isImmediate: false,
				badgeClass: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30 font-bold'
			};
		}

		// Si es mañana
		const tomorrow = new Date(todayStart.getTime() + 86400000);
		if (isSameDay(d, tomorrow)) {
			const timeStr = `${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs`;
			return {
				label: `Mañana • ${timeStr}`,
				timeText: timeStr,
				isOverdue: false,
				isImmediate: false,
				badgeClass: 'bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30 font-semibold'
			};
		}

		// Para días posteriores
		const dateStr = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
		const timeStr = `${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs`;
		return {
			label: `${dateStr} • ${timeStr}`,
			timeText: timeStr,
			isOverdue: false,
			isImmediate: false,
			badgeClass: 'bg-muted/80 text-foreground border-border font-medium'
		};
	}
</script>

<div class="space-y-4">
	<!-- Tarjetas de Resumen Rápido de la Agenda (Compactas en mobile) -->
	<div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
		<div class="rounded-2xl border border-border bg-card p-3 sm:p-5 shadow-xs space-y-1.5 sm:space-y-2">
			<span class="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground block truncate">
				Para Hoy
			</span>
			<div class="flex items-center gap-2 sm:gap-3 pt-0.5">
				<div
					class="flex size-8 sm:size-10 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl {days[0].pendingCount > 0
						? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
						: 'bg-muted text-muted-foreground'}"
				>
					<Clock class="size-4 sm:size-5" />
				</div>
				<div class="font-mono text-lg sm:text-2xl font-bold tracking-tight text-foreground">
					{days[0].pendingCount}
				</div>
			</div>
			<p class="text-[11px] sm:text-xs text-muted-foreground truncate">
				{days[0].pendingCount > 0 ? 'Entregas hoy' : 'Sin entregas hoy'}
			</p>
		</div>

		<div class="rounded-2xl border border-border bg-card p-3 sm:p-5 shadow-xs space-y-1.5 sm:space-y-2">
			<span class="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground block truncate">
				Próximos 7 Días
			</span>
			<div class="flex items-center gap-2 sm:gap-3 pt-0.5">
				<div class="flex size-8 sm:size-10 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-primary/10 text-primary">
					<CalendarDays class="size-4 sm:size-5" />
				</div>
				<div class="font-mono text-lg sm:text-2xl font-bold tracking-tight text-foreground">
					{totalWeekPending}
				</div>
			</div>
			<p class="text-[11px] sm:text-xs text-muted-foreground truncate">
				Esta semana
			</p>
		</div>

		<div class="col-span-2 sm:col-span-1 rounded-2xl border border-border bg-card p-3 sm:p-5 shadow-xs space-y-1.5 sm:space-y-2">
			<span class="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground block truncate">
				Total Pedidos Pendientes
			</span>
			<div class="flex items-center gap-2 sm:gap-3 pt-0.5">
				<div class="flex size-8 sm:size-10 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-sky-500/15 text-sky-700 dark:text-sky-300">
					<CalendarClock class="size-4 sm:size-5" />
				</div>
				<div class="font-mono text-lg sm:text-2xl font-bold tracking-tight text-foreground">
					{totalPendingOverall}
				</div>
				<span class="text-[11px] text-muted-foreground sm:hidden ml-auto">
					{beyondPendingCount > 0 ? `${beyondPendingCount} a +7 días` : 'Todo en 7 días'}
				</span>
			</div>
			<p class="hidden sm:block text-xs text-muted-foreground">
				{beyondPendingCount > 0 ? `${beyondPendingCount} a más de 7 días` : 'Todo dentro de los 7 días'}
			</p>
		</div>
	</div>

	<!-- Contenedor Principal de la Agenda -->
	<Card>
		<CardHeader class="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-border/60 bg-muted/10 space-y-4">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div class="flex items-center gap-2.5">
					<div class="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<CalendarClock class="size-5" />
					</div>
					<div>
						<div class="flex items-center gap-2">
							<h2 class="text-base sm:text-lg font-bold text-foreground">
								Agenda de Próximos Pedidos y Entregas
							</h2>
							{#if totalPendingOverall > 0}
								<Badge variant="outline" class="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold text-[11px]">
									{totalPendingOverall} en espera
								</Badge>
							{:else}
								<Badge variant="outline" class="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-success/90 text-[11px]">
									Al día
								</Badge>
							{/if}
						</div>
						<p class="text-xs text-muted-foreground">
							Cronograma ordenado por fecha y hora para organizar la producción y despachos
						</p>
					</div>
				</div>

				<!-- Selector de Formato: Mini Tabla o Tarjetas -->
				<div class="inline-flex items-center rounded-lg border border-border bg-background p-0.5 shadow-2xs">
					<button
						type="button"
						onclick={() => toggleView('table')}
						class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer {viewMode ===
						'table'
							? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
							: 'text-muted-foreground hover:text-foreground'}"
						title="Vista de Mini Tabla"
					>
						<List class="size-3.5" />
						<span class="hidden sm:inline">Mini Tabla</span>
					</button>
					<button
						type="button"
						onclick={() => toggleView('cards')}
						class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer {viewMode ===
						'cards'
							? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
							: 'text-muted-foreground hover:text-foreground'}"
						title="Vista de Tarjetas"
					>
						<LayoutGrid class="size-3.5" />
						<span class="hidden sm:inline">Tarjetas</span>
					</button>
				</div>
			</div>

			<!-- Barra de Pestañas: 7 Días + "+7 Días" + "Todos" -->
			<div class="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-thin">
				{#each days as day (day.index)}
					{@const isSelected = selectedTab === day.index}
					<button
						type="button"
						onclick={() => (selectedTab = day.index)}
						class="flex flex-col items-center justify-center min-w-[82px] sm:min-w-[96px] flex-1 py-2 px-2 rounded-xl border text-xs transition-all cursor-pointer {isSelected
							? 'bg-primary text-primary-foreground border-primary shadow-xs font-semibold'
							: 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground hover:bg-muted/30'}"
					>
						<div class="flex items-center gap-1.5">
							<span class="text-xs font-bold leading-tight">{day.mainLabel}</span>
							{#if day.pendingCount > 0}
								<span
									class="size-2 rounded-full shrink-0 {isSelected
										? 'bg-primary-foreground'
										: 'bg-amber-500 animate-pulse'}"
									title="{day.pendingCount} entregas pendientes"
								></span>
							{/if}
						</div>
						<div class="flex items-center gap-1.5 mt-0.5">
							<span
								class="text-[11px] {isSelected
									? 'text-primary-foreground/80'
									: 'text-muted-foreground'}"
							>
								{day.dateSubLabel}
							</span>
							{#if day.pendingCount > 0}
								<span
									class="rounded-full px-1.5 py-0.2 text-[10px] font-bold font-mono {isSelected
										? 'bg-primary-foreground/20 text-primary-foreground'
										: 'bg-amber-500/15 text-amber-700 dark:text-amber-400'}"
								>
									{day.pendingCount}
								</span>
							{/if}
						</div>
					</button>
				{/each}

				<!-- Pestaña: +7 Días (Futuros) -->
				<button
					type="button"
					onclick={() => (selectedTab = 'beyond')}
					class="flex flex-col items-center justify-center min-w-[84px] sm:min-w-[98px] py-2 px-2.5 rounded-xl border text-xs transition-all cursor-pointer {selectedTab === 'beyond'
						? 'bg-primary text-primary-foreground border-primary shadow-xs font-semibold'
						: 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground hover:bg-muted/30'}"
				>
					<div class="flex items-center gap-1">
						<span class="text-xs font-bold leading-tight">+7 Días</span>
						{#if beyondPendingCount > 0}
							<span
								class="size-2 rounded-full shrink-0 {selectedTab === 'beyond'
									? 'bg-primary-foreground'
									: 'bg-amber-500'}"
							></span>
						{/if}
					</div>
					<div class="flex items-center gap-1.5 mt-0.5">
						<span class="text-[11px] {selectedTab === 'beyond' ? 'text-primary-foreground/80' : 'text-muted-foreground'}">
							Futuros
						</span>
						{#if beyondPendingCount > 0}
							<span
								class="rounded-full px-1.5 py-0.2 text-[10px] font-bold font-mono {selectedTab === 'beyond'
									? 'bg-primary-foreground/20 text-primary-foreground'
									: 'bg-amber-500/15 text-amber-700 dark:text-amber-400'}"
							>
								{beyondPendingCount}
							</span>
						{/if}
					</div>
				</button>

				<!-- Pestaña: Todos los Pendientes -->
				<button
					type="button"
					onclick={() => (selectedTab = 'all')}
					class="flex flex-col items-center justify-center min-w-[80px] sm:min-w-[90px] py-2 px-2.5 rounded-xl border text-xs transition-all cursor-pointer {selectedTab === 'all'
						? 'bg-primary text-primary-foreground border-primary shadow-xs font-semibold'
						: 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground hover:bg-muted/30'}"
				>
					<span class="text-xs font-bold leading-tight">Todos</span>
					<div class="flex items-center gap-1.5 mt-0.5">
						<span class="text-[11px] {selectedTab === 'all' ? 'text-primary-foreground/80' : 'text-muted-foreground'}">
							Agenda
						</span>
						{#if totalPendingOverall > 0}
							<span
								class="rounded-full px-1.5 py-0.2 text-[10px] font-bold font-mono {selectedTab === 'all'
									? 'bg-primary-foreground/20 text-primary-foreground'
									: 'bg-muted text-muted-foreground font-semibold'}"
							>
								{totalPendingOverall}
							</span>
						{/if}
					</div>
				</button>
			</div>
		</CardHeader>

		<CardContent class="p-4 sm:p-6">
			<!-- Subcabecera del filtro activo -->
			<div class="flex flex-wrap items-center justify-between gap-2 mb-4 pb-2.5 border-b border-border/40 text-xs text-muted-foreground">
				<div class="flex items-center gap-2">
					<span class="font-bold text-foreground text-sm">{currentViewData.title}</span>
					{#if selectedTab === 0}
						<Badge variant="outline" class="text-[10px] bg-primary/5 text-primary border-primary/20">
							Hoy
						</Badge>
					{/if}
					<span>
						· {currentViewData.orders.length} {currentViewData.orders.length === 1 ? 'pedido' : 'pedidos'}
						({currentViewData.pendingCount} por entregar)
					</span>
				</div>

				{#if producibleOrdersInView.length > 0 && onProduceOrders}
					<Button
						type="button"
						size="sm"
						variant="default"
						class="h-8 gap-1.5 text-xs font-semibold shadow-2xs"
						onclick={handleBatchProduce}
					>
						<ChefHat class="size-3.5" />
						{#if selectedProducibleOrders.length > 0}
							<span>Producir Seleccionados ({selectedProducibleOrders.length})</span>
						{:else}
							<span>Producir Pendientes ({producibleOrdersInView.length})</span>
						{/if}
					</Button>
				{/if}
			</div>

			{#if currentViewData.orders.length === 0}
				<!-- Estado Vacío -->
				<div class="flex flex-col items-center justify-center py-12 px-4 text-center rounded-2xl bg-muted/10 border border-dashed border-border space-y-2">
					<div class="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 mb-1">
						<CalendarCheck class="size-6" />
					</div>
					<h3 class="text-sm font-bold text-foreground">
						{#if selectedTab === 'beyond'}
							Sin entregas programadas a más de 7 días
						{:else if selectedTab === 'all'}
							¡No tienes pedidos pendientes de entrega!
						{:else}
							Sin entregas para este día
						{/if}
					</h3>
					<p class="mt-1 text-xs text-muted-foreground max-w-sm">
						{#if selectedTab === 'beyond'}
							No hay pedidos con fecha de entrega posterior a la próxima semana.
						{:else if selectedTab === 'all'}
							Todas las órdenes han sido completadas o no hay entregas agendadas.
						{:else}
							Todos los pedidos para esta fecha están al día o no hay entregas programadas.
						{/if}
					</p>
				</div>
			{:else if viewMode === 'table'}
				<!-- VISTA: MINI TABLA -->
				<div class="overflow-x-auto rounded-xl border border-border bg-card">
					<table class="w-full text-left text-xs border-collapse">
						<thead>
							<tr class="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
								{#if producibleOrdersInView.length > 0 && onProduceOrders}
									<th class="py-2.5 pl-3 pr-1 w-8">
										<input
											type="checkbox"
											checked={selectedProducibleOrders.length === producibleOrdersInView.length && producibleOrdersInView.length > 0}
											onchange={toggleSelectAllProducible}
											title="Seleccionar todos los pedidos en preparación"
											class="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
										/>
									</th>
								{/if}
								<th class="py-2.5 px-3">Horario</th>
								<th class="py-2.5 px-3">Orden</th>
								<th class="py-2.5 px-3">Cliente</th>
								<th class="py-2.5 px-3 min-w-[200px]">Productos a Entregar</th>
								<th class="py-2.5 px-3">Pago</th>
								<th class="py-2.5 px-3 text-right">Total</th>
								<th class="py-2.5 px-3 text-right">Acciones</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border">
							{#each currentViewData.orders as order (order.id)}
								{@const timing = getTimingInfo(order)}
								{@const isDone = order.status === 'completed'}
								{@const isReady = isOrderReadyToDeliver(order)}
								{@const canProduce = order.status === 'pending' && order.items.some((i) => i.status === 'pending_delivery')}
								<tr
									class="transition-colors hover:bg-muted/30 {isDone
										? 'opacity-60 bg-muted/10'
										: isReady
											? 'bg-emerald-500/5'
											: timing.isOverdue
												? 'bg-red-500/5'
												: ''}"
								>
									{#if producibleOrdersInView.length > 0 && onProduceOrders}
										<td class="py-3 pl-3 pr-1 align-top">
											{#if canProduce}
												<input
													type="checkbox"
													checked={selectedOrderIds.includes(order.id)}
													onchange={() => toggleSelectOrder(order.id)}
													class="mt-1 size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
												/>
											{/if}
										</td>
									{/if}
									<!-- Horario / Urgencia -->
									<td class="py-3 px-3 align-top whitespace-nowrap">
										<span
											class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs {timing.badgeClass}"
										>
											{#if timing.isOverdue}
												<AlertCircle class="size-3 shrink-0" />
											{:else if timing.isImmediate}
												<Zap class="size-3 shrink-0" />
											{:else}
												<Clock class="size-3 shrink-0" />
											{/if}
											<span>{timing.label}</span>
										</span>
									</td>

									<!-- Número de Orden & Estado -->
									<td class="py-3 px-3 align-top whitespace-nowrap">
										<div class="space-y-0.5">
											<button
												type="button"
												onclick={() => onViewOrder(order)}
												class="font-mono font-bold text-foreground hover:underline text-xs cursor-pointer block"
											>
												{order.orderNumber}
											</button>
											{#if order.status === 'completed'}
												<span class="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600">
													<Check class="size-2.5" /> Entregada
												</span>
											{:else if isReady}
												<span class="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-success/90">
													<PackageCheck class="size-3" /> Listo p/ retirar
												</span>
											{:else if order.status === 'unconfirmed'}
												<span class="text-[10px] font-bold text-amber-600">
													Por Confirmar
												</span>
											{:else}
												<span class="text-[10px] font-medium text-muted-foreground">
													En preparación
												</span>
											{/if}
										</div>
									</td>

									<!-- Cliente y Notas -->
									<td class="py-3 px-3 align-top">
										<div class="font-bold text-foreground text-xs">{order.customerName}</div>
										{#if order.notes}
											<div class="text-[11px] text-muted-foreground italic line-clamp-1 mt-0.5" title={order.notes}>
												"{order.notes}"
											</div>
										{/if}
									</td>

									<!-- Productos a Entregar -->
									<td class="py-3 px-3 align-top">
										<div class="space-y-1">
											{#each order.items as item (item.id)}
												<div class="flex items-center gap-1.5 text-xs">
													<span class="font-mono font-bold text-foreground bg-muted/80 px-1.5 py-0.2 rounded text-[11px] shrink-0">
														{item.quantity}x
													</span>
													<span class="font-medium text-foreground truncate max-w-[220px]" title={item.productName}>
														{item.productName}
													</span>
													{#if item.status === 'delivered'}
														<span class="text-[10px] font-semibold text-emerald-600 ml-1 shrink-0" title="Entregado">
															✓
														</span>
													{:else if item.status === 'ready'}
														<span class="rounded bg-emerald-500/15 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 ml-1 shrink-0">
															Listo
														</span>
													{/if}
												</div>
											{/each}
										</div>
									</td>

									<!-- Estado de Pago -->
									<td class="py-3 px-3 align-top whitespace-nowrap">
										{#if order.status === 'completed' || order.paymentStatus === 'paid'}
											<Badge variant="outline" class="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-success/90 text-[10px]">
												Pagado
											</Badge>
										{:else if order.paymentStatus === 'partially_paid'}
											<div class="space-y-0.5">
												<Badge variant="outline" class="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px]">
													Pago Parcial
												</Badge>
												<div class="text-[10px] font-mono text-muted-foreground">
													Resta {formatCurrency(Math.max(0, order.totalAmount - order.paidAmount))}
												</div>
											</div>
										{:else}
											<Badge variant="outline" class="border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400 text-[10px]">
												Pendiente
											</Badge>
										{/if}
									</td>

									<!-- Monto Total -->
									<td class="py-3 px-3 align-top text-right whitespace-nowrap">
										<div class="font-mono font-bold text-xs text-foreground">
											{formatCurrency(order.totalAmount)}
										</div>
									</td>

									<!-- Acciones Rápidas -->
									<td class="py-3 px-3 align-top text-right whitespace-nowrap">
										<div class="flex items-center justify-end gap-1.5">
											{#if order.status === 'unconfirmed'}
												<Button
													size="sm"
													variant="outline"
													class="h-7 px-2 text-xs border-amber-500/30 text-amber-700 hover:bg-amber-500/10"
													onclick={() => onConfirmOrder(order)}
												>
													<Zap class="size-3 mr-1" />
													Confirmar
												</Button>
											{:else if order.status === 'pending'}
												{#if canProduce && onProduceOrders}
													<Button
														size="sm"
														variant="outline"
														class="h-7 px-2 text-xs border-primary/30 text-primary hover:bg-primary/10"
														title="Marcar pedido como Listo y descontar insumos ahora"
														onclick={() => onProduceOrders([order], order.orderNumber)}
													>
														<ChefHat class="size-3 mr-1" />
														Listo
													</Button>
												{/if}
												<Button
													size="sm"
													variant="default"
													class="h-7 px-2 text-xs"
													onclick={() => onDeliverOrder(order)}
												>
													<Check class="size-3 mr-1" />
													Entregar
												</Button>
											{/if}

											{#if order.paymentStatus !== 'paid' && order.status !== 'completed'}
												<Button
													size="sm"
													variant="outline"
													class="h-7 w-7 p-0"
													title="Registrar Cobro"
													onclick={() => onPayOrder(order)}
												>
													<DollarSign class="size-3.5 text-muted-foreground" />
												</Button>
											{/if}

											<Button
												size="sm"
												variant="ghost"
												class="h-7 w-7 p-0"
												title="Ver Detalle"
												onclick={() => onViewOrder(order)}
											>
												<Eye class="size-3.5 text-muted-foreground" />
											</Button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<!-- VISTA: TARJETAS COMPACTAS -->
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
					{#each currentViewData.orders as order (order.id)}
						{@const timing = getTimingInfo(order)}
						{@const isDone = order.status === 'completed'}
						{@const isReady = isOrderReadyToDeliver(order)}
						{@const canProduce = order.status === 'pending' && order.items.some((i) => i.status === 'pending_delivery')}
						<div
							class="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-2xs space-y-3 overflow-hidden {isDone
								? 'opacity-60 bg-muted/10'
								: isReady
									? 'border-emerald-500/40 bg-emerald-500/5'
									: timing.isOverdue
										? 'border-red-500/30 bg-red-500/5'
										: ''}"
						>
							<div class="space-y-2.5">
								<!-- Encabezado de la Tarjeta -->
								<div class="flex items-center justify-between gap-2">
									<div class="flex items-center gap-2">
										{#if canProduce && onProduceOrders}
											<input
												type="checkbox"
												checked={selectedOrderIds.includes(order.id)}
												onchange={() => toggleSelectOrder(order.id)}
												class="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
											/>
										{/if}
										<button
											type="button"
											onclick={() => onViewOrder(order)}
											class="inline-flex items-center rounded bg-muted/80 px-2 py-0.5 font-mono text-xs font-bold text-foreground hover:underline cursor-pointer"
										>
											{order.orderNumber}
										</button>
										{#if isReady}
											<span class="inline-flex items-center gap-0.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
												<PackageCheck class="size-3" /> Listo
											</span>
										{/if}
									</div>
									<span
										class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs {timing.badgeClass}"
									>
										{#if timing.isOverdue}
											<AlertCircle class="size-3 shrink-0" />
										{:else if timing.isImmediate}
											<Zap class="size-3 shrink-0" />
										{:else}
											<Clock class="size-3 shrink-0" />
										{/if}
										<span>{timing.label}</span>
									</span>
								</div>

								<!-- Cliente -->
								<div>
									<h3 class="font-bold text-foreground text-sm truncate" title={order.customerName}>
										{order.customerName}
									</h3>
									{#if order.notes}
										<p class="text-[11px] text-muted-foreground italic line-clamp-1 mt-0.5" title={order.notes}>
											"{order.notes}"
										</p>
									{/if}
								</div>

								<!-- Lista de Productos a Entregar -->
								<div class="rounded-lg bg-muted/20 p-2.5 space-y-1.5 border border-border/40">
									<div class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
										<span>Productos a entregar:</span>
										<span class="font-mono text-foreground">{order.items.length} {order.items.length === 1 ? 'ítem' : 'ítems'}</span>
									</div>
									<div class="space-y-1 max-h-32 overflow-y-auto pr-1">
										{#each order.items as item (item.id)}
											<div class="flex items-center justify-between gap-2 text-xs">
												<span class="truncate text-foreground font-medium" title={item.productName}>
													<span class="font-mono font-bold text-foreground">{item.quantity}x</span> {item.productName}
												</span>
												{#if item.status === 'delivered'}
													<span class="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 font-semibold shrink-0">
														<Check class="size-2.5" /> Entregado
													</span>
												{:else if item.status === 'ready'}
													<span class="inline-flex items-center gap-0.5 rounded bg-emerald-500/15 px-1.5 py-0.2 text-[10px] text-emerald-700 dark:text-emerald-300 font-bold shrink-0">
														<Check class="size-2.5" /> Listo
													</span>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							</div>

							<!-- Pie de la Tarjeta: Pago, Total y Acciones -->
							<div class="pt-2 border-t border-border/40 space-y-2">
								<div class="flex items-center justify-between">
									<div>
										{#if order.status === 'completed' || order.paymentStatus === 'paid'}
											<Badge variant="outline" class="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-success/90 text-[10px]">
												Pagado
											</Badge>
										{:else if order.paymentStatus === 'partially_paid'}
											<Badge variant="outline" class="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px]">
												Pago Parcial
											</Badge>
										{:else}
											<Badge variant="outline" class="border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400 text-[10px]">
												Pendiente
											</Badge>
										{/if}
									</div>
									<div class="font-mono font-bold text-sm text-foreground">
										{formatCurrency(order.totalAmount)}
									</div>
								</div>

								<div class="flex items-center justify-end gap-1.5 pt-1">
									{#if order.status === 'unconfirmed'}
										<Button
											size="sm"
											variant="outline"
											class="h-7 px-2.5 text-xs flex-1 border-amber-500/30 text-amber-700 hover:bg-amber-500/10 truncate gap-1"
											onclick={() => onConfirmOrder(order)}
										>
											<Zap class="size-3 shrink-0" />
											<span>Confirmar</span>
										</Button>
									{:else if order.status === 'pending'}
										{#if canProduce && onProduceOrders}
											<Button
												size="sm"
												variant="outline"
												class="h-7 px-2 text-xs border-primary/30 text-primary hover:bg-primary/10 shrink-0 gap-1"
												title="Marcar pedido como Listo y descontar insumos"
												onclick={() => onProduceOrders([order], order.orderNumber)}
											>
												<ChefHat class="size-3.5 shrink-0" />
												<span class="hidden sm:inline">Listo</span>
											</Button>
										{/if}
										<Button
											size="sm"
											variant="default"
											class="h-7 px-2.5 text-xs flex-1 truncate gap-1"
											onclick={() => onDeliverOrder(order)}
										>
											<Check class="size-3.5 shrink-0" />
											<span>Entregar</span>
										</Button>
									{/if}

									{#if order.paymentStatus !== 'paid' && order.status !== 'completed'}
										<Button
											size="sm"
											variant="outline"
											class="h-7 px-2 text-xs shrink-0 gap-1"
											title="Registrar Cobro"
											onclick={() => onPayOrder(order)}
										>
											<DollarSign class="size-3.5 shrink-0" />
											<span class="hidden sm:inline">Cobrar</span>
										</Button>
									{/if}

									<Button
										size="sm"
										variant="ghost"
										class="h-7 w-7 p-0 shrink-0"
										title="Ver Detalle"
										aria-label="Ver detalle"
										onclick={() => onViewOrder(order)}
									>
										<Eye class="size-3.5 text-muted-foreground" />
									</Button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
