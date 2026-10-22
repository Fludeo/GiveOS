<script lang="ts">
	import type {
		OrderStatus,
		OrderWithItems,
		PaymentStatus
	} from '#lib/features/orders/domain/order.entity';
	import {
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
	import Eye from '@lucide/svelte/icons/eye';
	import X from '@lucide/svelte/icons/x';
	import Plus from '@lucide/svelte/icons/plus';
	import Zap from '@lucide/svelte/icons/zap';
	import Clock from '@lucide/svelte/icons/clock';
	import { formatCurrency, formatDateTime } from '../utils';

	interface Props {
		orders: OrderWithItems[];
		onViewOrder: (order: OrderWithItems) => void;
		onPayOrder: (order: OrderWithItems) => void;
		onDeliverOrder: (order: OrderWithItems) => void;
		onCancelOrder: (order: OrderWithItems) => void;
		onConfirmOrder: (order: OrderWithItems) => void;
	}

	let {
		orders,
		onViewOrder,
		onPayOrder,
		onDeliverOrder,
		onCancelOrder,
		onConfirmOrder
	}: Props = $props();

	let searchQuery = $state('');
	let filterStatus = $state<OrderStatus | 'all'>('all');
	let filterPayment = $state<PaymentStatus | 'all'>('all');
	let currentPage = $state(1);
	let pageSize = $state(10);

	const unconfirmedOrdersCount = $derived(orders.filter((o) => o.status === 'unconfirmed').length);
	const pendingOrdersCount = $derived(orders.filter((o) => o.status === 'pending').length);
	const completedOrdersCount = $derived(orders.filter((o) => o.status === 'completed').length);

	const filteredOrders = $derived(
		orders.filter((order) => {
			if (filterStatus !== 'all' && order.status !== filterStatus) return false;
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

			<div class="flex flex-wrap items-center gap-2">
				<Button
					size="sm"
					variant={filterStatus === 'all' ? 'default' : 'outline'}
					onclick={() => (filterStatus = 'all')}
				>
					Todas ({orders.length})
				</Button>
				<Button
					size="sm"
					variant={filterStatus === 'unconfirmed' ? 'default' : 'outline'}
					class={filterStatus !== 'unconfirmed' && unconfirmedOrdersCount > 0
						? 'border-secondary/40 text-secondary bg-secondary/10'
						: ''}
					onclick={() => (filterStatus = 'unconfirmed')}
				>
					Por Confirmar ({unconfirmedOrdersCount})
				</Button>
				<Button
					size="sm"
					variant={filterStatus === 'pending' ? 'default' : 'outline'}
					onclick={() => (filterStatus = 'pending')}
				>
					Confirmadas / Pendientes ({pendingOrdersCount})
				</Button>
				<Button
					size="sm"
					variant={filterStatus === 'completed' ? 'default' : 'outline'}
					onclick={() => (filterStatus = 'completed')}
				>
					Completadas ({completedOrdersCount})
				</Button>
				<Button
					size="sm"
					variant={filterStatus === 'cancelled' ? 'default' : 'outline'}
					onclick={() => (filterStatus = 'cancelled')}
				>
					Canceladas
				</Button>
			</div>
		</div>

		<!-- Filtro secundario por Estado de Pago -->
		<div class="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 text-xs">
			<span class="font-medium text-muted-foreground">Estado de Pago:</span>
			<button
				type="button"
				onclick={() => (filterPayment = 'all')}
				class="rounded-lg px-2.5 py-1 font-medium transition-colors {filterPayment === 'all'
					? 'bg-primary/10 text-primary'
					: 'text-muted-foreground hover:bg-muted'}"
			>
				Todos
			</button>
			<button
				type="button"
				onclick={() => (filterPayment = 'pending')}
				class="rounded-lg px-2.5 py-1 font-medium transition-colors {filterPayment === 'pending'
					? 'bg-red-500/15 text-red-700'
					: 'text-muted-foreground hover:bg-muted'}"
			>
				Sin Pagar
			</button>
			<button
				type="button"
				onclick={() => (filterPayment = 'partially_paid')}
				class="rounded-lg px-2.5 py-1 font-medium transition-colors {filterPayment ===
				'partially_paid'
					? 'bg-amber-500/15 text-amber-700'
					: 'text-muted-foreground hover:bg-muted'}"
			>
				Pago Parcial (Seña)
			</button>
			<button
				type="button"
				onclick={() => (filterPayment = 'paid')}
				class="rounded-lg px-2.5 py-1 font-medium transition-colors {filterPayment === 'paid'
					? 'bg-emerald-500/15 text-emerald-700'
					: 'text-muted-foreground hover:bg-muted'}"
			>
				Pagado
			</button>
		</div>
	</CardHeader>

	<CardContent class="p-4 pt-2 sm:p-6 sm:pt-4">
		{#if filteredOrders.length > 0}
			<div class="space-y-6">
				<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
					{#each paginatedOrders as order (order.id)}
						<div
							class="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all duration-150 hover:border-primary/40 hover:shadow-sm"
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

							<!-- Footer de la Tarjeta: Total y Acciones -->
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
												Seña: {formatCurrency(order.paidAmount)}
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
									<div class="flex items-center gap-2 pt-1">
										<Button
											type="button"
											size="sm"
											variant="outline"
											class="h-9 gap-1 px-2.5 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
											title="Cancelar / Rechazar orden"
											onclick={() => onCancelOrder(order)}
										>
											<X class="size-3.5" />
											<span>Rechazar</span>
										</Button>

										<Button
											type="button"
											size="sm"
											variant="outline"
											class="h-9 gap-1 px-2.5 text-xs font-medium"
											title="Ver listado de ítems y detalle"
											onclick={() => onViewOrder(order)}
										>
											<Eye class="size-3.5" />
											<span>Ver</span>
										</Button>

										<Button
											type="button"
											variant="secondary"
											size="sm"
											class="flex-1 h-9 gap-1.5 text-xs font-bold shadow-xs"
											title="Confirmar orden por caja/encargado"
											onclick={() => onConfirmOrder(order)}
										>
											<Check class="size-3.5" />
											<span>Confirmar Pedido</span>
										</Button>
									</div>
								{:else if order.status === 'pending'}
									<div class="flex items-center gap-2 pt-1">
										<Button
											type="button"
											size="sm"
											variant="outline"
											class="h-9 gap-1 px-2.5 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
											title="Cancelar orden"
											onclick={() => onCancelOrder(order)}
										>
											<X class="size-3.5" />
											<span>Cancelar</span>
										</Button>

										<Button
											type="button"
											size="sm"
											variant="outline"
											class="flex-1 h-9 gap-1.5 text-xs font-medium"
											title="Ver listado de ítems y detalle de la orden"
											onclick={() => onViewOrder(order)}
										>
											<Eye class="size-3.5" />
											<span>Ver Ítems</span>
										</Button>

										<Button
											type="button"
											size="sm"
											class="flex-1 h-9 gap-1.5 text-xs font-semibold"
											title="Entregar orden y marcar como finalizada"
											onclick={() => onDeliverOrder(order)}
										>
											<Check class="size-3.5" />
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
