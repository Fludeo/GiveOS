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
		prepTimeMinutes?: number;
		isPrepTimeScalable?: boolean;
		yieldQuantity?: number;
		batchesNeededForDeficit?: number;
		laborMinutesForDeficit?: number;
		laborMinutesTotalDemand?: number;
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
				prepTimeMinutes: sub.prepTimeMinutes ?? 0,
				isPrepTimeScalable: sub.isPrepTimeScalable,
				yieldQuantity: sub.yieldQuantity ?? 1,
				batchesNeededForDeficit:
					sub.batchesNeededForDeficit ??
					(defQty > 0 ? Math.ceil(defQty / (sub.yieldQuantity || 1)) : 0),
				laborMinutesForDeficit: sub.laborMinutesForDeficit ?? 0,
				laborMinutesTotalDemand: sub.laborMinutesTotalDemand ?? 0
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
				prepTimeMinutes: prod.prepTimeMinutes ?? 0,
				isPrepTimeScalable: prod.isPrepTimeScalable,
				yieldQuantity: prod.yieldQuantity ?? 1,
				batchesNeededForDeficit:
					prod.batchesNeededForDeficit ??
					(defQty > 0 ? Math.ceil(defQty / (prod.yieldQuantity || 1)) : 0),
				laborMinutesForDeficit: prod.laborMinutesForDeficit ?? 0,
				laborMinutesTotalDemand: prod.laborMinutesTotalDemand ?? 0
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

		<!-- KPI 2: TIEMPO DE TRABAJO NECESARIO (Mano de obra) -->
		<div
			class="rounded-2xl border {totalLaborDeficit > 0
				? 'border-amber-500/30 bg-amber-500/5'
				: 'border-emerald-500/30 bg-emerald-500/5'} p-4 sm:p-5 shadow-xs space-y-2"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
					Tiempo de Trabajo Necesario
				</span>
			</div>
			<div class="flex items-center gap-3 pt-0.5">
				<div
					class="flex size-11 shrink-0 items-center justify-center rounded-2xl {totalLaborDeficit > 0
						? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
						: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}"
				>
					<Timer class="size-6" />
				</div>
				<div
					class="font-mono text-xl sm:text-2xl font-bold tracking-tight {totalLaborDeficit > 0
						? 'text-amber-600 dark:text-amber-400'
						: 'text-emerald-600 dark:text-emerald-400'}"
				>
					{formatHoursAndMinutes(totalLaborDeficit)}
				</div>
			</div>
			<p class="text-xs text-muted-foreground truncate" title="Para fabricar todos los ensambles y productos con déficit">
				{#if totalLaborDeficit > 0}
					Mano de obra para fabricar los faltantes
				{:else}
					¡Todo elaborado y cubierto con stock!
				{/if}
			</p>
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
				<!-- VISTA DE BARRAS VISUALES (CARDS) -->
				<div class="space-y-4">
					{#each filteredItems as item (item.id)}
						{@const isFabricable = item.category === 'subassembly' || item.category === 'product'}
						{@const stockPositive = Math.max(0, item.currentStock || 0)}
						{@const demandVal = item.requiredQuantity > 0 ? item.requiredQuantity : 0.0001}
						{@const coveragePct = Math.min(100, Math.round((stockPositive / demandVal) * 100))}
						{@const deficitPct = Math.max(0, 100 - coveragePct)}

						<!-- Para caso cubierto (Stock >= Demanda) -->
						{@const demandOfStockPct = item.currentStock > 0 ? Math.min(100, Math.round(((item.requiredQuantity || 0) / item.currentStock) * 100)) : 100}
						{@const remainingOfStockPct = Math.max(0, 100 - demandOfStockPct)}

						<div
							class="rounded-2xl border p-4 sm:p-5 transition-all space-y-3.5 {item.isShortage
								? 'border-red-500/30 bg-red-500/5 hover:border-red-500/50'
								: 'border-border bg-card hover:border-primary/40 hover:shadow-2xs'}"
						>
							<!-- Encabezado del Ítem -->
							<div class="flex flex-wrap items-start justify-between gap-3">
								<div class="space-y-1">
									<div class="flex items-center gap-2 flex-wrap">
										<span class="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground">
											{item.code}
										</span>
										<ItemTypeBadge type={item.itemType} />
										{#if item.category === 'product'}
											<span class="rounded-md border border-secondary/30 bg-secondary/10 px-2 py-0.5 text-[10px] font-semibold text-secondary">
												Venta Directa
											</span>
										{/if}
										{#if item.isShortage}
											<Badge variant="outline" class="border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-400 font-bold text-[11px]">
												Déficit / Faltante
											</Badge>
										{:else}
											<Badge variant="outline" class="border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold text-[11px]">
												100% Cubierto
											</Badge>
										{/if}
									</div>
									<h4 class="text-base font-bold text-foreground">
										{item.name}
									</h4>
								</div>

								<!-- Resumen Cuantitativo: Tengo vs Demanda -->
								<div class="flex items-center gap-3 sm:gap-6 text-right">
									<div>
										<span class="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
											Stock Actual
										</span>
										<span class="font-mono text-sm sm:text-base font-bold text-foreground">
											{formatNum(item.currentStock)} {formatUnit(item.baseUnit)}
										</span>
									</div>
									<div class="text-muted-foreground">→</div>
									<div>
										<span class="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
											Demanda Requerida
										</span>
										<span class="font-mono text-sm sm:text-base font-bold text-primary">
											{formatNum(item.requiredQuantity)} {formatUnit(item.baseUnit)}
										</span>
									</div>
								</div>
							</div>

							<!-- ============================================== -->
							<!-- BARRA VISUAL DE COMPARACIÓN (DEMANDA VS STOCK) -->
							<!-- ============================================== -->
							<div class="space-y-1.5 pt-1">
								<div class="flex items-center justify-between text-xs">
									<!-- Estado de cobertura con indicador -->
									<div class="flex items-center gap-1.5 font-medium">
										{#if item.isShortage}
											<span class="size-2.5 rounded-full bg-red-500 animate-pulse"></span>
											<span class="text-red-700 dark:text-red-400 font-bold">
												Cubre solo el {coveragePct}% de la demanda requerida
											</span>
										{:else}
											<span class="size-2.5 rounded-full bg-emerald-500"></span>
											<span class="text-emerald-700 dark:text-emerald-400 font-bold">
												Cubre el 100% de la demanda ({demandOfStockPct}% del stock disponible)
											</span>
										{/if}
									</div>

									<!-- En cuánto vas a quedar o cuánto te falta -->
									<div class="font-mono text-xs font-bold {item.isShortage ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}">
										{#if item.isShortage}
											⚠️ Te faltan: {formatNum(item.deficitQuantity)} {formatUnit(item.baseUnit)}
										{:else}
											✓ Te quedarán: +{formatNum(item.projectedBalance)} {formatUnit(item.baseUnit)}
										{/if}
									</div>
								</div>

								<!-- Track de la Barra -->
								<div class="relative h-5 w-full overflow-hidden rounded-full bg-muted/70 border border-border flex shadow-inner">
									{#if item.isShortage}
										<!-- CASO DÉFICIT: La barra representa la Demanda total -->
										<!-- Segmento 1: Cubierto con Stock Actual -->
										{#if coveragePct > 0}
											<div
												class="h-full {item.itemType === 'prepared'
													? 'bg-secondary text-secondary-foreground'
													: 'bg-tertiary text-yellow-950'} font-bold transition-all duration-300 relative flex items-center justify-center text-[10px] font-mono"
												style="width: {coveragePct}%"
												title="Stock cubierto: {formatNum(item.currentStock)} {formatUnit(item.baseUnit)} ({coveragePct}%)"
											>
												{#if coveragePct >= 18}
													<span class="truncate px-1 font-bold">Stock {formatNum(item.currentStock)}</span>
												{/if}
											</div>
										{/if}

										<!-- Segmento 2: Faltante / Déficit (Lo que falta para cubrir) -->
										<div
											class="h-full bg-red-500 text-white font-bold transition-all duration-300 relative flex items-center justify-center text-[10px] font-mono flex-1"
											title="Faltante a cubrir: {formatNum(item.deficitQuantity)} {formatUnit(item.baseUnit)} ({deficitPct}%)"
										>
											<span class="truncate px-1">Faltan {formatNum(item.deficitQuantity)} {formatUnit(item.baseUnit)} ({deficitPct}%)</span>
										</div>
									{:else}
										<!-- CASO CUBIERTO: La barra representa el Stock Actual disponible -->
										<!-- Segmento 1: Demanda consumida por los pedidos -->
										<div
											class="h-full {item.itemType === 'prepared'
												? 'bg-secondary text-secondary-foreground'
												: 'bg-tertiary text-yellow-950'} font-bold transition-all duration-300 relative flex items-center justify-center text-[10px] font-mono"
											style="width: {demandOfStockPct}%"
											title="Demanda a consumir: {formatNum(item.requiredQuantity)} {formatUnit(item.baseUnit)} ({demandOfStockPct}%)"
										>
											{#if demandOfStockPct >= 18}
												<span class="truncate px-1">Demanda: {formatNum(item.requiredQuantity)} {formatUnit(item.baseUnit)}</span>
											{/if}
										</div>

										<!-- Segmento 2: Stock remanente en depósito -->
										<div
											class="h-full bg-emerald-500 text-emerald-950 font-bold transition-all duration-300 relative flex items-center justify-center text-[10px] font-mono flex-1"
											title="Te quedará en depósito: +{formatNum(item.projectedBalance)} {formatUnit(item.baseUnit)}"
										>
											{#if remainingOfStockPct >= 15}
												<span class="truncate px-1">Te quedarán +{formatNum(item.projectedBalance)} {formatUnit(item.baseUnit)}</span>
											{/if}
										</div>
									{/if}
								</div>
							</div>

							<!-- ============================================== -->
							<!-- TIEMPO DE TRABAJO & ACCIÓN REQUERIDA           -->
							<!-- ============================================== -->
							<div class="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
								<!-- Información de Stock Proyectado -->
								<div class="flex items-center gap-2 text-muted-foreground text-[11px]">
									<span>Stock post-entregas:</span>
									<span class="font-mono font-bold {item.isShortage ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}">
										{item.projectedBalance >= 0 ? '+' : ''}{formatNum(item.projectedBalance)} {formatUnit(item.baseUnit)}
									</span>
									{#if item.minStock > 0}
										<span>(Mínimo de seguridad: {formatNum(item.minStock)} {formatUnit(item.baseUnit)})</span>
									{/if}
								</div>

								<!-- TIEMPO DE TRABAJO (SI ES FABRICABLE) O ACCIÓN DE COMPRA -->
								<div>
									{#if isFabricable}
										{#if item.isShortage}
											{#if (item.laborMinutesForDeficit ?? 0) > 0}
												<div class="inline-flex items-center gap-1.5 rounded-lg border border-secondary/40 bg-secondary/15 px-2.5 py-1 text-xs font-bold text-secondary dark:text-secondary-foreground">
													<Clock class="size-3.5 shrink-0" />
													<span>Tiempo de trabajo necesario: {formatHoursAndMinutes(item.laborMinutesForDeficit ?? 0)}</span>
													{#if (item.batchesNeededForDeficit ?? 0) > 0}
														<span class="opacity-80 font-normal">
															({item.batchesNeededForDeficit} {item.batchesNeededForDeficit === 1 ? 'tanda' : 'tandas'} de {formatNum(item.yieldQuantity ?? 1)} {formatUnit(item.baseUnit)})
														</span>
													{/if}
												</div>
											{:else}
												<span class="inline-flex items-center gap-1 text-[11px] text-muted-foreground italic bg-muted/40 px-2 py-0.5 rounded">
													<Clock class="size-3" />
													<span>Sin tiempo estimado configurado en receta (0 min)</span>
												</span>
											{/if}
										{:else}
											<div class="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
												<CheckCircle2 class="size-3.5 shrink-0" />
												<span>0 min de trabajo (Stock listo para cubrir demanda)</span>
											</div>
										{/if}
									{:else}
										<!-- Materia Prima / Insumo -->
										{#if item.isShortage}
											<div class="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/15 px-2.5 py-1 text-xs font-bold text-red-700 dark:text-red-400">
												<ShoppingCart class="size-3.5 shrink-0" />
												<span>Comprar {formatNum(item.deficitQuantity)} {formatUnit(item.baseUnit)} para cubrir la demanda</span>
											</div>
										{:else}
											<div class="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
												<CheckCircle2 class="size-3.5 shrink-0" />
												<span>Materia prima suficiente en almacén</span>
											</div>
										{/if}
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<!-- VISTA DE TABLA DETALLADA -->
				<div class="overflow-x-auto rounded-xl border border-border">
					<table class="w-full text-left text-xs border-collapse">
						<thead class="border-b border-border bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
							<tr>
								<th class="py-3 px-3">Código & Ítem</th>
								<th class="py-3 px-3">Tipo</th>
								<th class="py-3 px-3 text-right">Stock Actual</th>
								<th class="py-3 px-3 text-right">Demanda Pedidos</th>
								<th class="py-3 px-3 min-w-[180px]">Cobertura (Barra)</th>
								<th class="py-3 px-3 text-right">En Cuánto Quedas / Déficit</th>
								<th class="py-3 px-3 text-right">Tiempo de Trabajo / Acción</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border/60">
							{#each filteredItems as item (item.id)}
								{@const isFabricable = item.category === 'subassembly' || item.category === 'product'}
								{@const stockPositive = Math.max(0, item.currentStock || 0)}
								{@const demandVal = item.requiredQuantity > 0 ? item.requiredQuantity : 0.0001}
								{@const coveragePct = Math.min(100, Math.round((stockPositive / demandVal) * 100))}

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
									<td class="py-3 px-3 align-middle text-right font-mono font-bold text-primary whitespace-nowrap">
										{formatNum(item.requiredQuantity)} {formatUnit(item.baseUnit)}
									</td>

									<!-- Barra de Cobertura -->
									<td class="py-3 px-3 align-middle min-w-[180px]">
										<div class="space-y-1">
											<div class="relative h-2.5 w-full overflow-hidden rounded-full bg-muted border border-border/60 flex">
												{#if item.isShortage}
													<div class="h-full {item.itemType === 'prepared' ? 'bg-secondary' : 'bg-tertiary'}" style="width: {coveragePct}%"></div>
													<div class="h-full bg-red-500 flex-1"></div>
												{:else}
													<div class="h-full bg-emerald-500 w-full"></div>
												{/if}
											</div>
											<div class="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
												<span>{coveragePct}% cubierto</span>
												<span>{item.isShortage ? 'Falta stock' : '100% OK'}</span>
											</div>
										</div>
									</td>

									<!-- En cuánto quedas / Déficit -->
									<td class="py-3 px-3 align-middle text-right font-mono font-bold whitespace-nowrap">
										{#if item.isShortage}
											<span class="text-red-600 dark:text-red-400">
												Faltan {formatNum(item.deficitQuantity)} {formatUnit(item.baseUnit)}
											</span>
										{:else}
											<span class="text-emerald-600 dark:text-emerald-400">
												Quedan +{formatNum(item.projectedBalance)} {formatUnit(item.baseUnit)}
											</span>
										{/if}
									</td>

									<!-- Tiempo de Trabajo / Acción -->
									<td class="py-3 px-3 align-middle text-right whitespace-nowrap">
										{#if isFabricable}
											{#if item.isShortage}
												{#if (item.laborMinutesForDeficit ?? 0) > 0}
													<span class="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
														<Clock class="size-3" />
														{formatHoursAndMinutes(item.laborMinutesForDeficit ?? 0)}
													</span>
												{:else}
													<span class="text-[10px] text-muted-foreground italic">0 min (sin config)</span>
												{/if}
											{:else}
												<span class="text-[11px] text-emerald-600 font-medium">0 min (listo)</span>
											{/if}
										{:else}
											{#if item.isShortage}
												<span class="inline-flex items-center gap-1 rounded bg-red-500/15 px-2 py-0.5 text-[11px] font-bold text-red-700 dark:text-red-400">
													Comprar {formatNum(item.deficitQuantity)} {formatUnit(item.baseUnit)}
												</span>
											{:else}
												<span class="text-[11px] text-emerald-600 font-medium">Abastecido</span>
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
