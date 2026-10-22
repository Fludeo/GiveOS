<script lang="ts">
	import type {
		OrderWithItems,
		SalesProductWithItems
	} from '#lib/features/orders/domain/order.entity';
	import Clock from '@lucide/svelte/icons/clock';
	import Check from '@lucide/svelte/icons/check';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import Calendar from '@lucide/svelte/icons/calendar';
	import { formatCurrency, calculateOrderCost, calculateOrderProfit } from '../utils';

	interface Props {
		orders: OrderWithItems[];
		salesProducts?: SalesProductWithItems[];
	}

	let { orders, salesProducts = [] }: Props = $props();

	let selectedPeriod = $state<string>('current');

	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth();

	function formatMonthLabel(d: Date): string {
		const name = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
		return name.charAt(0).toUpperCase() + name.slice(1);
	}

	const currentMonthLabel = $derived(formatMonthLabel(now));
	const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

	const availableMonths = $derived.by(() => {
		const monthsMap = new Map<string, string>();
		monthsMap.set(currentMonthKey, currentMonthLabel);

		for (const o of orders) {
			const d = new Date(o.createdAt);
			if (!Number.isNaN(d.getTime())) {
				const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
				if (!monthsMap.has(key)) {
					monthsMap.set(key, formatMonthLabel(d));
				}
			}
		}
		return Array.from(monthsMap.entries()).map(([key, label]) => ({ key, label }));
	});

	const activePeriodLabel = $derived.by(() => {
		if (selectedPeriod === 'all') return 'Histórico Total';
		if (selectedPeriod === 'current') return `Este Mes (${currentMonthLabel})`;
		const found = availableMonths.find((m) => m.key === selectedPeriod);
		return found ? found.label : selectedPeriod;
	});

	const periodOrders = $derived(
		orders.filter((o) => {
			if (selectedPeriod === 'all') return true;
			const targetKey = selectedPeriod === 'current' ? currentMonthKey : selectedPeriod;
			const d = new Date(o.createdAt);
			if (Number.isNaN(d.getTime())) return false;
			const orderKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
			return orderKey === targetKey;
		})
	);

	const costMap = $derived(
		new Map(salesProducts.map((sp) => [sp.id, sp.estimatedRecipeCost ?? 0]))
	);

	const pendingOrdersCount = $derived(orders.filter((o) => o.status === 'pending').length);
	const completedOrdersCount = $derived(periodOrders.filter((o) => o.status === 'completed').length);
	const activeOrders = $derived(
		periodOrders.filter((o) => o.status !== 'cancelled' && o.status !== 'unconfirmed')
	);
	const totalBilled = $derived(activeOrders.reduce((acc, o) => acc + o.totalAmount, 0));
	const totalCollected = $derived(
		activeOrders.reduce(
			(acc, o) => acc + (o.status === 'completed' ? o.totalAmount : o.paidAmount),
			0
		)
	);
	const totalPendingCollection = $derived(Math.max(0, totalBilled - totalCollected));

	const totalCost = $derived(
		activeOrders.reduce((acc, o) => acc + calculateOrderCost(o, costMap), 0)
	);
	const { profit: totalProfit, marginPct: overallMarginPct } = $derived(
		calculateOrderProfit(totalBilled, totalCost)
	);
</script>

<div class="space-y-3">
	<!-- Barra superior con selector de período / mes -->
	<div class="flex flex-wrap items-center justify-between gap-3 px-1">
		<div class="flex items-center gap-2">
			<span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
				Métricas Financieras
			</span>
			<span
				class="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
			>
				<Calendar class="size-3" />
				<span>{activePeriodLabel}</span>
			</span>
		</div>

		<!-- Selector de Período -->
		<div class="flex items-center gap-2">
			<label for="period-select" class="text-xs text-muted-foreground hidden sm:inline">
				Período:
			</label>
			<select
				id="period-select"
				bind:value={selectedPeriod}
				class="h-8 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
			>
				<option value="current">Este Mes ({currentMonthLabel})</option>
				{#each availableMonths.filter((m) => m.key !== currentMonthKey) as m}
					<option value={m.key}>{m.label}</option>
				{/each}
				<option value="all">Todo el Historial</option>
			</select>
		</div>
	</div>

	<!-- Grid de 4 tarjetas -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<!-- KPI 1: Órdenes Pendientes -->
		<div
			class="rounded-2xl border {pendingOrdersCount > 0
				? 'border-amber-500/30 bg-amber-500/5'
				: 'border-border bg-card'} p-4 sm:p-5 shadow-xs space-y-2"
		>
			<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
				Órdenes Pendientes
			</span>
			<div class="flex items-center gap-3 pt-0.5">
				<div
					class="flex size-11 shrink-0 items-center justify-center rounded-2xl {pendingOrdersCount > 0
						? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
						: 'bg-muted text-muted-foreground'}"
				>
					<Clock class="size-6" />
				</div>
				<div
					class="font-mono text-2xl sm:text-3xl font-bold tracking-tight {pendingOrdersCount > 0
						? 'text-amber-600 dark:text-amber-400'
						: 'text-foreground'}"
				>
					{pendingOrdersCount}
				</div>
			</div>
			<p class="text-xs text-muted-foreground">
				{pendingOrdersCount > 0 ? 'Con encargos pendientes de entregar' : 'Sin entregas pendientes'}
			</p>
		</div>

		<!-- KPI 2: Órdenes Completadas -->
		<div class="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-2">
			<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
				Completadas ({selectedPeriod === 'all' ? 'Histórico' : 'Mes'})
			</span>
			<div class="flex items-center gap-3 pt-0.5">
				<div
					class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
				>
					<Check class="size-6" />
				</div>
				<div
					class="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400"
				>
					{completedOrdersCount}
				</div>
			</div>
			<p class="text-xs text-muted-foreground">Totalmente entregadas</p>
		</div>

		<!-- KPI 3: Total Ganancias -->
		<div
			class="rounded-2xl border {totalProfit > 0
				? 'border-emerald-500/30 bg-emerald-500/5'
				: 'border-border bg-card'} p-4 sm:p-5 shadow-xs space-y-2"
		>
			<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
				Total Ganancias ({selectedPeriod === 'all' ? 'Histórico' : 'Mes'})
			</span>
			<div class="flex items-center gap-3 pt-0.5">
				<div
					class="flex size-11 shrink-0 items-center justify-center rounded-2xl {totalProfit > 0
						? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
						: 'bg-muted text-muted-foreground'}"
				>
					<TrendingUp class="size-6" />
				</div>
				<div
					class="font-mono text-2xl sm:text-3xl font-bold tracking-tight {totalProfit > 0
						? 'text-emerald-600 dark:text-emerald-400'
						: 'text-foreground'}"
				>
					{formatCurrency(totalProfit)}
				</div>
			</div>
			<p
				class="text-xs font-mono text-muted-foreground truncate"
				title="De {formatCurrency(totalBilled)} facturados ({overallMarginPct}% margen)"
			>
				De {formatCurrency(totalBilled)} facturados ({overallMarginPct}% margen)
			</p>
		</div>

		<!-- KPI 4: Saldo por Cobrar -->
		<div
			class="rounded-2xl border {totalPendingCollection > 0
				? 'border-amber-500/30 bg-amber-500/5'
				: 'border-border bg-card'} p-4 sm:p-5 shadow-xs space-y-2"
		>
			<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
				Saldo por Cobrar
			</span>
			<div class="flex items-center gap-3 pt-0.5">
				<div
					class="flex size-11 shrink-0 items-center justify-center rounded-2xl {totalPendingCollection > 0
						? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
						: 'bg-muted text-muted-foreground'}"
				>
					<ShoppingBag class="size-6" />
				</div>
				<div
					class="font-mono text-2xl sm:text-3xl font-bold tracking-tight {totalPendingCollection > 0
						? 'text-amber-600 dark:text-amber-400'
						: 'text-foreground'}"
				>
					{formatCurrency(totalPendingCollection)}
				</div>
			</div>
			<p class="text-xs text-muted-foreground">
				{totalPendingCollection > 0 ? 'Pagos pendientes' : 'Cuentas al día'}
			</p>
		</div>
	</div>
</div>
