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
	<Card class={pendingOrdersCount > 0 ? 'border-amber-500/40 bg-amber-500/5' : ''}>
		<CardContent class="flex items-center justify-between p-5">
			<div class="space-y-1">
				<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
					Órdenes Pendientes
				</p>
				<p
					class="text-2xl font-bold {pendingOrdersCount > 0
						? 'text-amber-600'
						: 'text-foreground'}"
				>
					{pendingOrdersCount}
				</p>
				<p class="text-xs text-muted-foreground">Con encargos pendientes de entregar</p>
			</div>
			<div
				class="flex size-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600"
			>
				<Clock class="size-5" />
			</div>
		</CardContent>
	</Card>

	<Card>
		<CardContent class="flex items-center justify-between p-5">
			<div class="space-y-1">
				<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
					Órdenes Completadas
				</p>
				<p class="text-2xl font-bold text-emerald-600">
					{completedOrdersCount}
				</p>
				<p class="text-xs text-muted-foreground">Totalmente entregadas</p>
			</div>
			<div
				class="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"
			>
				<Check class="size-5" />
			</div>
		</CardContent>
	</Card>

	<Card>
		<CardContent class="flex items-center justify-between p-5">
			<div class="space-y-1">
				<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
					Total Cobrado
				</p>
				<p class="font-mono text-2xl font-bold text-foreground">
					{formatCurrency(totalCollected)}
				</p>
				<p class="text-xs text-muted-foreground">De {formatCurrency(totalBilled)} facturados</p>
			</div>
			<div
				class="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"
			>
				<CircleDollarSign class="size-5" />
			</div>
		</CardContent>
	</Card>

	<Card>
		<CardContent class="flex items-center justify-between p-5">
			<div class="space-y-1">
				<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
					Saldo por Cobrar
				</p>
				<p
					class="font-mono text-2xl font-bold {totalPendingCollection > 0
						? 'text-amber-600'
						: 'text-foreground'}"
				>
					{formatCurrency(totalPendingCollection)}
				</p>
				<p class="text-xs text-muted-foreground">Señas y pagos pendientes</p>
			</div>
			<div
				class="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground"
			>
				<ShoppingBag class="size-5" />
			</div>
		</CardContent>
	</Card>
</div>
