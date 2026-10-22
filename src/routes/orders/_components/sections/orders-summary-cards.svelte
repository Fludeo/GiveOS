<script lang="ts">
	import type { OrderWithItems } from '#lib/features/orders/domain/order.entity';
	import { Card, CardContent } from '#lib/components/ui/card';
	import Clock from '@lucide/svelte/icons/clock';
	import Check from '@lucide/svelte/icons/check';
	import CircleDollarSign from '@lucide/svelte/icons/circle-dollar-sign';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import { formatCurrency } from '../utils';

	interface Props {
		orders: OrderWithItems[];
	}

	let { orders }: Props = $props();

	const pendingOrdersCount = $derived(orders.filter((o) => o.status === 'pending').length);
	const completedOrdersCount = $derived(orders.filter((o) => o.status === 'completed').length);
	const activeOrders = $derived(
		orders.filter((o) => o.status !== 'cancelled' && o.status !== 'unconfirmed')
	);
	const totalBilled = $derived(activeOrders.reduce((acc, o) => acc + o.totalAmount, 0));
	const totalCollected = $derived(
		activeOrders.reduce(
			(acc, o) => acc + (o.status === 'completed' ? o.totalAmount : o.paidAmount),
			0
		)
	);
	const totalPendingCollection = $derived(Math.max(0, totalBilled - totalCollected));
</script>

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
			Órdenes Completadas
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

	<!-- KPI 3: Total Cobrado -->
	<div class="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-2">
		<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
			Total Cobrado
		</span>
		<div class="flex items-center gap-3 pt-0.5">
			<div
				class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"
			>
				<CircleDollarSign class="size-6" />
			</div>
			<div class="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
				{formatCurrency(totalCollected)}
			</div>
		</div>
		<p class="text-xs font-mono text-muted-foreground">
			De {formatCurrency(totalBilled)} facturados
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
			{totalPendingCollection > 0 ? 'Señas y pagos pendientes' : 'Cuentas al día'}
		</p>
	</div>
</div>
