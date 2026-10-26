<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import {
		isOrderReadyToDeliver,
		type ForecastHorizon,
		type OrderWithItems,
		type PreorderForecastSummary
	} from '#lib/features/orders/domain/order.entity';
	import { Button } from '#lib/components/ui/button';
	import { Badge } from '#lib/components/ui/badge';
	import Zap from '@lucide/svelte/icons/zap';
	import Wheat from '@lucide/svelte/icons/wheat';
	import ChefHat from '@lucide/svelte/icons/chef-hat';
	import PackageCheck from '@lucide/svelte/icons/package-check';
	import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import DollarSign from '@lucide/svelte/icons/dollar-sign';
	import Check from '@lucide/svelte/icons/check';
	import Store from '@lucide/svelte/icons/store';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Eye from '@lucide/svelte/icons/eye';
	import Clock from '@lucide/svelte/icons/clock';
	import { toast } from '#lib/components/ui/toast';
	import { formatCurrency } from '../utils';

	interface Props {
		orders: OrderWithItems[];
		forecast: PreorderForecastSummary;
		forecastHorizon: ForecastHorizon;
		preserveDisplayStock: boolean;
		businessId: string;
		onViewOrder: (order: OrderWithItems) => void;
		onPayOrder: (order: OrderWithItems) => void;
		onDeliverOrder: (order: OrderWithItems) => void;
		onConfirmOrder: (order: OrderWithItems) => void;
		onProduceOrders: (orders: OrderWithItems[], periodLabel: string) => void;
		onSwitchToDetailedTabs: () => void;
	}

	let {
		orders,
		forecast,
		forecastHorizon = 'all',
		preserveDisplayStock = false,
		businessId,
		onViewOrder,
		onPayOrder,
		onDeliverOrder,
		onConfirmOrder,
		onProduceOrders,
		onSwitchToDetailedTabs
	}: Props = $props();

	const HORIZON_OPTIONS: Array<{ id: ForecastHorizon; label: string; desc: string }> = [
		{ id: 'today', label: 'Hoy', desc: 'Operación del día' },
		{ id: '3d', label: 'Próx. 3 Días', desc: 'Ventana de 72 hs' },
		{ id: '7d', label: '1 Semana', desc: 'Próximos 7 días' },
		{ id: 'all', label: 'Todo', desc: 'Todos los pedidos activos' }
	];

	const activeHorizonMeta = $derived(
		HORIZON_OPTIONS.find((h) => h.id === forecastHorizon) ?? HORIZON_OPTIONS[3]
	);

	function setHorizon(horizon: ForecastHorizon) {
		if (typeof window === 'undefined') return;
		const url = new URL(window.location.href);
		url.searchParams.set('tab', 'loop');
		if (horizon === 'all') {
			url.searchParams.delete('horizon');
		} else {
			url.searchParams.set('horizon', horizon);
		}
		goto(`${url.pathname}${url.search}`);
	}

	function togglePreserveDisplay() {
		if (typeof window === 'undefined') return;
		const url = new URL(window.location.href);
		url.searchParams.set('tab', 'loop');
		if (preserveDisplayStock) {
			url.searchParams.delete('preserveDisplay');
		} else {
			url.searchParams.set('preserveDisplay', '1');
		}
		goto(`${url.pathname}${url.search}`);
	}

	// Filtrar órdenes según el mismo horizonte seleccionado
	const ordersInHorizon = $derived.by(() => {
		const now = new Date();
		const endWindow = new Date(now);
		if (forecastHorizon === 'today') {
			endWindow.setHours(23, 59, 59, 999);
		} else if (forecastHorizon === '3d') {
			endWindow.setDate(endWindow.getDate() + 3);
			endWindow.setHours(23, 59, 59, 999);
		} else if (forecastHorizon === '7d') {
			endWindow.setDate(endWindow.getDate() + 7);
			endWindow.setHours(23, 59, 59, 999);
		}

		return orders
			.filter((o) => {
				if (o.status === 'cancelled' || o.status === 'completed') return false;
				if (forecastHorizon === 'all') return true;
				if (!o.deliveryDate) return true;
				return new Date(o.deliveryDate).getTime() <= endWindow.getTime();
			})
			.sort((a, b) => {
				const tA = a.deliveryDate ? new Date(a.deliveryDate).getTime() : Number.MAX_SAFE_INTEGER;
				const tB = b.deliveryDate ? new Date(b.deliveryDate).getTime() : Number.MAX_SAFE_INTEGER;
				return tA - tB;
			});
	});

	// Paso 1: Insumos que faltan comprar
	const missingRawMaterials = $derived(
		(forecast.rawMaterialForecast ?? []).filter(
			(r) => (r.deficitQuantity ?? 0) > 0 || r.isBelowMinStock
		)
	);

	// Paso 2: Pedidos pendientes de producir + Elaboraciones / Productos en demanda
	const producibleOrders = $derived(
		ordersInHorizon.filter(
			(o) => o.status === 'pending' && o.items.some((i) => i.status === 'pending_delivery')
		)
	);

	const readyOrders = $derived(ordersInHorizon.filter((o) => isOrderReadyToDeliver(o)));

	const fabricableItems = $derived.by(() => {
		const list: Array<{
			id: string;
			code: string;
			name: string;
			baseUnit: string;
			currentStock: number;
			requiredQty: number;
			deficitQty: number;
			defaultProduceQty: number;
			isMakeToOrder: boolean;
		}> = [];

		for (const sub of forecast.subAssemblyForecast ?? []) {
			const req = sub.requiredQuantity ?? 0;
			const def = sub.deficitQuantity ?? 0;
			if (req <= 0 && def <= 0) continue;
			list.push({
				id: sub.itemId,
				code: sub.code,
				name: sub.name,
				baseUnit: sub.baseUnit,
				currentStock: sub.currentStock ?? 0,
				requiredQty: req,
				deficitQty: def,
				defaultProduceQty: Number((def > 0 ? def : req).toFixed(2)),
				isMakeToOrder: Boolean(sub.isMakeToOrder)
			});
		}

		for (const prod of forecast.productDemands ?? []) {
			const req = prod.totalOrderedQty ?? 0;
			const def = prod.deficitQuantity ?? 0;
			if (req <= 0 && def <= 0) continue;
			if (list.some((x) => x.id === prod.itemId)) continue;
			list.push({
				id: prod.itemId,
				code: prod.code,
				name: prod.name,
				baseUnit: prod.baseUnit,
				currentStock: prod.currentProductStock ?? 0,
				requiredQty: req,
				deficitQty: def,
				defaultProduceQty: Number((def > 0 ? def : req).toFixed(2)),
				isMakeToOrder: Boolean(prod.isMakeToOrder)
			});
		}

		return list;
	});

	function formatNum(n: number): string {
		if (!Number.isFinite(n)) return '0';
		return Number(n.toFixed(2)).toString();
	}

	function formatUnit(u: string): string {
		const map: Record<string, string> = { unit: 'u.', g: 'g', kg: 'kg', ml: 'ml', l: 'L' };
		return map[u] ?? u;
	}

	function formatDeliveryShort(dateVal: Date | string | null): string {
		if (!dateVal) return 'Sin horario';
		const d = new Date(dateVal);
		const today = new Date();
		const isToday =
			d.getDate() === today.getDate() &&
			d.getMonth() === today.getMonth() &&
			d.getFullYear() === today.getFullYear();
		const timeStr = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
		if (isToday) return `Hoy ${timeStr}`;
		const dayStr = d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
		return `${dayStr} ${timeStr}`;
	}
</script>

<div class="space-y-5">
	<!-- Cabecera del Modo Loop + Selector de Ventana -->
	<div class="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
		<div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
			<div class="flex items-start gap-3">
				<div class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
					<Zap class="size-5" />
				</div>
				<div class="space-y-0.5">
					<div class="flex flex-wrap items-center gap-2">
						<h2 class="text-base sm:text-lg font-bold text-foreground">
							Modo Loop Operativo
						</h2>
						<Badge variant="outline" class="border-primary/30 bg-primary/10 text-primary text-xs">
							{activeHorizonMeta.label} · {ordersInHorizon.length} {ordersInHorizon.length === 1 ? 'pedido activo' : 'pedidos activos'}
						</Badge>
					</div>
					<p class="text-xs text-muted-foreground">
						Sigue los 3 pasos de izquierda a derecha para cubrir el período elegido sin navegar por tablas complejas.
					</p>
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<!-- Selector de Ventana Temporal -->
				<div class="inline-flex items-center rounded-xl border border-border bg-muted/40 p-1">
					{#each HORIZON_OPTIONS as h (h.id)}
						<button
							type="button"
							onclick={() => setHorizon(h.id)}
							class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer {forecastHorizon ===
							h.id
								? 'bg-primary text-primary-foreground shadow-xs'
								: 'text-muted-foreground hover:text-foreground'}"
						>
							{h.label}
						</button>
					{/each}
				</div>

				<!-- Switch Proteger Vidriera -->
				<button
					type="button"
					onclick={togglePreserveDisplay}
					class="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer {preserveDisplayStock
						? 'border-secondary bg-secondary/15 text-secondary'
						: 'border-border bg-background text-muted-foreground hover:text-foreground'}"
					title="Si está activo, no usa tu stock actual y te pide producir el 100% de los pedidos"
				>
					<Store class="size-3.5" />
					<span>Proteger Stock: {preserveDisplayStock ? 'SÍ' : 'NO'}</span>
				</button>

				<Button
					type="button"
					variant="ghost"
					size="sm"
					class="text-xs text-muted-foreground hover:text-foreground"
					onclick={onSwitchToDetailedTabs}
				>
					Ver tablas detalladas
				</Button>
			</div>
		</div>
	</div>

	<!-- Los 3 Pasos del Business Loop -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
		<!-- ========================================================= -->
		<!-- PASO 1: ABASTECER (INSUMOS)                               -->
		<!-- ========================================================= -->
		<div class="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
			<div class="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
				<div class="flex items-center gap-2">
					<span class="flex size-6 items-center justify-center rounded-full bg-amber-500/15 font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
						1
					</span>
					<div>
						<h3 class="text-sm font-bold text-foreground">Abastecer Insumos</h3>
						<p class="text-[11px] text-muted-foreground">Materias primas para {activeHorizonMeta.label.toLowerCase()}</p>
					</div>
				</div>
				{#if missingRawMaterials.length === 0}
					<Badge variant="outline" class="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px]">
						Cubierto
					</Badge>
				{:else}
					<Badge variant="outline" class="border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-[11px]">
						{missingRawMaterials.length} {missingRawMaterials.length === 1 ? 'faltante' : 'faltantes'}
					</Badge>
				{/if}
			</div>

			{#if missingRawMaterials.length === 0}
				<div class="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 text-center space-y-1.5">
					<CheckCircle2 class="size-7 text-emerald-500 mx-auto" />
					<p class="text-xs font-bold text-foreground">¡Insumos listos!</p>
					<p class="text-[11px] text-muted-foreground">
						Tienes suficiente materia prima en stock para cubrir todos los pedidos de este período.
					</p>
				</div>
			{:else}
				<div class="space-y-2 max-h-80 overflow-y-auto pr-1">
					{#each missingRawMaterials as raw (raw.itemId)}
						<div class="flex items-center justify-between gap-2 rounded-xl border border-red-500/25 bg-red-500/5 px-3 py-2.5 text-xs">
							<div class="min-w-0">
								<p class="font-bold text-foreground truncate">{raw.name}</p>
								<p class="text-[11px] text-muted-foreground font-mono">
									En stock: {formatNum(raw.currentStock)} {formatUnit(raw.baseUnit)} · Req: {formatNum(raw.requiredQuantity)} {formatUnit(raw.baseUnit)}
								</p>
							</div>
							<div class="text-right shrink-0">
								{#if (raw.deficitQuantity ?? 0) > 0}
									<span class="inline-flex items-center gap-1 rounded-md bg-red-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-red-600 dark:text-red-400">
										<AlertTriangle class="size-3" />
										Falta {formatNum(raw.deficitQuantity)} {formatUnit(raw.baseUnit)}
									</span>
								{:else}
									<span class="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400">
										Bajo mín.
									</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>

				<Button href="/inventory" variant="outline" size="sm" class="w-full justify-between text-xs font-semibold">
					<span class="inline-flex items-center gap-1.5">
						<Wheat class="size-3.5" />
						Ir a Cargar Lote de Compra
					</span>
					<ArrowRight class="size-3.5" />
				</Button>
			{/if}
		</div>

		<!-- ========================================================= -->
		<!-- PASO 2: PRODUCIR EN LOTE (BASES Y PEDIDOS)                -->
		<!-- ========================================================= -->
		<div class="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
			<div class="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
				<div class="flex items-center gap-2">
					<span class="flex size-6 items-center justify-center rounded-full bg-primary/15 font-mono text-xs font-bold text-primary">
						2
					</span>
					<div>
						<h3 class="text-sm font-bold text-foreground">Producir Tanda</h3>
						<p class="text-[11px] text-muted-foreground">De base sugiere lo que falta; cámbialo si hiciste más</p>
					</div>
				</div>
				{#if producibleOrders.length > 0}
					<Badge variant="outline" class="border-primary/30 bg-primary/10 text-primary text-[11px]">
						{producibleOrders.length} {producibleOrders.length === 1 ? 'pedido' : 'pedidos'} por armar
					</Badge>
				{:else}
					<Badge variant="outline" class="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px]">
						Al día
					</Badge>
				{/if}
			</div>

			<!-- Botón Principal: Hoja de Producción de todos los pedidos del período -->
			{#if producibleOrders.length > 0}
				<div class="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2.5">
					<div class="flex items-center justify-between gap-2">
						<span class="text-xs font-bold text-foreground">
							Pedidos en preparación ({producibleOrders.length})
						</span>
						<span class="font-mono text-[11px] text-primary font-semibold">
							{activeHorizonMeta.label}
						</span>
					</div>
					<p class="text-[11px] text-muted-foreground leading-relaxed">
						Marca los pedidos como <strong>Listos p/ retirar</strong> y descuenta sus insumos. Si cocinaste unidades de más, podrás sumarlas al stock ahí mismo.
					</p>
					<Button
						type="button"
						size="sm"
						class="w-full gap-1.5 font-semibold shadow-xs"
						onclick={() => onProduceOrders(producibleOrders, activeHorizonMeta.label)}
					>
						<ChefHat class="size-4" />
						<span>Abrir Hoja de Producción ({producibleOrders.length})</span>
					</Button>
				</div>
			{:else}
				<div class="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5 text-center space-y-1">
					<CheckCircle2 class="size-6 text-emerald-500 mx-auto" />
					<p class="text-xs font-bold text-foreground">Todos los pedidos del período están producidos</p>
					<p class="text-[11px] text-muted-foreground">
						No quedan pedidos pendientes de elaborar en esta ventana.
					</p>
				</div>
			{/if}

			<!-- Lista rápida de Elaboraciones / Bases para producir directo a stock -->
			{#if fabricableItems.length > 0}
				<div class="space-y-2 pt-1">
					<span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
						Elaboraciones / Bases para Stock:
					</span>
					<div class="space-y-2 max-h-64 overflow-y-auto pr-1">
						{#each fabricableItems as item (item.id)}
							{#if !item.isMakeToOrder}
								<div class="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs">
									<div class="min-w-0">
										<p class="font-bold text-foreground truncate" title={item.name}>{item.name}</p>
										<p class="text-[10px] font-mono text-muted-foreground">
											Stock: <strong class="text-blue-600 dark:text-blue-400">{formatNum(item.currentStock)}</strong> · Demanda: <strong class="text-red-600 dark:text-red-400">{formatNum(item.requiredQty)} {formatUnit(item.baseUnit)}</strong>
											{#if item.deficitQty > 0}
												<span class="text-red-600 dark:text-red-400 font-bold"> (Faltan {formatNum(item.deficitQty)})</span>
											{/if}
										</p>
									</div>

									<form
										method="POST"
										action="?/produceForecastItem"
										class="inline-flex items-center gap-1 shrink-0"
										use:enhance={() => {
											return async ({ result, update }) => {
												await update();
												if (result.type === 'success') {
													const msg = (result.data as { message?: string })?.message ?? 'Lote producido.';
													toast.success('¡Stock producido!', msg);
												} else if (result.type === 'failure') {
													const err = (result.data as { error?: string })?.error ?? 'Error al producir.';
													toast.error('Error', err);
												}
											};
										}}
									>
										<input type="hidden" name="businessId" value={businessId} />
										<input type="hidden" name="itemId" value={item.id} />
										<input
											type="number"
											name="quantity"
											min="0.01"
											step="any"
											value={item.defaultProduceQty}
											class="w-14 rounded-lg border border-border bg-background px-1.5 py-1 text-center font-mono text-xs font-bold text-foreground focus:border-primary focus:outline-none"
											title="Cantidad a producir (puedes cambiarla para producir más)"
										/>
										<button
											type="submit"
											class="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-2xs hover:bg-primary/90 cursor-pointer"
										>
											<ChefHat class="size-3" />
											<span>Producir</span>
										</button>
									</form>
								</div>
							{/if}
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- ========================================================= -->
		<!-- PASO 3: ENTREGAR Y COBRAR                                 -->
		<!-- ========================================================= -->
		<div class="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
			<div class="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
				<div class="flex items-center gap-2">
					<span class="flex size-6 items-center justify-center rounded-full bg-emerald-500/15 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
						3
					</span>
					<div>
						<h3 class="text-sm font-bold text-foreground">Entregar y Cobrar</h3>
						<p class="text-[11px] text-muted-foreground">
							{readyOrders.length} {readyOrders.length === 1 ? 'listo' : 'listos'} p/ retirar · {ordersInHorizon.length} en total
						</p>
					</div>
				</div>
			</div>

			{#if ordersInHorizon.length === 0}
				<div class="rounded-xl border border-dashed border-border p-6 text-center space-y-1.5">
					<CheckCircle2 class="size-7 text-emerald-500 mx-auto" />
					<p class="text-xs font-bold text-foreground">No hay entregas pendientes en este período</p>
					<p class="text-[11px] text-muted-foreground">
						Todos los pedidos de esta ventana ya fueron entregados.
					</p>
				</div>
			{:else}
				<div class="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
					{#each ordersInHorizon as order (order.id)}
						{@const isReady = isOrderReadyToDeliver(order)}
						{@const pendingDebt = Math.max(0, order.totalAmount - order.paidAmount)}
						{@const canProduceSingle =
							order.status === 'pending' && order.items.some((i) => i.status === 'pending_delivery')}

						<div
							class="rounded-xl border p-3 space-y-2.5 transition-all {isReady
								? 'border-emerald-500/40 bg-emerald-500/5'
								: 'border-border bg-background'}"
						>
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0">
									<div class="flex items-center gap-1.5 flex-wrap">
										<button
											type="button"
											onclick={() => onViewOrder(order)}
											class="font-mono text-xs font-bold text-foreground hover:underline cursor-pointer"
										>
											{order.orderNumber}
										</button>
										<span class="font-bold text-xs text-foreground truncate">
											· {order.customerName}
										</span>
										{#if isReady}
											<span class="inline-flex items-center gap-0.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
												<PackageCheck class="size-3" /> Listo p/ retirar
											</span>
										{:else if order.status === 'unconfirmed'}
											<span class="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
												Por confirmar
											</span>
										{/if}
									</div>
									<p class="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
										<Clock class="size-3" />
										<span>{formatDeliveryShort(order.deliveryDate)}</span>
										<span>·</span>
										<span>{order.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}</span>
									</p>
								</div>

								<button
									type="button"
									onclick={() => onViewOrder(order)}
									class="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
									title="Ver detalle"
								>
									<Eye class="size-3.5" />
								</button>
							</div>

							<!-- Botones directos de acción en 1 clic -->
							<div class="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-border/50">
								<div class="text-[11px] font-mono">
									{#if pendingDebt > 0}
										<span class="text-amber-600 dark:text-amber-400 font-bold">
											Falta cobrar: {formatCurrency(pendingDebt)}
										</span>
									{:else}
										<span class="text-emerald-600 dark:text-emerald-400 font-semibold">
											✓ Pagado ({formatCurrency(order.totalAmount)})
										</span>
									{/if}
								</div>

								<div class="flex items-center gap-1.5">
									{#if pendingDebt > 0}
										<Button
											type="button"
											size="sm"
											variant="outline"
											class="h-7 px-2.5 text-xs font-semibold border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
											onclick={() => onPayOrder(order)}
										>
											<DollarSign class="size-3 mr-0.5" />
											Cobrar
										</Button>
									{/if}

									{#if order.status === 'unconfirmed'}
										<Button
											type="button"
											size="sm"
											variant="secondary"
											class="h-7 px-2.5 text-xs font-semibold"
											onclick={() => onConfirmOrder(order)}
										>
											Confirmar
										</Button>
									{:else}
										{#if canProduceSingle}
											<Button
												type="button"
												size="sm"
												variant="outline"
												class="h-7 px-2 text-xs border-primary/30 text-primary hover:bg-primary/10"
												onclick={() => onProduceOrders([order], order.orderNumber)}
												title="Producir este pedido ahora"
											>
												<ChefHat class="size-3 mr-1" />
												Listo
											</Button>
										{/if}
										<Button
											type="button"
											size="sm"
											variant="default"
											class="h-7 px-2.5 text-xs font-semibold gap-1"
											onclick={() => onDeliverOrder(order)}
										>
											<Check class="size-3" />
											Entregar
										</Button>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
