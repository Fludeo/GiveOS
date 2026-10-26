<script lang="ts">
	import type {
		OrderStatus,
		OrderWithItems,
		PaymentStatus,
		SalesProductWithItems
	} from '#lib/features/orders/domain/order.entity';
	import {
		isOrderReadyToDeliver,
		ORDER_STATUS_LABELS
	} from '#lib/features/orders/domain/order.entity';
	import TablePagination from '#lib/components/ui/pagination/table-pagination.svelte';
	import { Button } from '#lib/components/ui/button';
	import { Badge } from '#lib/components/ui/badge';
	import { Input } from '#lib/components/ui/input';
	import { Card, CardContent, CardHeader } from '#lib/components/ui/card';
	import Search from '@lucide/svelte/icons/search';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import Calendar from '@lucide/svelte/icons/calendar';
	import Check from '@lucide/svelte/icons/check';
	import ChefHat from '@lucide/svelte/icons/chef-hat';
	import PackageCheck from '@lucide/svelte/icons/package-check';
	import Eye from '@lucide/svelte/icons/eye';
	import X from '@lucide/svelte/icons/x';
	import Plus from '@lucide/svelte/icons/plus';
	import Zap from '@lucide/svelte/icons/zap';
	import Clock from '@lucide/svelte/icons/clock';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import List from '@lucide/svelte/icons/list';
	import { formatCurrency, formatDateTime } from '../utils';

	interface Props {
		orders: OrderWithItems[];
		onViewOrder: (order: OrderWithItems) => void;
		onPayOrder: (order: OrderWithItems) => void;
		onDeliverOrder: (order: OrderWithItems) => void;
		onCancelOrder: (order: OrderWithItems) => void;
		onConfirmOrder: (order: OrderWithItems) => void;
		onProduceOrders?: (orders: OrderWithItems[], periodLabel: string) => void;
	}

	let {
		orders,
		onViewOrder,
		onPayOrder,
		onDeliverOrder,
		onCancelOrder,
		onConfirmOrder,
		onProduceOrders
	}: Props = $props();

	let searchQuery = $state('');
	let filterStatus = $state<OrderStatus | 'ready' | 'all'>('all');
	let filterPayment = $state<PaymentStatus | 'all'>('all');
	let currentPage = $state(1);
	let pageSize = $state(10);
	let viewMode = $state<'cards' | 'table'>('cards');

	function toggleView(mode: 'cards' | 'table') {
		viewMode = mode;
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem('giveos-orders-view-mode', mode);
			} catch {}
		}
	}

	$effect(() => {
		if (typeof window !== 'undefined') {
			try {
				const saved = localStorage.getItem('giveos-orders-view-mode');
				if (saved === 'cards' || saved === 'table') {
					viewMode = saved;
				}
			} catch {}
		}
	});

	const unconfirmedOrdersCount = $derived(orders.filter((o) => o.status === 'unconfirmed').length);
	const pendingOrdersCount = $derived(
		orders.filter((o) => o.status === 'pending' && !isOrderReadyToDeliver(o)).length
	);
	const readyOrdersCount = $derived(orders.filter((o) => isOrderReadyToDeliver(o)).length);
	const completedOrdersCount = $derived(orders.filter((o) => o.status === 'completed').length);

	const filteredOrders = $derived(
		orders.filter((order) => {
			if (filterStatus === 'ready') {
				if (!isOrderReadyToDeliver(order)) return false;
			} else if (filterStatus === 'pending') {
				if (order.status !== 'pending' || isOrderReadyToDeliver(order)) return false;
			} else if (filterStatus !== 'all' && order.status !== filterStatus) {
				return false;
			}
			const effectivePayment = order.status === 'completed' ? 'paid' : order.paymentStatus;
			if (filterPayment !== 'all' && effectivePayment !== filterPayment) return false;
			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase().trim();
				const matchHeader =
					order.orderNumber.toLowerCase().includes(q) ||
					order.customerName.toLowerCase().includes(q) ||
					(order.notes?.toLowerCase().includes(q) ?? false);
				const matchItems = order.items.some((i) => i.productName.toLowerCase().includes(q));
				return matchHeader || matchItems;
			}
			return true;
		})
	);

	$effect(() => {
		void searchQuery;
		void filterStatus;
		void filterPayment;
		currentPage = 1;
	});

	const paginatedOrders = $derived(
		filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize)
	);
</script>

<Card>
	<CardHeader class="space-y-4 p-6 sm:p-8 sm:pb-4">
		<div class="flex flex-wrap items-center justify-between gap-4">
			<div class="relative w-full max-w-sm">
				<Search
					class="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground"
				/>
				<Input
					type="search"
					placeholder="Buscar por N° orden, cliente o producto..."
					bind:value={searchQuery}
					class="h-10 pl-9"
				/>
			</div>

			<div class="flex w-full sm:w-auto items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:pb-0">
				<Button
					size="sm"
					class="shrink-0 whitespace-nowrap"
					variant={filterStatus === 'all' ? 'default' : 'outline'}
					onclick={() => (filterStatus = 'all')}
				>
					Todas ({orders.length})
				</Button>
				<Button
					size="sm"
					variant={filterStatus === 'unconfirmed' ? 'default' : 'outline'}
					class="shrink-0 whitespace-nowrap {filterStatus !== 'unconfirmed' && unconfirmedOrdersCount > 0
						? 'border-secondary/40 text-secondary bg-secondary/10'
						: ''}"
					onclick={() => (filterStatus = 'unconfirmed')}
				>
					Por Confirmar ({unconfirmedOrdersCount})
				</Button>
				<Button
					size="sm"
					class="shrink-0 whitespace-nowrap"
					variant={filterStatus === 'pending' ? 'default' : 'outline'}
					onclick={() => (filterStatus = 'pending')}
				>
					En Preparación ({pendingOrdersCount})
				</Button>
				<Button
					size="sm"
					class="shrink-0 whitespace-nowrap {filterStatus !== 'ready' && readyOrdersCount > 0
						? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
						: ''}"
					variant={filterStatus === 'ready' ? 'default' : 'outline'}
					onclick={() => (filterStatus = 'ready')}
				>
					<PackageCheck class="size-3.5 mr-1" />
					Listas p/ Retirar ({readyOrdersCount})
				</Button>
				<Button
					size="sm"
					class="shrink-0 whitespace-nowrap"
					variant={filterStatus === 'completed' ? 'default' : 'outline'}
					onclick={() => (filterStatus = 'completed')}
				>
					Completadas ({completedOrdersCount})
				</Button>
				<Button
					size="sm"
					class="shrink-0 whitespace-nowrap"
					variant={filterStatus === 'cancelled' ? 'default' : 'outline'}
					onclick={() => (filterStatus = 'cancelled')}
				>
					Canceladas
				</Button>
			</div>
		</div>

		<!-- Filtro secundario por Estado de Pago y Selector de Vista -->
		<div
			class="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3 text-xs"
		>
			<div class="flex w-full sm:w-auto items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:pb-0">
				<span class="shrink-0 font-medium text-muted-foreground">Pago:</span>
				<button
					type="button"
					onclick={() => (filterPayment = 'all')}
					class="shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 font-medium transition-colors {filterPayment === 'all'
						? 'bg-primary/10 text-primary'
						: 'text-muted-foreground hover:bg-muted'}"
				>
					Todos
				</button>
				<button
					type="button"
					onclick={() => (filterPayment = 'pending')}
					class="shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 font-medium transition-colors {filterPayment === 'pending'
						? 'bg-red-500/15 text-red-700'
						: 'text-muted-foreground hover:bg-muted'}"
				>
					Sin Pagar
				</button>
				<button
					type="button"
					onclick={() => (filterPayment = 'partially_paid')}
					class="shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 font-medium transition-colors {filterPayment ===
					'partially_paid'
						? 'bg-amber-500/15 text-amber-700'
						: 'text-muted-foreground hover:bg-muted'}"
				>
					Pago Parcial
				</button>
				<button
					type="button"
					onclick={() => (filterPayment = 'paid')}
					class="shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 font-medium transition-colors {filterPayment === 'paid'
						? 'bg-emerald-500/15 text-emerald-700'
						: 'text-muted-foreground hover:bg-muted'}"
				>
					Pagado
				</button>
			</div>

			<!-- Selector de Vista: Tarjetas / Tabla -->
			<div
				class="ml-auto hidden sm:flex items-center gap-1 rounded-xl border border-border bg-muted/30 p-0.5"
			>
				<Button
					type="button"
					variant={viewMode === 'cards' ? 'default' : 'ghost'}
					size="sm"
					class="h-7 px-2.5 text-xs gap-1.5 cursor-pointer"
					onclick={() => toggleView('cards')}
					title="Vista de Tarjetas"
				>
					<LayoutGrid class="size-3.5" />
					<span>Tarjetas</span>
				</Button>
				<Button
					type="button"
					variant={viewMode === 'table' ? 'default' : 'ghost'}
					size="sm"
					class="h-7 px-2.5 text-xs gap-1.5 cursor-pointer"
					onclick={() => toggleView('table')}
					title="Vista de Tabla"
				>
					<List class="size-3.5" />
					<span>Tabla</span>
				</Button>
			</div>
		</div>
	</CardHeader>

	<CardContent class="p-4 pt-2 sm:p-6 sm:pt-4">
		{#if filteredOrders.length > 0}
			<div class="space-y-6">
				{#if viewMode === 'cards'}
					<!-- VISTA DE TARJETAS -->
					<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
						{#each paginatedOrders as order (order.id)}
							<div
								class="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all duration-150 hover:border-primary/40 hover:shadow-sm overflow-hidden"
							>
								<!-- Encabezado de la Tarjeta -->
								<div class="space-y-2.5">
									<!-- Fila superior: ID / SKU y Estado de la Orden -->
									<div class="flex items-center justify-between gap-2">
										<span
											class="inline-flex items-center rounded bg-muted/80 px-2 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground whitespace-nowrap"
										>
											{order.orderNumber}
										</span>

										<!-- Estado de la Orden -->
										<div class="shrink-0">
											{#if order.status === 'unconfirmed'}
												<Badge
													variant="outline"
													class="border-secondary/40 bg-secondary/10 text-secondary text-[11px] font-bold animate-pulse"
												>
													{ORDER_STATUS_LABELS.unconfirmed}
												</Badge>
											{:else if isOrderReadyToDeliver(order)}
												<Badge
													variant="outline"
													class="border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold gap-1"
												>
													<PackageCheck class="size-3" />
													Listo p/ retirar
												</Badge>
											{:else if order.status === 'pending'}
												<Badge
													variant="outline"
													class="border-amber-500/40 bg-amber-500/10 text-amber-700 text-[11px]"
												>
													{ORDER_STATUS_LABELS.pending}
												</Badge>
											{:else if order.status === 'completed'}
												<Badge
													variant="outline"
													class="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 text-[11px]"
												>
													{ORDER_STATUS_LABELS.completed}
												</Badge>
											{:else}
												<Badge
													variant="outline"
													class="border-red-500/40 bg-red-500/10 text-red-700 text-[11px]"
												>
													{ORDER_STATUS_LABELS.cancelled}
												</Badge>
											{/if}
										</div>
									</div>

									<!-- Nombre del cliente en su propia línea -->
									<div class="space-y-0.5">
										<h3
											class="text-base font-semibold text-foreground truncate"
											title={order.customerName}
										>
											{order.customerName}
										</h3>
										<p class="text-[11px] text-muted-foreground">
											Creada: {formatDateTime(order.createdAt)}
										</p>
									</div>

									<!-- Fecha y tipo de entrega -->
									<div class="flex items-center gap-2 text-xs">
										{#if order.deliveryDate}
											<div
												class="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 font-medium text-foreground"
											>
												<Calendar class="size-3.5 text-primary shrink-0" />
												<span>Entrega: {formatDateTime(order.deliveryDate)}</span>
											</div>
										{:else}
											<div
												class="inline-flex items-center gap-1.5 rounded-md bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground"
											>
												<Zap class="size-3 text-muted-foreground shrink-0" />
												<span>Entrega Inmediata</span>
											</div>
										{/if}
									</div>

									{#if order.notes}
										<p
											class="rounded-md bg-muted/30 px-2.5 py-1.5 text-xs italic text-muted-foreground border border-border/40"
										>
											"{order.notes}"
										</p>
									{/if}

									{#if order.transactionId}
										<div
											class="inline-flex items-center gap-1.5 rounded-md bg-sky-500/10 px-2 py-0.5 text-[11px] font-mono text-sky-800 border border-sky-500/20"
										>
											<span class="font-sans font-semibold">Tx ID:</span>
											<span>{order.transactionId}</span>
										</div>
									{/if}

									<!-- Separador y Lista de Ítems -->
									<div class="border-t border-border/60 pt-3">
										<p
											class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
										>
											Ítems de la Orden ({order.items.length})
										</p>
										<div class="space-y-1.5 max-h-44 overflow-y-auto pr-1">
											{#each order.items as line (line.id)}
												<div
													class="flex items-start justify-between gap-2 rounded-lg bg-muted/20 p-2 text-xs"
												>
													<div class="min-w-0 flex-1 space-y-0.5">
														<div class="flex items-baseline gap-1.5">
															<span
																class="font-mono font-bold text-foreground shrink-0"
															>
																{line.quantity}x
															</span>
															<span
																class="font-medium text-foreground"
																title={line.productName}
															>
																{line.productName}
															</span>
														</div>
														{#if line.notes}
															<p class="text-[11px] text-muted-foreground italic">
																"{line.notes}"
															</p>
														{/if}
													</div>

													<div class="shrink-0 pt-0.5">
														{#if line.status === 'delivered'}
															<span
																class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
															>
																<Check class="size-2.5" />
																Entregado
															</span>
														{:else if line.status === 'ready'}
															<span
																class="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300"
															>
																<PackageCheck class="size-2.5" />
																Listo
															</span>
														{:else if line.status === 'pending_delivery'}
															<span
																class="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
															>
																<Clock class="size-2.5" />
																Pendiente
															</span>
														{:else}
															<span
																class="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground line-through"
															>
																Cancelado
															</span>
														{/if}
													</div>
												</div>
											{/each}
										</div>
									</div>
								</div>

								<!-- Footer de la Tarjeta: Total, Costo, Ganancia y Acciones -->
								<div class="mt-4 border-t border-border/60 pt-3 space-y-3">
									<div class="flex items-center justify-between gap-2">
										<div class="flex items-baseline gap-2">
											<span class="text-xs font-medium text-muted-foreground"
												>Total:</span
											>
											<span class="font-mono text-base font-bold text-foreground">
												{formatCurrency(order.totalAmount)}
											</span>
										</div>

										<div>
											{#if order.status === 'completed' || order.paymentStatus === 'paid'}
												<span
													class="rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
												>
													Pagado
												</span>
											{:else if order.paymentStatus === 'partially_paid'}
												<button
													type="button"
													onclick={() => onPayOrder(order)}
													class="rounded bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 hover:underline cursor-pointer"
												>
													Parcial: {formatCurrency(order.paidAmount)}
												</button>
											{:else}
												<button
													type="button"
													onclick={() => onPayOrder(order)}
													class="rounded bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-700 hover:underline cursor-pointer"
												>
													Sin pagar
												</button>
											{/if}
										</div>
									</div>

									{#if order.status === 'unconfirmed'}
										<div class="flex items-center gap-1.5 pt-1">
											<Button
												type="button"
												size="sm"
												variant="outline"
												class="h-9 w-9 p-0 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
												title="Rechazar / Cancelar orden"
												aria-label="Rechazar"
												onclick={() => onCancelOrder(order)}
											>
												<X class="size-4" />
											</Button>

											<Button
												type="button"
												size="sm"
												variant="outline"
												class="h-9 w-9 p-0 shrink-0"
												title="Ver listado de ítems y detalle"
												aria-label="Ver orden"
												onclick={() => onViewOrder(order)}
											>
												<Eye class="size-4" />
											</Button>

											<Button
												type="button"
												variant="secondary"
												size="sm"
												class="flex-1 h-9 gap-1.5 text-xs font-bold shadow-xs truncate"
												title="Confirmar orden por caja/encargado"
												onclick={() => onConfirmOrder(order)}
											>
												<Check class="size-4 shrink-0" />
												<span>Confirmar Pedido</span>
											</Button>
										</div>
									{:else if order.status === 'pending'}
										{@const canProduce =
											order.items.some((i) => i.status === 'pending_delivery') && Boolean(onProduceOrders)}
										<div class="flex items-center gap-1.5 pt-1">
											<Button
												type="button"
												size="sm"
												variant="outline"
												class="h-9 w-9 p-0 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
												title="Cancelar orden"
												aria-label="Cancelar"
												onclick={() => onCancelOrder(order)}
											>
												<X class="size-4" />
											</Button>

											<Button
												type="button"
												size="sm"
												variant="outline"
												class="h-9 w-9 p-0 shrink-0"
												title="Ver listado de ítems y detalle de la orden"
												aria-label="Ver orden"
												onclick={() => onViewOrder(order)}
											>
												<Eye class="size-4" />
											</Button>

											{#if canProduce}
												<Button
													type="button"
													size="sm"
													variant="outline"
													class="h-9 px-2 sm:px-3 gap-1 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10 shrink-0"
													title="Marcar pedido como Listo y descontar insumos"
													onclick={() => onProduceOrders?.([order], order.orderNumber)}
												>
													<ChefHat class="size-4 shrink-0" />
													<span class="hidden sm:inline">Listo</span>
												</Button>
											{/if}

											<Button
												type="button"
												size="sm"
												class="flex-1 h-9 gap-1.5 text-xs font-semibold truncate"
												title="Entregar orden y marcar como finalizada"
												onclick={() => onDeliverOrder(order)}
											>
												<Check class="size-4 shrink-0" />
												<span>Entregar</span>
											</Button>
										</div>
									{:else if order.status === 'completed'}
										<div class="grid grid-cols-2 gap-2 pt-1">
											<Button
												type="button"
												size="sm"
												variant="outline"
												class="h-9 gap-1.5 text-xs font-medium"
												title="Ver listado de ítems y detalle de la orden"
												onclick={() => onViewOrder(order)}
											>
												<Eye class="size-3.5" />
												<span>Ver Ítems</span>
											</Button>

											<div
												class="flex h-9 items-center justify-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-700"
											>
												<Check class="size-3.5" />
												<span>Finalizada</span>
											</div>
										</div>
									{:else}
										<div class="grid grid-cols-2 gap-2 pt-1">
											<Button
												type="button"
												size="sm"
												variant="outline"
												class="h-9 gap-1.5 text-xs font-medium"
												title="Ver listado de ítems y detalle de la orden"
												onclick={() => onViewOrder(order)}
											>
												<Eye class="size-3.5" />
												<span>Ver Ítems</span>
											</Button>

											<div
												class="flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 text-xs font-medium text-muted-foreground"
											>
												<span>Cancelada</span>
											</div>
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<!-- VISTA DE TABLA -->
					<div class="overflow-x-auto rounded-xl border border-border">
						<table class="w-full text-left text-sm">
							<thead
								class="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground"
							>
								<tr>
									<th class="py-3.5 pr-4 pl-5 font-semibold">N° Orden</th>
									<th class="px-4 py-3.5 font-semibold">Cliente</th>
									<th class="px-4 py-3.5 font-semibold">Entrega</th>
									<th class="px-4 py-3.5 font-semibold">Ítems</th>
									<th class="px-4 py-3.5 font-semibold">Estado</th>
									<th class="px-4 py-3.5 font-semibold">Pago</th>
									<th class="px-4 py-3.5 text-right font-semibold">Total</th>
									<th class="py-3.5 pr-5 pl-4 text-right font-semibold">Acciones</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border/60">
								{#each paginatedOrders as order (order.id)}
									<tr class="transition-colors hover:bg-muted/20">
										<!-- N° Orden -->
										<td class="py-4 pr-4 pl-5 align-middle">
											<span
												class="inline-flex items-center rounded bg-muted/80 px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground"
											>
												{order.orderNumber}
											</span>
											{#if order.transactionId}
												<div class="mt-1 text-[10px] font-mono text-sky-700 dark:text-sky-400">
													Tx: {order.transactionId}
												</div>
											{/if}
										</td>

										<!-- Cliente y Fecha -->
										<td class="px-4 py-4 align-middle">
											<div class="font-semibold text-foreground">{order.customerName}</div>
											<div class="text-[11px] text-muted-foreground">
												{formatDateTime(order.createdAt)}
											</div>
											{#if order.notes}
												<div
													class="mt-0.5 text-[11px] italic text-muted-foreground line-clamp-1 max-w-[200px]"
													title={order.notes}
												>
													"{order.notes}"
												</div>
											{/if}
										</td>

										<!-- Entrega -->
										<td class="px-4 py-4 align-middle whitespace-nowrap">
											{#if order.deliveryDate}
												<div
													class="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium text-foreground"
												>
													<Calendar class="size-3 text-primary shrink-0" />
													<span>{formatDateTime(order.deliveryDate)}</span>
												</div>
											{:else}
												<div
													class="inline-flex items-center gap-1.5 rounded-md bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground"
												>
													<Zap class="size-3 text-muted-foreground shrink-0" />
													<span>Inmediata</span>
												</div>
											{/if}
										</td>

										<!-- Ítems (solo cantidad numerada) -->
										<td class="px-4 py-4 align-middle whitespace-nowrap">
											<span
												class="inline-flex items-center rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-foreground"
											>
												{order.items.length} {order.items.length === 1 ? 'ítem' : 'ítems'}
											</span>
										</td>

										<!-- Estado -->
										<td class="px-4 py-4 align-middle whitespace-nowrap">
											{#if order.status === 'unconfirmed'}
												<Badge
													variant="outline"
													class="border-secondary/40 bg-secondary/10 text-secondary text-[11px] font-bold animate-pulse"
												>
													{ORDER_STATUS_LABELS.unconfirmed}
												</Badge>
											{:else if isOrderReadyToDeliver(order)}
												<Badge
													variant="outline"
													class="border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold gap-1"
												>
													<PackageCheck class="size-3" />
													Listo p/ retirar
												</Badge>
											{:else if order.status === 'pending'}
												<Badge
													variant="outline"
													class="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px]"
												>
													{ORDER_STATUS_LABELS.pending}
												</Badge>
											{:else if order.status === 'completed'}
												<Badge
													variant="outline"
													class="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px]"
												>
													{ORDER_STATUS_LABELS.completed}
												</Badge>
											{:else}
												<Badge
													variant="outline"
													class="border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400 text-[11px]"
												>
													{ORDER_STATUS_LABELS.cancelled}
												</Badge>
											{/if}
										</td>

										<!-- Estado de Pago -->
										<td class="px-4 py-4 align-middle whitespace-nowrap">
											{#if order.status === 'completed' || order.paymentStatus === 'paid'}
												<span
													class="rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400"
												>
													Pagado
												</span>
											{:else if order.paymentStatus === 'partially_paid'}
												<button
													type="button"
													onclick={() => onPayOrder(order)}
													class="rounded bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
													title="Registrar pago parcial"
												>
													Parcial: {formatCurrency(order.paidAmount)}
												</button>
											{:else}
												<button
													type="button"
													onclick={() => onPayOrder(order)}
													class="rounded bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:text-red-400 hover:underline cursor-pointer"
													title="Registrar cobro"
												>
													Sin pagar
												</button>
											{/if}
										</td>

										<!-- Total (Venta) -->
										<td class="px-4 py-4 align-middle text-right whitespace-nowrap">
											<span class="font-mono text-sm font-bold text-foreground">
												{formatCurrency(order.totalAmount)}
											</span>
										</td>

										<!-- Acciones -->
										<td class="py-4 pr-5 pl-4 align-middle text-right whitespace-nowrap">
											<div class="flex items-center justify-end gap-1.5">
												<Button
													type="button"
													variant="outline"
													size="sm"
													class="h-8 px-2.5 text-xs gap-1 cursor-pointer"
													onclick={() => onViewOrder(order)}
													title="Ver detalles de la orden"
												>
													<Eye class="size-3.5" />
													<span>Ver</span>
												</Button>

												{#if order.status === 'unconfirmed'}
													<Button
														type="button"
														size="sm"
														variant="outline"
														class="h-8 px-2 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 cursor-pointer"
														onclick={() => onCancelOrder(order)}
														title="Rechazar"
													>
														<X class="size-3.5" />
													</Button>
													<Button
														type="button"
														variant="secondary"
														size="sm"
														class="h-8 px-2 text-xs font-bold shadow-xs cursor-pointer"
														onclick={() => onConfirmOrder(order)}
														title="Confirmar"
													>
														<Check class="size-3.5" />
													</Button>
												{:else if order.status === 'pending'}
													{#if order.items.some((i) => i.status === 'pending_delivery') && onProduceOrders}
														<Button
															type="button"
															size="sm"
															variant="outline"
															class="h-8 px-2.5 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
															onclick={() => onProduceOrders([order], order.orderNumber)}
															title="Marcar pedido como Listo y descontar insumos"
														>
															<ChefHat class="size-3.5" />
															<span>Listo</span>
														</Button>
													{/if}
													<Button
														type="button"
														size="sm"
														class="h-8 px-2.5 text-xs font-semibold cursor-pointer"
														onclick={() => onDeliverOrder(order)}
														title="Entregar orden"
													>
														<Check class="size-3.5" />
														<span>Entregar</span>
													</Button>
												{/if}
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}

				<TablePagination
					bind:currentPage
					bind:pageSize
					totalItems={filteredOrders.length}
					itemLabel="órdenes"
				/>
			</div>
		{:else}
			<div class="rounded-xl border border-dashed border-border p-12 text-center">
				<ShoppingBag class="mx-auto size-10 text-muted-foreground/60" />
				<p class="mt-3 text-base font-medium text-foreground">
					Todavía no hay órdenes registradas con este filtro
				</p>
				<p class="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
					Usa el botón "Nueva Orden de Compra" para registrar órdenes de mostrador u órdenes
					por encargo con fecha de entrega y señas.
				</p>
				<Button variant="secondary" class="mt-4" href="/orders/new">
					<Plus class="size-4" />
					<span>Crear Primera Orden</span>
				</Button>
			</div>
		{/if}
	</CardContent>
</Card>
