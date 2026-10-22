<script lang="ts">
	import type {
		PreorderForecastSummary,
		PreorderForecastLine
	} from '#lib/features/orders/domain/order.entity';
	import type { ItemType } from '#lib/features/items/domain/item.entity';
	import ItemTypeBadge from '#lib/features/items/ui/item-type-badge.svelte';
	import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '#lib/components/ui/card';
	import { Badge } from '#lib/components/ui/badge';
	import { Button } from '#lib/components/ui/button';
	import Boxes from '@lucide/svelte/icons/boxes';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
	import Package from '@lucide/svelte/icons/package';
	import Layers from '@lucide/svelte/icons/layers';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
	import Clock from '@lucide/svelte/icons/clock';
	import Timer from '@lucide/svelte/icons/timer';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import ChefHat from '@lucide/svelte/icons/chef-hat';
	import Flame from '@lucide/svelte/icons/flame';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import List from '@lucide/svelte/icons/list';
	import Wheat from '@lucide/svelte/icons/wheat';
	import GraphHub from '@lucide/svelte/icons/graph-hub';

	interface Props {
		forecast: PreorderForecastSummary;
	}

	let { forecast }: Props = $props();

	type CategoryTab = 'all' | 'subassemblies' | 'rawmaterials' | 'products';
	let selectedCategory = $state<CategoryTab>('all');
	let filterOnlyShortages = $state(false);
	let viewStyle = $state<'cards' | 'table'>('cards');

	const subAssemblyShortages = $derived(
		forecast.subAssemblyForecast.filter((i) => i.isShortage)
	);
	const rawMaterialShortages = $derived(
		forecast.rawMaterialForecast.filter((i) => i.isShortage)
	);
	const productShortages = $derived(
		forecast.productDemands.filter((p) => p.isShortage)
	);

	const totalShortagesCount = $derived(
		subAssemblyShortages.length + rawMaterialShortages.length + productShortages.length
	);

	function formatUnit(u: string): string {
		return u === 'unit' ? 'un' : u;
	}

	function formatNum(n: number | undefined | null): string {
		const val = typeof n === 'number' && !Number.isNaN(n) ? n : 0;
		return new Intl.NumberFormat('es-AR', {
			maximumFractionDigits: 2,
			minimumFractionDigits: 0
		}).format(val);
	}

	function formatHoursAndMinutes(minutes: number | undefined | null): string {
		const val = typeof minutes === 'number' && !Number.isNaN(minutes) ? Math.max(0, minutes) : 0;
		if (val <= 0) return '0 min';
		const hours = Math.floor(val / 60);
		const mins = Math.round(val % 60);
		if (hours === 0) return `${mins} min`;
		if (mins === 0) return `${hours} hs`;
		return `${hours} hs ${mins} min`;
	}

	// Normalizamos todos los ítems para poder filtrarlos y mostrarlos homogéneamente
	interface DisplayItem {
		id: string;
		code: string;
		name: string;
		itemType: ItemType;
		category: 'subassembly' | 'rawmaterial' | 'product';
		categoryLabel: string;
		baseUnit: string;
		currentStock: number;
		minStock: number;
		requiredQuantity: number;
		projectedBalance: number;
		deficitQuantity: number;
		isShortage: boolean;
		isMakeToOrder?: boolean;
		prepTimeMinutes?: number;
		passiveTimeMinutes?: number;
		isPrepTimeScalable?: boolean;
		yieldQuantity?: number;
		batchesNeededForDeficit?: number;
		laborMinutesForDeficit?: number;
		laborMinutesTotalDemand?: number;
		laborCostForDeficit?: number;
		laborCostTotalDemand?: number;
	}

	const allDisplayItems = $derived.by<DisplayItem[]>(() => {
		const items: DisplayItem[] = [];

		// 1. Ensambles / Elaboraciones intermedias
		for (const sub of forecast.subAssemblyForecast ?? []) {
			const req = sub.requiredQuantity ?? 0;
			const stock = sub.currentStock ?? 0;
			const projBalance =
				sub.projectedBalance !== undefined && !Number.isNaN(sub.projectedBalance)
					? sub.projectedBalance
					: Number((stock - req).toFixed(3));
			const defQty =
				sub.deficitQuantity !== undefined && !Number.isNaN(sub.deficitQuantity)
					? sub.deficitQuantity
					: projBalance < 0
						? Math.abs(projBalance)
						: 0;
			const shortage = defQty > 0;

			items.push({
				id: sub.itemId,
				code: sub.code,
				name: sub.name,
				itemType: 'prepared',
				category: 'subassembly',
				categoryLabel: 'Elaboración / Ensamble',
				baseUnit: sub.baseUnit,
				currentStock: stock,
				minStock: sub.minStock ?? 0,
				requiredQuantity: req,
				projectedBalance: projBalance,
				deficitQuantity: defQty,
				isShortage: shortage,
				isMakeToOrder: sub.isMakeToOrder,
				prepTimeMinutes: sub.prepTimeMinutes ?? 0,
				passiveTimeMinutes: sub.passiveTimeMinutes ?? 0,
				isPrepTimeScalable: sub.isPrepTimeScalable,
				yieldQuantity: sub.yieldQuantity ?? 1,
				batchesNeededForDeficit:
					sub.batchesNeededForDeficit ??
					(defQty > 0 ? Math.ceil(defQty / (sub.yieldQuantity || 1)) : 0),
				laborMinutesForDeficit: sub.laborMinutesForDeficit ?? 0,
				laborMinutesTotalDemand: sub.laborMinutesTotalDemand ?? 0,
				laborCostForDeficit: sub.laborCostForDeficit ?? 0,
				laborCostTotalDemand: sub.laborCostTotalDemand ?? 0
			});
		}

		// 2. Materias Primas / Insumos
		for (const raw of forecast.rawMaterialForecast ?? []) {
			const req = raw.requiredQuantity ?? 0;
			const stock = raw.currentStock ?? 0;
			const projBalance =
				raw.projectedBalance !== undefined && !Number.isNaN(raw.projectedBalance)
					? raw.projectedBalance
					: Number((stock - req).toFixed(3));
			const defQty =
				raw.deficitQuantity !== undefined && !Number.isNaN(raw.deficitQuantity)
					? raw.deficitQuantity
					: projBalance < 0
						? Math.abs(projBalance)
						: 0;
			const shortage = defQty > 0;

			items.push({
				id: raw.itemId,
				code: raw.code,
				name: raw.name,
				itemType: 'raw_material',
				category: 'rawmaterial',
				categoryLabel: 'Insumo / Materia Prima',
				baseUnit: raw.baseUnit,
				currentStock: stock,
				minStock: raw.minStock ?? 0,
				requiredQuantity: req,
				projectedBalance: projBalance,
				deficitQuantity: defQty,
				isShortage: shortage,
				prepTimeMinutes: 0,
				laborMinutesForDeficit: 0,
				laborMinutesTotalDemand: 0
			});
		}

		// 3. Productos Finales elaborados para venta
		for (const prod of forecast.productDemands ?? []) {
			const req = prod.totalOrderedQty ?? 0;
			const stock = prod.currentProductStock ?? 0;
			const projBalance =
				prod.projectedBalance !== undefined && !Number.isNaN(prod.projectedBalance)
					? prod.projectedBalance
					: Number((stock - req).toFixed(3));
			const defQty =
				prod.deficitQuantity !== undefined && !Number.isNaN(prod.deficitQuantity)
					? prod.deficitQuantity
					: projBalance < 0
						? Math.abs(projBalance)
						: 0;
			const shortage = defQty > 0;

			items.push({
				id: prod.itemId,
				code: prod.code,
				name: prod.name,
				itemType: 'prepared',
				category: 'product',
				categoryLabel: 'Elaborado Final (Venta)',
				baseUnit: prod.baseUnit,
				currentStock: stock,
				minStock: 0,
				requiredQuantity: req,
				projectedBalance: projBalance,
				deficitQuantity: defQty,
				isShortage: shortage,
				isMakeToOrder: prod.isMakeToOrder,
				prepTimeMinutes: prod.prepTimeMinutes ?? 0,
				passiveTimeMinutes: prod.passiveTimeMinutes ?? 0,
				isPrepTimeScalable: prod.isPrepTimeScalable,
				yieldQuantity: prod.yieldQuantity ?? 1,
				batchesNeededForDeficit:
					prod.batchesNeededForDeficit ??
					(defQty > 0 ? Math.ceil(defQty / (prod.yieldQuantity || 1)) : 0),
				laborMinutesForDeficit: prod.laborMinutesForDeficit ?? 0,
				laborMinutesTotalDemand: prod.laborMinutesTotalDemand ?? 0,
				laborCostForDeficit: prod.laborCostForDeficit ?? 0,
				laborCostTotalDemand: prod.laborCostTotalDemand ?? 0
			});
		}

		return items;
	});

	const totalLaborDeficit = $derived.by(() => {
		if (
			typeof forecast.totalLaborMinutesForDeficit === 'number' &&
			!Number.isNaN(forecast.totalLaborMinutesForDeficit)
		) {
			return forecast.totalLaborMinutesForDeficit;
		}
		return allDisplayItems.reduce((acc, i) => acc + (i.laborMinutesForDeficit ?? 0), 0);
	});

	const filteredItems = $derived.by(() => {
		return allDisplayItems.filter((item) => {
			if (selectedCategory === 'subassemblies' && item.category !== 'subassembly') return false;
			if (selectedCategory === 'rawmaterials' && item.category !== 'rawmaterial') return false;
			if (selectedCategory === 'products' && item.category !== 'product') return false;
			if (filterOnlyShortages && !item.isShortage) return false;
			return true;
		});
	});

	const totalCoveredCount = $derived(allDisplayItems.filter((i) => !i.isShortage).length);
	const overallCoverageRate = $derived(
		allDisplayItems.length > 0 ? Math.round((totalCoveredCount / allDisplayItems.length) * 100) : 100
	);
</script>

<div class="space-y-6">
	<!-- 1. Tarjetas Superiores de Métricas y Tiempo de Elaboración -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<!-- KPI 1: Pedidos en Demanda -->
		<div class="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-2">
			<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
				Pedidos Confirmados
			</span>
			<div class="flex items-center gap-3 pt-0.5">
				<div class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
					<ShoppingBag class="size-6" />
				</div>
				<div class="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
					{forecast.pendingOrdersCount}
				</div>
			</div>
			<p class="text-xs text-muted-foreground">
				{forecast.pendingPreorderLinesCount} ítems comprometidos en agenda
			</p>
		</div>

		<!-- KPI 2: TIEMPO ESTIMADO DE PRODUCCIÓN (CON TAREAS EN PARALELO) -->
		<div
			class="rounded-2xl border {totalLaborDeficit > 0
				? 'border-amber-500/30 bg-amber-500/5'
				: 'border-emerald-500/30 bg-emerald-500/5'} p-4 sm:p-5 shadow-xs space-y-2.5"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
					Tiempo Real Estimado
				</span>
				{#if (forecast.totalPassiveMinutesForDeficit ?? 0) > 0}
					<span class="inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.2 font-mono text-[10px] font-bold text-amber-700 dark:text-amber-300">
						En paralelo
					</span>
				{/if}
			</div>
			<div class="flex items-center gap-3 pt-0.5">
				<div
					class="flex size-11 shrink-0 items-center justify-center rounded-2xl {totalLaborDeficit > 0
						? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
						: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}"
				>
					<CalendarClock class="size-6" />
				</div>
				<div>
					<div
						class="font-mono text-xl sm:text-2xl font-bold tracking-tight {totalLaborDeficit > 0
							? 'text-amber-600 dark:text-amber-400'
							: 'text-emerald-600 dark:text-emerald-400'}"
					>
						{formatHoursAndMinutes(forecast.criticalPathMinutesForDeficit ?? totalLaborDeficit)}
					</div>
					{#if (forecast.totalPassiveMinutesForDeficit ?? 0) > 0}
						<span class="text-[10px] text-muted-foreground block">
							(Horas-hombre totales: {formatHoursAndMinutes(totalLaborDeficit)})
						</span>
					{/if}
				</div>
			</div>
			<div class="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5 border-t border-border/40 font-mono">
				<div class="flex items-center gap-3">
					<span class="inline-flex items-center gap-1" title="Mano de obra directa (amasar, batir, armar)">
						<ChefHat class="size-3 text-secondary" />
						<span>{formatHoursAndMinutes(forecast.totalActiveMinutesForDeficit ?? totalLaborDeficit)}</span>
					</span>
					{#if (forecast.totalPassiveMinutesForDeficit ?? 0) > 0}
						<span class="inline-flex items-center gap-1" title="Tiempo pasivo / máquina / espera en paralelo">
							<Flame class="size-3 text-amber-500" />
							<span>{formatHoursAndMinutes(forecast.totalPassiveMinutesForDeficit)} pasivo</span>
						</span>
					{/if}
				</div>
				{#if (forecast.totalLaborCostForDeficit ?? 0) > 0}
					<span class="font-bold text-foreground" title="Costo estimado operativo para cubrir faltantes">
						${(forecast.totalLaborCostForDeficit ?? 0).toFixed(2)}
					</span>
				{/if}
			</div>
		</div>

		<!-- KPI 3: Cobertura de la Demanda -->
		<div
			class="rounded-2xl border {overallCoverageRate < 100
				? 'border-amber-500/30 bg-amber-500/5'
				: 'border-emerald-500/30 bg-emerald-500/5'} p-4 sm:p-5 shadow-xs space-y-2"
		>
			<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
				Cobertura de Demanda
			</span>
			<div class="flex items-center gap-3 pt-0.5">
				<div
					class="flex size-11 shrink-0 items-center justify-center rounded-2xl {overallCoverageRate < 100
						? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
						: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}"
				>
					<Boxes class="size-6" />
				</div>
				<div
					class="font-mono text-2xl sm:text-3xl font-bold tracking-tight {overallCoverageRate < 100
						? 'text-amber-600 dark:text-amber-400'
						: 'text-emerald-600 dark:text-emerald-400'}"
				>
					{overallCoverageRate}%
				</div>
			</div>
			<p class="text-xs text-muted-foreground">
				{totalCoveredCount} de {allDisplayItems.length} ítems cubiertos en almacén
			</p>
		</div>

		<!-- KPI 4: Faltantes Críticos (Déficit) -->
		<div
			class="rounded-2xl border {totalShortagesCount > 0
				? 'border-red-500/30 bg-red-500/5'
				: 'border-border bg-card'} p-4 sm:p-5 shadow-xs space-y-2"
		>
			<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
				Faltantes a Cubrir
			</span>
			<div class="flex items-center gap-3 pt-0.5">
				<div
					class="flex size-11 shrink-0 items-center justify-center rounded-2xl {totalShortagesCount > 0
						? 'bg-red-500/15 text-red-600 dark:text-red-400'
						: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}"
				>
					<AlertTriangle class="size-6" />
				</div>
				<div
					class="font-mono text-2xl sm:text-3xl font-bold tracking-tight {totalShortagesCount > 0
						? 'text-red-600 dark:text-red-400'
						: 'text-emerald-600 dark:text-emerald-400'}"
				>
					{totalShortagesCount}
				</div>
			</div>
			<p class="text-xs text-muted-foreground">
				{subAssemblyShortages.length + productShortages.length} por fabricar • {rawMaterialShortages.length} por comprar
			</p>
		</div>
	</div>

	<!-- 2. Comparador Visual de Demanda con Barras de Cobertura -->
	<Card>
		<CardHeader class="p-6 sm:p-8 sm:pb-4 space-y-4">
			<div class="flex flex-wrap items-center justify-between gap-4">
				<div class="space-y-1">
					<CardTitle class="flex items-center gap-2 text-lg">
						<Boxes class="size-5 text-primary" />
						Comparador de Demanda vs. Stock Actual
					</CardTitle>
					<CardDescription>
						Visualiza con barras si cubres la demanda de insumos y ensambles, en cuánto vas a quedar o cuánto te falta, y el tiempo de trabajo necesario.
					</CardDescription>
				</div>

				<div class="flex flex-wrap items-center gap-2">
					<!-- Switch de Vista -->
					<div class="inline-flex items-center rounded-lg border border-border bg-background p-0.5 shadow-2xs">
						<button
							type="button"
							onclick={() => (viewStyle = 'cards')}
							class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer {viewStyle ===
							'cards'
								? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
								: 'text-muted-foreground hover:text-foreground'}"
							title="Vista de Barras Visuales"
						>
							<LayoutGrid class="size-3.5" />
							<span class="hidden sm:inline">Barras Visuales</span>
						</button>
						<button
							type="button"
							onclick={() => (viewStyle = 'table')}
							class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer {viewStyle ===
							'table'
								? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
								: 'text-muted-foreground hover:text-foreground'}"
							title="Vista de Tabla Comparativa"
						>
							<List class="size-3.5" />
							<span class="hidden sm:inline">Tabla</span>
						</button>
					</div>

					<!-- Filtro de solo faltantes -->
					<Button
						type="button"
						variant={filterOnlyShortages ? 'default' : 'outline'}
						size="sm"
						class={filterOnlyShortages
							? ''
							: totalShortagesCount > 0
								? 'border-red-500/40 text-red-700 dark:text-red-400 bg-red-500/10'
								: ''}
						onclick={() => (filterOnlyShortages = !filterOnlyShortages)}
					>
						<AlertTriangle class="size-3.5 mr-1" />
						<span>Solo Faltantes ({totalShortagesCount})</span>
					</Button>
				</div>
			</div>

			<!-- Pestañas de Categoría de Demanda -->
			<div class="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/60">
				<button
					type="button"
					onclick={() => (selectedCategory = 'all')}
					class="rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer {selectedCategory ===
					'all'
						? 'bg-primary text-primary-foreground shadow-2xs'
						: 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'}"
				>
					Todos ({allDisplayItems.length})
				</button>

				<button
					type="button"
					onclick={() => (selectedCategory = 'subassemblies')}
					class="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer {selectedCategory ===
					'subassemblies'
						? 'bg-secondary text-secondary-foreground shadow-2xs'
						: 'bg-secondary/10 text-secondary border border-secondary/30 hover:bg-secondary/20'}"
				>
					<GraphHub class="size-3.5" />
					<span>Ensambles & Elaboraciones ({forecast.subAssemblyForecast.length})</span>
					{#if subAssemblyShortages.length > 0}
						<span class="rounded-full bg-secondary/20 px-1.5 py-0.2 text-[10px] text-secondary font-bold">
							{subAssemblyShortages.length}
						</span>
					{/if}
				</button>

				<button
					type="button"
					onclick={() => (selectedCategory = 'rawmaterials')}
					class="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer {selectedCategory ===
					'rawmaterials'
						? 'bg-tertiary text-yellow-950 shadow-2xs font-bold'
						: 'bg-tertiary/20 text-yellow-900 dark:text-yellow-300 border border-tertiary/40 hover:bg-tertiary/30'}"
				>
					<Wheat class="size-3.5" />
					<span>Insumos & Materias Primas ({forecast.rawMaterialForecast.length})</span>
					{#if rawMaterialShortages.length > 0}
						<span class="rounded-full bg-red-500/20 px-1.5 py-0.2 text-[10px] text-red-700 dark:text-red-400 font-bold">
							{rawMaterialShortages.length}
						</span>
					{/if}
				</button>

				<button
					type="button"
					onclick={() => (selectedCategory = 'products')}
					class="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer {selectedCategory ===
					'products'
						? 'bg-primary text-primary-foreground shadow-2xs'
						: 'bg-muted/60 text-muted-foreground border border-border hover:text-foreground hover:bg-muted'}"
				>
					<ShoppingBag class="size-3.5" />
					<span>Productos Finales ({forecast.productDemands.length})</span>
					{#if productShortages.length > 0}
						<span class="rounded-full bg-secondary/20 px-1.5 py-0.2 text-[10px] text-secondary font-bold">
							{productShortages.length}
						</span>
					{/if}
				</button>
			</div>
		</CardHeader>

		<CardContent class="p-4 pt-2 sm:p-6 sm:pt-4">
			{#if filteredItems.length === 0}
				<div class="rounded-2xl border border-dashed border-border py-12 px-4 text-center space-y-2">
					<div class="flex size-12 mx-auto items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
						<CheckCircle2 class="size-6" />
					</div>
					<h3 class="text-base font-bold text-foreground">
						{#if filterOnlyShortages}
							¡No hay ítems con faltantes en este filtro!
						{:else}
							No se encontraron ítems en esta categoría
						{/if}
					</h3>
					<p class="text-xs text-muted-foreground max-w-sm mx-auto">
						{#if filterOnlyShortages}
							Todo el stock necesario está cubierto para cumplir con los pedidos confirmados.
						{:else}
							No hay pedidos confirmados que consuman ítems bajo los filtros seleccionados.
						{/if}
					</p>
				</div>
			{:else if viewStyle === 'cards'}
				<!-- VISTA DE TARJETAS CON BARRAS VERTICALES (IDEAL PARA MOBILE & RESPONSIVE) -->
				<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
					{#each filteredItems as item (item.id)}
						{@const isFabricable = item.category === 'subassembly' || item.category === 'product'}
						{@const maxVal = Math.max(item.currentStock || 0, item.requiredQuantity || 0, 0.0001)}
						{@const stockHeightPct = Math.min(100, Math.round(((item.currentStock || 0) / maxVal) * 100))}
						{@const demandHeightPct = Math.min(100, Math.round(((item.requiredQuantity || 0) / maxVal) * 100))}

						<div
							class="rounded-xl border p-4 transition-all flex flex-col justify-between gap-3.5 {item.isShortage
								? 'border-red-500/30 bg-red-500/5 hover:border-red-500/40'
								: 'border-border bg-card hover:border-primary/40 hover:shadow-2xs'}"
						>
							<!-- Cabecera de la Tarjeta -->
							<div class="space-y-1.5">
								<div class="flex items-center justify-between gap-2 flex-wrap">
									<div class="flex items-center gap-1.5">
										<span class="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground">
											{item.code}
										</span>
										<ItemTypeBadge type={item.itemType} short={true} />
										{#if item.category === 'product'}
											<span class="rounded border border-secondary/30 bg-secondary/10 px-1.5 py-0.2 text-[10px] font-semibold text-secondary">
												Venta
											</span>
										{/if}
										{#if item.isMakeToOrder}
											<span class="rounded border border-secondary/40 bg-secondary/15 px-1.5 py-0.2 text-[10px] font-bold text-secondary">
												A Demanda
											</span>
										{/if}
									</div>

									<!-- Píldora de Estado / Faltante -->
									{#if item.isMakeToOrder}
										<span class="inline-flex items-center gap-1 rounded-md bg-secondary/15 border border-secondary/30 px-2 py-0.5 font-mono text-[11px] font-bold text-secondary dark:text-secondary-foreground">
											<Sparkles class="size-3" />
											Fabricar {formatNum(item.deficitQuantity)} {formatUnit(item.baseUnit)}
										</span>
									{:else if item.isShortage}
										<span class="inline-flex items-center gap-1 rounded-md bg-red-500/15 border border-red-500/30 px-2 py-0.5 font-mono text-[11px] font-bold text-red-600 dark:text-red-400">
											<AlertTriangle class="size-3" />
											Faltan {formatNum(item.deficitQuantity)} {formatUnit(item.baseUnit)}
										</span>
									{:else}
										<span class="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
											<CheckCircle2 class="size-3" />
											+{formatNum(item.projectedBalance)} {formatUnit(item.baseUnit)}
										</span>
									{/if}
								</div>

								<h4 class="text-sm font-bold text-foreground truncate" title={item.name}>
									{item.name}
								</h4>
							</div>

							<!-- BARRAS VERTICALES COMPARATIVAS (BAR CHART) -->
							<div class="rounded-lg border border-border/60 bg-muted/20 p-3">
								<div class="flex items-end justify-center gap-6 sm:gap-8 h-28 pt-2">
									<!-- Columna 1: Stock -->
									<div class="flex flex-col items-center gap-1.5 h-full justify-end w-16 sm:w-20">
										<span class="font-mono text-[11px] font-bold text-foreground">
											{formatNum(item.currentStock)} {formatUnit(item.baseUnit)}
										</span>
										<div class="relative w-full rounded bg-muted/60 overflow-hidden flex flex-col justify-end h-20 border border-border/40">
											<div
												class="w-full rounded-sm {item.itemType === 'prepared'
													? 'bg-secondary text-secondary-foreground'
													: 'bg-tertiary text-yellow-950'} transition-all duration-300"
												style="height: {Math.max(8, stockHeightPct)}%"
											></div>
										</div>
										<span class="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
											Stock
										</span>
									</div>

									<!-- Columna 2: Demanda -->
									<div class="flex flex-col items-center gap-1.5 h-full justify-end w-16 sm:w-20">
										<span class="font-mono text-[11px] font-bold {item.isShortage ? 'text-red-600 dark:text-red-400' : 'text-primary'}">
											{formatNum(item.requiredQuantity)} {formatUnit(item.baseUnit)}
										</span>
										<div class="relative w-full rounded bg-muted/60 overflow-hidden flex flex-col justify-end h-20 border border-border/40">
											<div
												class="w-full rounded-sm {item.isShortage
													? 'bg-red-500'
													: 'bg-emerald-500'} transition-all duration-300"
												style="height: {Math.max(8, demandHeightPct)}%"
											></div>
										</div>
										<span class="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
											Demanda
										</span>
									</div>
								</div>
							</div>

							<!-- Pie: Tiempo de trabajo o estado -->
							<div class="flex items-center justify-between text-[11px] pt-0.5 font-mono">
								{#if isFabricable && item.isShortage && (item.laborMinutesForDeficit ?? 0) > 0}
									<span class="text-muted-foreground">Fabricación:</span>
									<div class="inline-flex items-center gap-2">
										{#if (item.passiveTimeMinutes ?? 0) > 0}
											<span class="inline-flex items-center gap-0.5 text-secondary font-semibold" title="Mano de obra activa">
												<ChefHat class="size-3" />
												{formatHoursAndMinutes(item.prepTimeMinutes ?? 0)}
											</span>
											<span class="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-semibold" title="Tiempo pasivo en paralelo">
												<Flame class="size-3" />
												{formatHoursAndMinutes(item.passiveTimeMinutes ?? 0)}
											</span>
										{:else}
											<span class="inline-flex items-center gap-1 font-semibold text-secondary">
												<Clock class="size-3" />
												{formatHoursAndMinutes(item.laborMinutesForDeficit ?? 0)}
											</span>
										{/if}
										{#if (item.batchesNeededForDeficit ?? 0) > 0}
											<span class="text-muted-foreground font-normal">
												({item.batchesNeededForDeficit} {item.batchesNeededForDeficit === 1 ? 'tda' : 'tdas'})
											</span>
										{/if}
									</div>
								{:else if isFabricable}
									<span class="text-muted-foreground">Producción:</span>
									<span class="text-emerald-600 dark:text-emerald-400 font-medium">0 min (listo)</span>
								{:else}
									<span class="text-muted-foreground">Insumo:</span>
									<span class="{item.isShortage ? 'text-red-600 dark:text-red-400 font-bold' : 'text-emerald-600 dark:text-emerald-400 font-medium'}">
										{item.isShortage ? 'Requiere compra' : 'Stock suficiente'}
									</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<!-- VISTA DE TABLA CON DOS BARRAS HORIZONTALES COMPACTAS -->
				<div class="overflow-x-auto rounded-xl border border-border">
					<table class="w-full text-left text-xs border-collapse">
						<thead class="border-b border-border bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
							<tr>
								<th class="py-3 px-3">Código & Ítem</th>
								<th class="py-3 px-3">Tipo</th>
								<th class="py-3 px-3 text-right">Stock</th>
								<th class="py-3 px-3 text-right">Demanda</th>
								<th class="py-3 px-3 min-w-[170px]">Comparativa</th>
								<th class="py-3 px-3 text-right">Balance</th>
								<th class="py-3 px-3 text-right">Trabajo / Acción</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border/60">
							{#each filteredItems as item (item.id)}
								{@const isFabricable = item.category === 'subassembly' || item.category === 'product'}
								{@const maxVal = Math.max(item.currentStock || 0, item.requiredQuantity || 0, 0.0001)}
								{@const stockWidthPct = Math.min(100, Math.round(((item.currentStock || 0) / maxVal) * 100))}
								{@const demandWidthPct = Math.min(100, Math.round(((item.requiredQuantity || 0) / maxVal) * 100))}

								<tr class="transition-colors hover:bg-muted/20 {item.isShortage ? 'bg-red-500/5' : ''}">
									<!-- Código & Ítem -->
									<td class="py-3 px-3 align-middle font-medium">
										<div class="flex items-center gap-2">
											<span class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
												{item.code}
											</span>
											<span class="font-bold text-foreground text-xs">{item.name}</span>
										</div>
									</td>

									<!-- Tipo -->
									<td class="py-3 px-3 align-middle whitespace-nowrap">
										<ItemTypeBadge type={item.itemType} short={true} />
									</td>

									<!-- Stock Actual -->
									<td class="py-3 px-3 align-middle text-right font-mono font-medium text-foreground whitespace-nowrap">
										{formatNum(item.currentStock)} {formatUnit(item.baseUnit)}
									</td>

									<!-- Demanda -->
									<td class="py-3 px-3 align-middle text-right font-mono font-bold {item.isShortage ? 'text-red-600 dark:text-red-400' : 'text-primary'} whitespace-nowrap">
										{formatNum(item.requiredQuantity)} {formatUnit(item.baseUnit)}
									</td>

									<!-- Dos Barras Horizontales Comparativas (Stock vs Demanda) -->
									<td class="py-3 px-3 align-middle min-w-[170px]">
										<div class="space-y-1 font-mono text-[10px]">
											<!-- Barra Stock -->
											<div class="flex items-center gap-1.5">
												<span class="w-8 shrink-0 text-muted-foreground text-right">Stk</span>
												<div class="h-2 flex-1 rounded bg-muted/60 overflow-hidden">
													<div
														class="h-full rounded-xs {item.itemType === 'prepared' ? 'bg-secondary' : 'bg-tertiary'}"
														style="width: {Math.max(6, stockWidthPct)}%"
													></div>
												</div>
											</div>
											<!-- Barra Demanda -->
											<div class="flex items-center gap-1.5">
												<span class="w-8 shrink-0 text-muted-foreground text-right">Dem</span>
												<div class="h-2 flex-1 rounded bg-muted/60 overflow-hidden">
													<div
														class="h-full rounded-xs {item.isShortage ? 'bg-red-500' : 'bg-emerald-500'}"
														style="width: {Math.max(6, demandWidthPct)}%"
													></div>
												</div>
											</div>
										</div>
									</td>

									<!-- Balance -->
									<td class="py-3 px-3 align-middle text-right font-mono font-bold whitespace-nowrap">
										{#if item.isMakeToOrder}
											<span class="text-secondary dark:text-secondary-foreground font-semibold text-xs">
												A demanda ({formatNum(item.deficitQuantity)} {formatUnit(item.baseUnit)})
											</span>
										{:else if item.isShortage}
											<span class="text-red-600 dark:text-red-400">
												-{formatNum(item.deficitQuantity)} {formatUnit(item.baseUnit)}
											</span>
										{:else}
											<span class="text-emerald-600 dark:text-emerald-400">
												+{formatNum(item.projectedBalance)} {formatUnit(item.baseUnit)}
											</span>
										{/if}
									</td>

									<!-- Tiempo de Trabajo / Acción -->
									<td class="py-3 px-3 align-middle text-right whitespace-nowrap font-mono">
										{#if isFabricable}
											{#if item.isShortage}
												{#if (item.laborMinutesForDeficit ?? 0) > 0}
													<span class="inline-flex items-center gap-1 rounded bg-secondary/15 px-2 py-0.5 text-[11px] font-bold text-secondary dark:text-secondary-foreground">
														<Clock class="size-3" />
														{formatHoursAndMinutes(item.laborMinutesForDeficit ?? 0)}
													</span>
												{:else}
													<span class="text-[10px] text-muted-foreground italic">0 min</span>
												{/if}
											{:else}
												<span class="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">0 min</span>
											{/if}
										{:else}
											{#if item.isShortage}
												<span class="inline-flex items-center gap-1 rounded bg-red-500/15 px-2 py-0.5 text-[11px] font-bold text-red-700 dark:text-red-400">
													Falta stock
												</span>
											{:else}
												<span class="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Cubierto</span>
											{/if}
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
