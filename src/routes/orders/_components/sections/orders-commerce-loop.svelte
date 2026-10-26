<script lang="ts">
	import { goto } from '$app/navigation';
	import type { Item } from '#lib/features/items/domain/item.entity';
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
	import Package from '@lucide/svelte/icons/package';
	import PackagePlus from '@lucide/svelte/icons/package-plus';
	import PackageCheck from '@lucide/svelte/icons/package-check';
	import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import Check from '@lucide/svelte/icons/check';
	import Store from '@lucide/svelte/icons/store';
	import Eye from '@lucide/svelte/icons/eye';
	import Clock from '@lucide/svelte/icons/clock';
	import List from '@lucide/svelte/icons/list';
	import Crosshair from '@lucide/svelte/icons/crosshair';
	import Layers from '@lucide/svelte/icons/layers';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import { formatCurrency } from '../utils';

	interface Props {
		items: Item[];
		orders: OrderWithItems[];
		forecast: PreorderForecastSummary;
		forecastHorizon: ForecastHorizon;
		preserveDisplayStock: boolean;
		onViewOrder: (order: OrderWithItems) => void;
		onDeliverOrder: (order: OrderWithItems) => void;
		onConfirmOrder: (order: OrderWithItems) => void;
		onProduceOrders: (orders: OrderWithItems[], periodLabel: string) => void;
		onOpenAddStockModal: (item: Item, suggestedQty?: number) => void;
		onSwitchToDetailedTabs: () => void;
	}

	let {
		items = [],
		orders,
		forecast,
		forecastHorizon = 'all',
		preserveDisplayStock = false,
		onViewOrder,
		onDeliverOrder,
		onConfirmOrder,
		onProduceOrders,
		onOpenAddStockModal,
		onSwitchToDetailedTabs
	}: Props = $props();

	// Paso activo en mobile (1 = Insumos, 2 = Producción, 3 = Entregas)
	let mobileStep = $state<1 | 2 | 3>(2);

	// Multiplicadores personalizados por ítem elaborado (en unidades de tanda: 1x, 2x, 3x...)
	let customMultipliers = $state<Record<string, number>>({});

	const HORIZON_OPTIONS: Array<{ id: ForecastHorizon; label: string }> = [
		{ id: 'today', label: 'Hoy' },
		{ id: '3d', label: '3d' },
		{ id: '7d', label: '7d' },
		{ id: 'all', label: 'Todo' }
	];

	const activeHorizonLabel = $derived(
		HORIZON_OPTIONS.find((h) => h.id === forecastHorizon)?.label ?? 'Todo'
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

	const itemsById = $derived(new Map(items.map((i) => [i.id, i])));

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

	// Paso 1: Materias primas del período (faltantes primero, luego el resto)
	const rawMaterialLines = $derived.by(() => {
		const lines = [...(forecast.rawMaterialForecast ?? [])];
		return lines.sort((a, b) => {
			const aShort = (a.deficitQuantity ?? 0) > 0 ? 2 : a.isBelowMinStock ? 1 : 0;
			const bShort = (b.deficitQuantity ?? 0) > 0 ? 2 : b.isBelowMinStock ? 1 : 0;
			return bShort - aShort;
		});
	});

	const missingRawCount = $derived(
		rawMaterialLines.filter((r) => (r.deficitQuantity ?? 0) > 0 || r.isBelowMinStock).length
	);

	// Paso 2: Pedidos por armar y elaboraciones con múltiplos de receta
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
			yieldQty: number;
			defaultBatches: number;
			isMakeToOrder: boolean;
		}> = [];

		for (const sub of forecast.subAssemblyForecast ?? []) {
			const req = sub.requiredQuantity ?? 0;
			const def = sub.deficitQuantity ?? 0;
			if (req <= 0 && def <= 0) continue;
			const fullItem = itemsById.get(sub.itemId);
			const yieldQty =
				fullItem?.yieldQuantity && fullItem.yieldQuantity > 0
					? fullItem.yieldQuantity
					: sub.yieldQuantity && sub.yieldQuantity > 0
						? sub.yieldQuantity
						: 1;
			const baseTarget = def > 0 ? def : req;
			const defaultBatches = Math.max(1, Math.ceil(baseTarget / yieldQty));
			list.push({
				id: sub.itemId,
				code: sub.code,
				name: sub.name,
				baseUnit: sub.baseUnit,
				currentStock: sub.currentStock ?? 0,
				requiredQty: req,
				deficitQty: def,
				yieldQty,
				defaultBatches,
				isMakeToOrder: Boolean(sub.isMakeToOrder)
			});
		}

		for (const prod of forecast.productDemands ?? []) {
			const req = prod.totalOrderedQty ?? 0;
			const def = prod.deficitQuantity ?? 0;
			if (req <= 0 && def <= 0) continue;
			if (list.some((x) => x.id === prod.itemId)) continue;
			const fullItem = itemsById.get(prod.itemId);
			const yieldQty =
				fullItem?.yieldQuantity && fullItem.yieldQuantity > 0
					? fullItem.yieldQuantity
					: prod.yieldQuantity && prod.yieldQuantity > 0
						? prod.yieldQuantity
						: 1;
			const baseTarget = def > 0 ? def : req;
			const defaultBatches = Math.max(1, Math.ceil(baseTarget / yieldQty));
			list.push({
				id: prod.itemId,
				code: prod.code,
				name: prod.name,
				baseUnit: prod.baseUnit,
				currentStock: prod.currentProductStock ?? 0,
				requiredQty: req,
				deficitQty: def,
				yieldQty,
				defaultBatches,
				isMakeToOrder: Boolean(prod.isMakeToOrder)
			});
		}

		return list.filter((i) => !i.isMakeToOrder);
	});

	function getBatches(itemId: string, defaultBatches: number): number {
		const custom = customMultipliers[itemId];
		if (custom === undefined || Number.isNaN(custom) || custom < 1) {
			return defaultBatches;
		}
		return custom;
	}

	function setBatches(itemId: string, nextBatches: number) {
		customMultipliers = {
			...customMultipliers,
			[itemId]: Math.max(1, Math.round(nextBatches))
		};
	}

	function handleOpenRawStockModal(itemId: string, deficitQty: number, requiredQty: number) {
		const found = itemsById.get(itemId);
		if (!found) return;
		const suggested = deficitQty > 0 ? deficitQty : requiredQty > 0 ? requiredQty : undefined;
		onOpenAddStockModal(found, suggested);
	}

	function handleOpenPreparedStockModal(itemId: string, totalQtyToProduce: number) {
		const found = itemsById.get(itemId);
		if (!found) return;
		onOpenAddStockModal(found, totalQtyToProduce);
	}

	function formatNum(n: number): string {
		if (!Number.isFinite(n)) return '0';
		return Number(n.toFixed(2)).toString();
	}

	function formatUnit(u: string): string {
		const map: Record<string, string> = { unit: 'u.', g: 'g', kg: 'kg', ml: 'ml', l: 'L' };
		return map[u] ?? u;
	}

	function formatDeliveryShort(dateVal: Date | string | null): string {
		if (!dateVal) return 'Inmediata';
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

<div class="space-y-4 pb-20 lg:pb-4">
	<!-- Barra Superior Compacta del Modo Loop -->
	<div class="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 shadow-xs">
		<div class="flex items-center gap-2.5">
			<div class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-2xs">
				<Zap class="size-4.5" />
			</div>
			<div class="flex items-center gap-2">
				<h2 class="text-sm sm:text-base font-bold text-foreground">Loop</h2>
				<Badge variant="outline" class="border-primary/30 bg-primary/10 text-primary font-mono text-xs px-2 py-0.5" title="Pedidos activos en la ventana seleccionada">
					<ShoppingBag class="size-3 mr-1" />
					{ordersInHorizon.length}
				</Badge>
			</div>
		</div>

		<div class="flex items-center gap-1.5">
			<!-- Selector de Ventana Temporal -->
			<div class="inline-flex items-center rounded-xl border border-border bg-muted/40 p-0.5">
				{#each HORIZON_OPTIONS as h (h.id)}
					<button
						type="button"
						onclick={() => setHorizon(h.id)}
						class="rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer {forecastHorizon ===
						h.id
							? 'bg-primary text-primary-foreground shadow-2xs'
							: 'text-muted-foreground hover:text-foreground'}"
					>
						{h.label}
					</button>
				{/each}
			</div>

			<!-- Botón Icono: Proteger Stock de Vidriera -->
			<button
				type="button"
				onclick={togglePreserveDisplay}
				class="inline-flex size-8 items-center justify-center rounded-xl border transition-colors cursor-pointer {preserveDisplayStock
					? 'border-secondary bg-secondary/15 text-secondary'
					: 'border-border bg-background text-muted-foreground hover:text-foreground'}"
				title={preserveDisplayStock
					? 'Proteger stock de vidriera: ACTIVO (no descuenta tu stock actual)'
					: 'Proteger stock de vidriera: INACTIVO (usa tu stock disponible)'}
			>
				<Store class="size-4" />
			</button>

			<!-- Botón Icono: Ir a Vista de Tablas Detalladas -->
			<button
				type="button"
				onclick={onSwitchToDetailedTabs}
				class="inline-flex size-8 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
				title="Ver tablas detalladas"
			>
				<List class="size-4" />
			</button>
		</div>
	</div>

	<!-- Las 3 Columnas del Loop (En mobile se muestra la sección activa seleccionada abajo a la derecha) -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
		<!-- ========================================================= -->
		<!-- SECCIÓN 1: INSUMOS (ABASTECER)                            -->
		<!-- ========================================================= -->
		<div
			class="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3 overflow-hidden {mobileStep === 1
				? 'block'
				: 'hidden lg:block'}"
		>
			<div class="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
				<div class="flex items-center gap-2">
					<span class="flex size-6 items-center justify-center rounded-lg bg-amber-500/15 font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
						1
					</span>
					<Wheat class="size-4 text-amber-500" />
					<h3 class="text-sm font-bold text-foreground">Insumos</h3>
				</div>

				{#if missingRawCount === 0}
					<span
						class="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400"
						title="Todos los insumos cubiertos"
					>
						<CheckCircle2 class="size-3.5" />
					</span>
				{:else}
					<span
						class="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 font-mono text-xs font-bold text-red-600 dark:text-red-400"
						title="{missingRawCount} insumos en falta"
					>
						<AlertTriangle class="size-3.5" />
						{missingRawCount}
					</span>
				{/if}
			</div>

			{#if rawMaterialLines.length === 0}
				<div class="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 py-6 px-3 text-emerald-600 dark:text-emerald-400">
					<CheckCircle2 class="size-5 shrink-0" />
					<span class="text-xs font-bold">Stock cubierto</span>
				</div>
			{:else}
				<div class="space-y-2 max-h-[420px] overflow-y-auto pr-0.5">
					{#each rawMaterialLines as raw (raw.itemId)}
						{@const isShort = (raw.deficitQuantity ?? 0) > 0}
						{@const isLow = !isShort && raw.isBelowMinStock}
						<div
							class="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs transition-colors overflow-hidden {isShort
								? 'border-red-500/30 bg-red-500/5'
								: isLow
									? 'border-amber-500/30 bg-amber-500/5'
									: 'border-border bg-background'}"
						>
							<div class="min-w-0 flex-1 space-y-1">
								<div class="flex items-center gap-1.5 min-w-0">
									<span
										class="size-2 shrink-0 rounded-full {isShort
											? 'bg-red-500 animate-pulse'
											: isLow
												? 'bg-amber-500'
												: 'bg-emerald-500'}"
									></span>
									<span class="font-bold text-foreground truncate" title={raw.name}>
										{raw.name}
									</span>
								</div>

								<!-- Indicadores por Iconos (Stock · Demanda · Falta) -->
								<div class="flex flex-wrap items-center gap-2 font-mono text-[11px]">
									<span class="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold" title="Stock disponible">
										<Package class="size-3" />
										{formatNum(raw.currentStock)} {formatUnit(raw.baseUnit)}
									</span>
									<span class="inline-flex items-center gap-1 text-muted-foreground" title="Demanda requerida">
										<Crosshair class="size-3" />
										{formatNum(raw.requiredQuantity)} {formatUnit(raw.baseUnit)}
									</span>
									{#if isShort}
										<span class="inline-flex items-center gap-0.5 text-red-600 dark:text-red-400 font-bold" title="Cantidad faltante">
											<AlertTriangle class="size-3" />
											-{formatNum(raw.deficitQuantity)}
										</span>
									{/if}
								</div>
							</div>

							<Button
								type="button"
								size="sm"
								variant={isShort ? 'default' : 'outline'}
								class="h-7 px-2 sm:px-2.5 gap-1 text-xs font-semibold shrink-0 cursor-pointer"
								title="Cargar lote de compra en esta pantalla"
								onclick={() =>
									handleOpenRawStockModal(
										raw.itemId,
										raw.deficitQuantity ?? 0,
										raw.requiredQuantity ?? 0
									)}
							>
								<PackagePlus class="size-3.5" />
								<span>Lote</span>
							</Button>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- ========================================================= -->
		<!-- SECCIÓN 2: PRODUCCIÓN (MÚLTIPLOS DE RECETA + MODAL)       -->
		<!-- ========================================================= -->
		<div
			class="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3 overflow-hidden {mobileStep === 2
				? 'block'
				: 'hidden lg:block'}"
		>
			<div class="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
				<div class="flex items-center gap-2">
					<span class="flex size-6 items-center justify-center rounded-lg bg-primary/15 font-mono text-xs font-bold text-primary">
						2
					</span>
					<ChefHat class="size-4 text-primary" />
					<h3 class="text-sm font-bold text-foreground">Producción</h3>
				</div>

				{#if producibleOrders.length > 0 || fabricableItems.some((f) => f.deficitQty > 0)}
					<span
						class="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-mono text-xs font-bold text-primary"
						title="Pedidos pendientes de producir"
					>
						<ChefHat class="size-3.5" />
						{producibleOrders.length}
					</span>
				{:else}
					<span
						class="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400"
						title="Producción al día"
					>
						<CheckCircle2 class="size-3.5" />
					</span>
				{/if}
			</div>

			<!-- Acción de Lote de Pedidos -->
			{#if producibleOrders.length > 0}
				<Button
					type="button"
					size="sm"
					class="w-full h-9 justify-between px-3 font-semibold shadow-2xs cursor-pointer"
					onclick={() => onProduceOrders(producibleOrders, activeHorizonLabel)}
					title="Abrir Hoja de Producción para marcar pedidos como Listos"
				>
					<span class="inline-flex items-center gap-1.5">
						<ChefHat class="size-4" />
						<span>Hoja de Producción</span>
					</span>
					<span class="rounded-md bg-primary-foreground/20 px-2 py-0.5 font-mono text-xs font-bold">
						{producibleOrders.length} {producibleOrders.length === 1 ? 'pedido' : 'pedidos'}
					</span>
				</Button>
			{/if}

			<!-- Lista de Elaboraciones con Stepper por Múltiplos de Receta y Modal de Carga -->
			{#if fabricableItems.length === 0 && producibleOrders.length === 0}
				<div class="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 py-6 px-3 text-emerald-600 dark:text-emerald-400">
					<CheckCircle2 class="size-5 shrink-0" />
					<span class="text-xs font-bold">Sin pendientes</span>
				</div>
			{:else if fabricableItems.length > 0}
				<div class="space-y-2 max-h-[380px] overflow-y-auto pr-0.5">
					{#each fabricableItems as item (item.id)}
						{@const batches = getBatches(item.id, item.defaultBatches)}
						{@const totalProduceQty = Number((batches * item.yieldQty).toFixed(2))}
						{@const isShort = item.deficitQty > 0}

						<div
							class="rounded-xl border p-2.5 space-y-2 text-xs transition-colors overflow-hidden {isShort
								? 'border-red-500/30 bg-red-500/5'
								: 'border-border bg-background'}"
						>
							<div class="flex items-center justify-between gap-2">
								<div class="flex items-center gap-1.5 min-w-0">
									<span
										class="size-2 shrink-0 rounded-full {isShort
											? 'bg-red-500 animate-pulse'
											: 'bg-emerald-500'}"
									></span>
									<span class="font-bold text-foreground truncate" title={item.name}>
										{item.name}
									</span>
								</div>

								<!-- Badge de capacidad de receta (1 tanda = yieldQty) -->
								<span
									class="inline-flex items-center gap-1 rounded-md bg-secondary/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-secondary shrink-0"
									title="Capacidad por receta (1 tanda = {formatNum(item.yieldQty)} {formatUnit(item.baseUnit)})"
								>
									<Layers class="size-2.5" />
									1x = {formatNum(item.yieldQty)} {formatUnit(item.baseUnit)}
								</span>
							</div>

							<div class="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
								<!-- Estado en Iconos: Stock · Demanda · Falta -->
								<div class="flex items-center gap-2 font-mono text-[11px] shrink-0">
									<span class="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold" title="Stock actual">
										<Package class="size-3" />
										{formatNum(item.currentStock)}
									</span>
									<span class="inline-flex items-center gap-1 text-muted-foreground" title="Demanda del período">
										<Crosshair class="size-3" />
										{formatNum(item.requiredQty)}
									</span>
									{#if isShort}
										<span class="inline-flex items-center gap-0.5 text-red-600 dark:text-red-400 font-bold" title="Faltante">
											<AlertTriangle class="size-3" />
											-{formatNum(item.deficitQty)}
										</span>
									{/if}
								</div>

								<!-- Selector de Múltiplos de Receta + Botón que abre el Modal de Carga -->
								<div class="flex items-center gap-1.5 shrink-0">
									<div
										class="inline-flex items-center rounded-lg border border-border bg-card"
										title="Cambiar entre múltiplos de la receta ({batches} {batches === 1 ? 'tanda' : 'tandas'} = {totalProduceQty} {formatUnit(item.baseUnit)})"
									>
										<button
											type="button"
											onclick={() => setBatches(item.id, batches - 1)}
											disabled={batches <= 1}
											class="px-1.5 py-1 font-mono text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-35 cursor-pointer"
										>
											-
										</button>
										<span class="px-1 py-1 font-mono text-[11px] font-bold text-foreground min-w-[2.8rem] text-center">
											{totalProduceQty}
											<span class="text-[9px] font-normal text-muted-foreground">({batches}x)</span>
										</span>
										<button
											type="button"
											onclick={() => setBatches(item.id, batches + 1)}
											class="px-1.5 py-1 font-mono text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
										>
											+
										</button>
									</div>

									<Button
										type="button"
										size="sm"
										class="h-7 px-2 sm:px-2.5 gap-1 text-xs font-semibold cursor-pointer shrink-0"
										title="Abrir modal de producción con {totalProduceQty} {formatUnit(item.baseUnit)} ({batches}x receta)"
										onclick={() => handleOpenPreparedStockModal(item.id, totalProduceQty)}
									>
										<ChefHat class="size-3.5" />
										<span class="hidden sm:inline">Producir</span>
									</Button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- ========================================================= -->
		<!-- SECCIÓN 3: ENTREGAS (AL ENTREGAR SE ASUME PAGADA)         -->
		<!-- ========================================================= -->
		<div
			class="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3 overflow-hidden {mobileStep === 3
				? 'block'
				: 'hidden lg:block'}"
		>
			<div class="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
				<div class="flex items-center gap-2">
					<span class="flex size-6 items-center justify-center rounded-lg bg-emerald-500/15 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
						3
					</span>
					<PackageCheck class="size-4 text-emerald-500" />
					<h3 class="text-sm font-bold text-foreground">Entregas</h3>
				</div>

				<span
					class="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400"
					title="{readyOrders.length} listos de {ordersInHorizon.length} pedidos"
				>
					<PackageCheck class="size-3.5" />
					{readyOrders.length}/{ordersInHorizon.length}
				</span>
			</div>

			{#if ordersInHorizon.length === 0}
				<div class="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-6 px-3 text-muted-foreground">
					<CheckCircle2 class="size-5 text-emerald-500 shrink-0" />
					<span class="text-xs font-bold text-foreground">Sin entregas pendientes</span>
				</div>
			{:else}
				<div class="space-y-2 max-h-[420px] overflow-y-auto pr-0.5">
					{#each ordersInHorizon as order (order.id)}
						{@const isReady = isOrderReadyToDeliver(order)}
						{@const canProduceSingle =
							order.status === 'pending' && order.items.some((i) => i.status === 'pending_delivery')}

						<div
							class="rounded-xl border p-2.5 sm:p-3 space-y-2 transition-all overflow-hidden {isReady
								? 'border-emerald-500/40 bg-emerald-500/5'
								: 'border-border bg-background'}"
						>
							<div class="flex items-center justify-between gap-2">
								<div class="flex items-center gap-1.5 min-w-0">
									<!-- Icono de Estado -->
									{#if isReady}
										<span
											class="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
											title="Listo para retirar"
										>
											<PackageCheck class="size-3.5" />
										</span>
									{:else}
										<span
											class="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400"
											title="En preparación"
										>
											<Clock class="size-3" />
										</span>
									{/if}

									<button
										type="button"
										onclick={() => onViewOrder(order)}
										class="font-mono text-xs font-bold text-foreground hover:underline shrink-0 cursor-pointer"
									>
										{order.orderNumber}
									</button>
									<span class="font-bold text-xs text-foreground truncate" title={order.customerName}>
										{order.customerName}
									</span>
								</div>

								<div class="flex items-center gap-1.5 shrink-0">
									<span class="font-mono text-xs font-bold text-foreground">
										{formatCurrency(order.totalAmount)}
									</span>
									<button
										type="button"
										onclick={() => onViewOrder(order)}
										class="text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
										title="Ver detalle"
									>
										<Eye class="size-3.5" />
									</button>
								</div>
							</div>

							<div class="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
								<div class="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0 truncate">
									<Clock class="size-3 shrink-0" />
									<span class="font-mono shrink-0">{formatDeliveryShort(order.deliveryDate)}</span>
									<span>·</span>
									<span class="truncate" title={order.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}>
										{order.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
									</span>
								</div>

								<div class="flex items-center gap-1 shrink-0">
									{#if order.status === 'unconfirmed'}
										<Button
											type="button"
											size="sm"
											variant="secondary"
											class="h-7 px-2 sm:px-2.5 text-xs font-semibold cursor-pointer gap-1"
											onclick={() => onConfirmOrder(order)}
										>
											<Check class="size-3.5" />
											<span class="hidden sm:inline">Confirmar</span>
										</Button>
									{:else}
										{#if canProduceSingle}
											<Button
												type="button"
												size="sm"
												variant="outline"
												class="h-7 px-2 text-xs border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
												onclick={() => onProduceOrders([order], order.orderNumber)}
												title="Producir este pedido ahora"
											>
												<ChefHat class="size-3.5" />
											</Button>
										{/if}
										<Button
											type="button"
											size="sm"
											variant="default"
											class="h-7 px-2 sm:px-2.5 text-xs font-semibold gap-1 cursor-pointer shrink-0"
											onclick={() => onDeliverOrder(order)}
											title="Entregar orden (se registra entregada y cobrada)"
										>
											<Check class="size-3.5" />
											<span>Entregar</span>
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

	<!-- Botonera Flotante Mobile (Abajo a la derecha) para cambiar entre las 3 secciones (sin dock) -->
	<div
		class="fixed bottom-5 right-4 z-30 flex items-center gap-1.5 rounded-2xl border border-border bg-card/95 p-1.5 shadow-xl backdrop-blur-md lg:hidden"
	>
		<button
			type="button"
			onclick={() => (mobileStep = 1)}
			class="relative inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer {mobileStep ===
			1
				? 'bg-primary text-primary-foreground shadow-xs'
				: 'text-muted-foreground hover:text-foreground'}"
			title="1. Insumos"
		>
			<Wheat class="size-4" />
			<span>1</span>
			{#if missingRawCount > 0}
				<span class="size-2 rounded-full bg-red-500"></span>
			{/if}
		</button>

		<button
			type="button"
			onclick={() => (mobileStep = 2)}
			class="relative inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer {mobileStep ===
			2
				? 'bg-primary text-primary-foreground shadow-xs'
				: 'text-muted-foreground hover:text-foreground'}"
			title="2. Producción"
		>
			<ChefHat class="size-4" />
			<span>2</span>
			{#if producibleOrders.length > 0}
				<span class="size-2 rounded-full bg-amber-500"></span>
			{/if}
		</button>

		<button
			type="button"
			onclick={() => (mobileStep = 3)}
			class="relative inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer {mobileStep ===
			3
				? 'bg-primary text-primary-foreground shadow-xs'
				: 'text-muted-foreground hover:text-foreground'}"
			title="3. Entregas"
		>
			<PackageCheck class="size-4" />
			<span>3</span>
			{#if ordersInHorizon.length > 0}
				<span class="font-mono text-[10px] opacity-85">({ordersInHorizon.length})</span>
			{/if}
		</button>
	</div>
</div>
