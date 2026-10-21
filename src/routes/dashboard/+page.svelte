<script lang="ts">
	import { enhance } from '$app/forms';
	import AppShell from '#lib/components/layout/app-shell.svelte';
	import { Button } from '#lib/components/ui/button';
	import * as Card from '#lib/components/ui/card';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import { Badge } from '#lib/components/ui/badge';
	import {
		ITEM_TYPES,
		ITEM_TYPE_LABELS,
		UNITS_OF_MEASURE,
		UNIT_LABELS,
		convertQuantity,
		generateNextItemCode,
		type ItemType,
		type UnitOfMeasure
	} from '#lib/features/items/domain/item.entity';
	import ItemTypeBadge from '#lib/features/items/ui/item-type-badge.svelte';
	import type { RecipeTreeNode } from '#lib/features/recipes/domain/recipe.entity';

	import AlertTriangle from '@lucide/svelte/icons/triangle-alert';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import BarChart3 from '@lucide/svelte/icons/bar-chart-3';
	import Boxes from '@lucide/svelte/icons/boxes';
	import CakeSlice from '@lucide/svelte/icons/cake-slice';
	import ChefHat from '@lucide/svelte/icons/chef-hat';
	import Check from '@lucide/svelte/icons/check';
	import Layers from '@lucide/svelte/icons/layers';
	import Package from '@lucide/svelte/icons/package';
	import PackagePlus from '@lucide/svelte/icons/package-plus';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import X from '@lucide/svelte/icons/x';
	import Zap from '@lucide/svelte/icons/zap';
	import Clock from '@lucide/svelte/icons/clock';
	import Info from '@lucide/svelte/icons/info';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';

	let { data } = $props();

	// Filtro y búsqueda de productos en catálogo
	let productSearchQuery = $state('');
	let productFilterMode = $state<'all' | 'with_orders' | 'with_stock' | 'combos'>('all');

	// Producto comercial seleccionado para el gráfico de barras y detalle
	let selectedSalesProductId = $state<string | null>(null);

	// Cantidad de pedidos a simular / analizar en el gráfico de barras
	let analysisOrderUnits = $state<number>(1);

	// Modal de Alta de Nuevo Ítem
	let showNewItemModal = $state(false);
	let newItemType = $state<ItemType>('raw_material');
	let newItemBaseUnit = $state<UnitOfMeasure>('g');
	let newItemMinStock = $state(0);

	const nextAutoCode = $derived(
		generateNextItemCode(
			newItemType,
			data.items.map((i) => i.code)
		)
	);

	// Modal de Ajuste Rápido de Stock
	let restockModalItemId = $state<string | null>(null);
	let restockCurrentStock = $state<number>(0);
	let restockMinStock = $state<number>(0);

	const restockModalItem = $derived(
		restockModalItemId ? (data.items.find((i) => i.id === restockModalItemId) ?? null) : null
	);

	function openQuickRestock(item: (typeof data.items)[number]) {
		restockModalItemId = item.id;
		restockCurrentStock = item.currentStock;
		restockMinStock = item.minStock;
	}

	// Mapa de demanda de pedidos por producto de venta
	const productOrderStats = $derived.by(() => {
		const map = new Map<
			string,
			{
				pendingUnits: number;
				pendingOrdersCount: number;
				totalSoldUnits: number;
			}
		>();

		for (const sp of data.salesProducts) {
			map.set(sp.id, { pendingUnits: 0, pendingOrdersCount: 0, totalSoldUnits: 0 });
		}

		for (const order of data.orders) {
			if (order.status === 'cancelled' || order.status === 'unconfirmed') continue;
			for (const line of order.items) {
				const current = map.get(line.salesProductId);
				if (!current) continue;
				current.totalSoldUnits += line.quantity;
				if (order.status === 'pending' && line.status === 'pending_delivery') {
					current.pendingUnits += line.quantity;
					current.pendingOrdersCount += 1;
				}
			}
		}

		return map;
	});

	// Catálogo filtrado de productos comerciales
	const filteredSalesProducts = $derived.by(() => {
		const q = productSearchQuery.trim().toLowerCase();
		return data.salesProducts.filter((sp) => {
			const stats = productOrderStats.get(sp.id);

			if (productFilterMode === 'with_orders' && (!stats || stats.pendingUnits <= 0)) {
				return false;
			}
			if (productFilterMode === 'combos' && !sp.isCombo) {
				return false;
			}
			if (productFilterMode === 'with_stock') {
				const hasStock = sp.components.some(
					(c) => c.item && c.item.currentStock > 0
				);
				if (!hasStock) return false;
			}

			if (!q) return true;

			const matchName = sp.name.toLowerCase().includes(q);
			const matchCode = sp.code.toLowerCase().includes(q);
			const matchComponents = sp.components.some(
				(c) => c.item && (c.item.name.toLowerCase().includes(q) || c.item.code.toLowerCase().includes(q))
			);
			return matchName || matchCode || matchComponents;
		});
	});

	// Producto comercial activo
	const selectedSalesProduct = $derived(
		data.salesProducts.find((p) => p.id === selectedSalesProductId) ??
			filteredSalesProducts[0] ??
			data.salesProducts[0] ??
			null
	);

	// Cuando cambia el producto seleccionado, si tiene pedidos pendientes, preconfigurar la simulación con esa cantidad
	$effect(() => {
		if (selectedSalesProduct) {
			const stats = productOrderStats.get(selectedSalesProduct.id);
			if (stats && stats.pendingUnits > 0) {
				analysisOrderUnits = stats.pendingUnits;
			} else {
				analysisOrderUnits = 1;
			}
		}
	});

	// Cálculo de insumos requeridos vs stock para el producto seleccionado
	interface InsumoComparison {
		itemId: string;
		code: string;
		name: string;
		type: ItemType;
		baseUnit: UnitOfMeasure;
		currentStock: number;
		minStock: number;
		requiredForOrders: number;
		difference: number;
		coveragePct: number;
		isDeficit: boolean;
	}

	const selectedProductAnalysis = $derived.by(() => {
		if (!selectedSalesProduct) return null;

		const stats = productOrderStats.get(selectedSalesProduct.id) ?? {
			pendingUnits: 0,
			pendingOrdersCount: 0,
			totalSoldUnits: 0
		};

		const unitsToProduce = Math.max(1, analysisOrderUnits);
		const insumosMap = new Map<string, InsumoComparison>();

		// Analizar cada ítem asociado al producto de venta (soporta simples y combos)
		for (const comp of selectedSalesProduct.components) {
			const finishedItem = comp.item;
			if (!finishedItem) continue;

			const totalComponentUnitsNeeded = unitsToProduce * comp.quantity;
			const summary = data.recipeSummaries[comp.itemId];
			const nodes: RecipeTreeNode[] = summary?.nodes ?? [];
			const yieldQty = finishedItem.yieldQuantity > 0 ? finishedItem.yieldQuantity : 1;
			const batchesNeeded = totalComponentUnitsNeeded / yieldQty;

			function addNodeInsumo(node: RecipeTreeNode, multiplier: number) {
				const ing = node.component;
				const reqInBase = convertQuantity(node.quantity * multiplier, node.unit, ing.baseUnit);

				const existing = insumosMap.get(ing.id);
				if (existing) {
					existing.requiredForOrders += reqInBase;
					existing.difference = existing.currentStock - existing.requiredForOrders;
					existing.coveragePct =
						existing.requiredForOrders > 0
							? (existing.currentStock / existing.requiredForOrders) * 100
							: 100;
					existing.isDeficit = existing.difference < 0;
				} else {
					const diff = ing.currentStock - reqInBase;
					insumosMap.set(ing.id, {
						itemId: ing.id,
						code: ing.code,
						name: ing.name,
						type: ing.type,
						baseUnit: ing.baseUnit,
						currentStock: ing.currentStock,
						minStock: ing.minStock,
						requiredForOrders: reqInBase,
						difference: diff,
						coveragePct: reqInBase > 0 ? (ing.currentStock / reqInBase) * 100 : 100,
						isDeficit: diff < 0
					});
				}

				if (node.children && node.children.length > 0) {
					for (const child of node.children) {
						addNodeInsumo(child, multiplier * (node.quantity / (ing.yieldQuantity || 1)));
					}
				}
			}

			for (const node of nodes) {
				addNodeInsumo(node, batchesNeeded);
			}
		}

		const insumosList = Array.from(insumosMap.values());
		// Ordenar primero los que tienen déficit
		insumosList.sort((a, b) => {
			if (a.isDeficit !== b.isDeficit) return a.isDeficit ? -1 : 1;
			return a.coveragePct - b.coveragePct;
		});

		// Máximo para escalar las barras de comparación
		const maxBarValue = Math.max(
			...insumosList.map((i) => Math.max(i.currentStock, i.requiredForOrders)),
			1
		);

		const deficitCount = insumosList.filter((i) => i.isDeficit).length;

		return {
			stats,
			unitsToProduce,
			insumos: insumosList,
			maxBarValue,
			deficitCount,
			hasRecipe: insumosList.length > 0
		};
	});

	// KPIs Globales
	const totalPendingOrders = $derived(
		data.orders.filter((o) => o.status === 'pending').length
	);
	const totalUnconfirmedOrders = $derived(
		data.orders.filter((o) => o.status === 'unconfirmed').length
	);
	const totalPendingUnits = $derived(
		data.orders
			.filter((o) => o.status === 'pending')
			.flatMap((o) => o.items)
			.filter((i) => i.status === 'pending_delivery')
			.reduce((sum, i) => sum + i.quantity, 0)
	);
	const totalFinishedStock = $derived(
		data.items
			.filter((i) => i.type === 'prepared')
			.reduce((sum, i) => sum + i.currentStock, 0)
	);
	const lowStockCount = $derived(
		data.items.filter((i) => i.minStock > 0 && i.currentStock <= i.minStock).length
	);

	function formatCurrency(val: number) {
		return `$ ${val.toLocaleString('es-AR', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		})}`;
	}

	function formatQty(val: number) {
		return Number(val.toFixed(2)).toLocaleString('es-AR');
	}
</script>

<svelte:head>
	<title>Dashboard — {data.activeBusiness.name}</title>
</svelte:head>

{#snippet headerActions()}
	<Button variant="outline" href="/inventory" class="gap-1.5 cursor-pointer">
		<Boxes class="size-4" />
		<span>Inventario y Recetas</span>
	</Button>
	<Button variant="outline" onclick={() => (showNewItemModal = true)} class="gap-1.5 cursor-pointer">
		<Plus class="size-4" />
		<span>Nuevo Ítem</span>
	</Button>
	<Button href="/orders/new" class="gap-1.5 cursor-pointer shadow-sm">
		<ShoppingCart class="size-4" />
		<span>Nueva Orden</span>
	</Button>
{/snippet}

	{#snippet kpiSummary()}
		<!-- KPI Summary Row -->
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<!-- KPI 1: Productos en Catálogo -->
			<Card.Root class="border-border bg-card shadow-xs">
				<Card.Header class="p-4 sm:p-5 pb-2 space-y-1.5">
					<Card.Description class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Productos Comerciales
					</Card.Description>
					<div class="flex items-center gap-3 pt-0.5">
						<div class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
							<CakeSlice class="size-6" />
						</div>
						<Card.Title class="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
							{data.salesProducts.length}
						</Card.Title>
					</div>
				</Card.Header>
				<Card.Content class="p-4 sm:p-5 pt-0">
					<p class="text-xs text-muted-foreground">
						{data.salesProducts.filter((p) => p.isCombo).length} combos • {data.salesProducts.filter((p) => !p.isCombo).length} simples
					</p>
				</Card.Content>
			</Card.Root>

			<!-- KPI 2: Pedidos Pendientes -->
			<Card.Root class={totalPendingOrders > 0 ? 'border-amber-500/30 bg-amber-500/5 shadow-xs' : 'border-border bg-card shadow-xs'}>
				<Card.Header class="p-4 sm:p-5 pb-2 space-y-1.5">
					<Card.Description class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Pedidos Pendientes
					</Card.Description>
					<div class="flex items-center gap-3 pt-0.5">
						<div class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
							<Clock class="size-6" />
						</div>
						<Card.Title class="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-amber-600">
							{totalPendingOrders}
						</Card.Title>
					</div>
				</Card.Header>
				<Card.Content class="p-4 sm:p-5 pt-0">
					<p class="text-xs text-muted-foreground font-mono">
						{totalPendingUnits} unidades por entregar
						{#if totalUnconfirmedOrders > 0}
							<span class="block text-[11px] text-purple-600 font-sans font-semibold mt-0.5">
								({totalUnconfirmedOrders} por confirmar)
							</span>
						{/if}
					</p>
				</Card.Content>
			</Card.Root>

			<!-- KPI 3: Stock Productos Terminados -->
			<Card.Root class="border-border bg-card shadow-xs">
				<Card.Header class="p-4 sm:p-5 pb-2 space-y-1.5">
					<Card.Description class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Stock Elaborado (Mostrador)
					</Card.Description>
					<div class="flex items-center gap-3 pt-0.5">
						<div class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
							<Package class="size-6" />
						</div>
						<Card.Title class="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-emerald-600">
							{formatQty(totalFinishedStock)} u
						</Card.Title>
					</div>
				</Card.Header>
				<Card.Content class="p-4 sm:p-5 pt-0">
					<p class="text-xs text-muted-foreground">
						Listo para despacho inmediato
					</p>
				</Card.Content>
			</Card.Root>

			<!-- KPI 4: Insumos en Alerta -->
			<Card.Root class={lowStockCount > 0 ? 'border-red-500/30 bg-red-500/5 shadow-xs' : 'border-border bg-card shadow-xs'}>
				<Card.Header class="p-4 sm:p-5 pb-2 space-y-1.5">
					<Card.Description class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Insumos Bajo Mínimo
					</Card.Description>
					<div class="flex items-center gap-3 pt-0.5">
						<div class="flex size-11 shrink-0 items-center justify-center rounded-2xl {lowStockCount > 0 ? 'bg-red-500/15 text-red-600' : 'bg-muted text-muted-foreground'}">
							<AlertTriangle class="size-6" />
						</div>
						<Card.Title class="text-2xl sm:text-3xl font-bold font-mono tracking-tight {lowStockCount > 0 ? 'text-red-600' : 'text-foreground'}">
							{lowStockCount}
						</Card.Title>
					</div>
				</Card.Header>
				<Card.Content class="p-4 sm:p-5 pt-0">
					<p class="text-xs text-muted-foreground">
						{lowStockCount > 0 ? 'Requieren reposición de compra' : 'Inventario equilibrado'}
					</p>
				</Card.Content>
			</Card.Root>
		</div>
	{/snippet}

	{#snippet catalogColumn()}
		<!-- COLUMNA IZQUIERDA: Catálogo de Productos e Ítems Asociados (5 Cols) -->
		<div class="lg:col-span-5 space-y-4">
				<Card.Root class="border-border bg-card shadow-xs">
					<Card.Header class="p-4 border-b border-border space-y-3">
						<div class="flex items-center justify-between">
							<div>
								<Card.Title class="text-base font-bold text-foreground">
									Productos en Catálogo
								</Card.Title>
								<Card.Description class="text-xs text-muted-foreground">
									Toca un producto para inspeccionar sus ítems e insumos
								</Card.Description>
							</div>
							<Badge variant="outline" class="font-mono text-xs">
								{filteredSalesProducts.length}
							</Badge>
						</div>

						<!-- Buscador -->
						<div class="relative">
							<Search class="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
							<Input
								type="search"
								placeholder="Buscar por producto o ítem asociado..."
								bind:value={productSearchQuery}
								class="pl-8 text-xs h-9"
							/>
						</div>

						<!-- Filtros rápidos -->
						<div class="flex flex-wrap items-center gap-1.5 pt-1">
							<button
								type="button"
								onclick={() => (productFilterMode = 'all')}
								class="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer {productFilterMode === 'all'
									? 'bg-primary text-primary-foreground font-semibold shadow-xs'
									: 'bg-muted/60 text-muted-foreground hover:bg-muted'}"
							>
								Todos
							</button>
							<button
								type="button"
								onclick={() => (productFilterMode = 'with_orders')}
								class="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer {productFilterMode === 'with_orders'
									? 'bg-amber-500 text-white font-semibold shadow-xs'
									: 'bg-muted/60 text-muted-foreground hover:bg-muted'}"
							>
								Con Pedidos
							</button>
							<button
								type="button"
								onclick={() => (productFilterMode = 'with_stock')}
								class="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer {productFilterMode === 'with_stock'
									? 'bg-emerald-600 text-white font-semibold shadow-xs'
									: 'bg-muted/60 text-muted-foreground hover:bg-muted'}"
							>
								Con Stock
							</button>
							<button
								type="button"
								onclick={() => (productFilterMode = 'combos')}
								class="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer {productFilterMode === 'combos'
									? 'bg-primary text-primary-foreground font-semibold shadow-xs'
									: 'bg-muted/60 text-muted-foreground hover:bg-muted'}"
							>
								Combos
							</button>
						</div>
					</Card.Header>

					<Card.Content class="p-3 max-h-[calc(100vh-320px)] overflow-y-auto space-y-2.5">
						{#if filteredSalesProducts.length === 0}
							<div class="p-8 text-center text-xs text-muted-foreground">
								No se encontraron productos coincidentes con los filtros.
							</div>
						{:else}
							{#each filteredSalesProducts as product (product.id)}
								{@const isSelected = selectedSalesProduct?.id === product.id}
								{@const stats = productOrderStats.get(product.id)}
								<button
									type="button"
									onclick={() => (selectedSalesProductId = product.id)}
									class="w-full text-left rounded-xl border p-3.5 transition-all cursor-pointer {isSelected
										? 'border-primary bg-primary/5 ring-2 ring-primary/40 shadow-xs'
										: 'border-border bg-card hover:border-primary/40 hover:bg-muted/20'}"
								>
									<!-- Fila Superior: Código, Tipo y Precio -->
									<div class="flex items-center justify-between gap-2">
										<div class="flex items-center gap-1.5">
											<span class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
												{product.code}
											</span>
											{#if product.isCombo}
												<Badge variant="outline" class="border-purple-500/30 bg-purple-500/10 text-purple-700 text-[10px] px-1.5 py-0">
													Combo
												</Badge>
											{/if}
										</div>

										<span class="font-mono text-xs font-bold text-foreground">
											{formatCurrency(product.salePrice)}
										</span>
									</div>

									<!-- Nombre del Producto -->
									<div class="mt-1">
										<h4 class="text-sm font-semibold text-foreground leading-tight">
											{product.name}
										</h4>
										{#if product.description}
											<p class="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
												{product.description}
											</p>
										{/if}
									</div>

									<!-- Ítems Asociados y su Stock Disponible -->
									<div class="mt-2.5 pt-2 border-t border-border/50 space-y-1.5">
										<span class="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
											Ítems asociados ({product.components.length}):
										</span>
										<div class="space-y-1">
											{#each product.components as comp}
												{@const item = comp.item}
												<div class="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1 text-xs">
													<div class="flex items-center gap-1.5 truncate">
														<span class="font-mono text-[11px] font-bold text-primary shrink-0">
															{comp.quantity}x
														</span>
														<span class="font-medium text-foreground truncate" title={item?.name ?? comp.itemId}>
															{item?.name ?? 'Ítem no encontrado'}
														</span>
													</div>

													<!-- Stock disponible del ítem asociado -->
													<div class="shrink-0 pl-2">
														{#if item}
															<span
																class="inline-flex items-center gap-1 rounded font-mono text-[11px] px-1.5 py-0.2 {item.currentStock > item.minStock
																	? 'bg-emerald-500/10 text-emerald-700 font-semibold'
																	: item.currentStock > 0
																		? 'bg-amber-500/15 text-amber-700 font-semibold'
																		: 'bg-red-500/15 text-red-700 font-bold'}"
															>
																{formatQty(item.currentStock)} {item.baseUnit}
															</span>
														{:else}
															<span class="text-muted-foreground text-[10px]">Sin datos</span>
														{/if}
													</div>
												</div>
											{/each}
										</div>
									</div>

									<!-- Footer: Alerta de Pedidos Pendientes -->
									{#if stats && stats.pendingUnits > 0}
										<div class="mt-2.5 flex items-center justify-between rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[11px]">
											<span class="flex items-center gap-1 text-amber-700 font-medium">
												<Clock class="size-3 shrink-0" />
												{stats.pendingOrdersCount} {stats.pendingOrdersCount === 1 ? 'pedido pendiente' : 'pedidos pendientes'}
											</span>
											<span class="font-mono font-bold text-amber-800">
												{stats.pendingUnits} u demandadas
											</span>
										</div>
									{/if}
								</button>
							{/each}
						{/if}
					</Card.Content>
				</Card.Root>
			</div>
		{/snippet}

		{#snippet detailAndChartColumn()}
			<!-- COLUMNA DERECHA: Detalle del Producto, Stock Asociado y Gráfico de Barras shadcn (7 Cols) -->
			<div class="lg:col-span-7 space-y-6">
				{#if selectedSalesProduct && selectedProductAnalysis}
					<!-- Card 1: Mención Destacada del Stock Disponible del Producto Asociado -->
					<Card.Root class="border-border bg-card shadow-xs overflow-hidden">
						<!-- Encabezado del Producto -->
						<Card.Header class="p-5 border-b border-border bg-muted/10 space-y-2">
							<div class="flex flex-wrap items-start justify-between gap-3">
								<div class="space-y-1">
									<div class="flex items-center gap-2">
										<span class="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
											{selectedSalesProduct.code}
										</span>
										{#if selectedSalesProduct.isCombo}
											<Badge variant="outline" class="border-purple-500/30 bg-purple-500/10 text-purple-700 text-xs">
												Combo Comercial
											</Badge>
										{/if}
									</div>
									<h2 class="text-xl font-bold text-foreground">
										{selectedSalesProduct.name}
									</h2>
									{#if selectedSalesProduct.description}
										<p class="text-xs text-muted-foreground">
											{selectedSalesProduct.description}
										</p>
									{/if}
								</div>

								<div class="text-right">
									<span class="text-xs text-muted-foreground block">Precio Venta</span>
									<span class="font-mono text-xl font-bold text-emerald-600">
										{formatCurrency(selectedSalesProduct.salePrice)}
									</span>
								</div>
							</div>
						</Card.Header>

						<Card.Content class="p-5 space-y-5">
							<!-- Sección: Mención Explícita del Stock Disponible de los Ítems Asociados -->
							<div class="space-y-3">
								<div class="flex items-center justify-between">
									<h3 class="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
										<Package class="size-4 text-primary" />
										<span>Stock Disponible del Producto Asociado</span>
									</h3>
									<span class="text-[11px] text-muted-foreground">
										Listo para entrega en mostrador
									</span>
								</div>

								<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
									{#each selectedSalesProduct.components as comp}
										{@const item = comp.item}
										<div class="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2">
											<div class="flex items-center justify-between">
												<span class="font-mono text-[10px] text-muted-foreground font-semibold">
													{item?.code ?? 'N/D'}
												</span>
												{#if item && item.currentStock > item.minStock}
													<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded-full">
														<Check class="size-3" />
														En Stock
													</span>
												{:else if item && item.currentStock > 0}
													<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-500/15 px-2 py-0.5 rounded-full">
														<Clock class="size-3" />
														Stock Bajo
													</span>
												{:else}
													<span class="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-500/15 px-2 py-0.5 rounded-full">
														<AlertTriangle class="size-3" />
														Agotado
													</span>
												{/if}
											</div>

											<div>
												<h4 class="text-sm font-semibold text-foreground truncate" title={item?.name}>
													{item?.name ?? 'Ítem no configurado'}
												</h4>
												<p class="text-[11px] text-muted-foreground">
													Compone {comp.quantity}x por cada unidad del producto
												</p>
											</div>

											<!-- Métrica de Stock Disponible con Destacado -->
											<div class="pt-2 border-t border-border/50 flex items-baseline justify-between">
												<span class="text-xs text-muted-foreground">Stock actual:</span>
												<div class="text-right">
													<span class="font-mono text-lg font-bold text-foreground">
														{item ? formatQty(item.currentStock) : 0}
													</span>
													<span class="text-xs font-medium text-muted-foreground ml-0.5">
														{item?.baseUnit ?? 'u'}
													</span>
												</div>
											</div>

											<!-- Botón de Restock Rápido -->
											{#if item}
												<button
													type="button"
													onclick={() => openQuickRestock(item)}
													class="w-full mt-1 inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-background py-1 text-[11px] font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
												>
													<RefreshCw class="size-3" />
													<span>Ajustar Stock Rápido</span>
												</button>
											{/if}
										</div>
									{/each}
								</div>

								<!-- Balance Operativo vs Pedidos Pendientes -->
								<div class="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-1.5">
									<div class="flex items-center justify-between text-xs">
										<span class="font-semibold text-foreground">Demanda en Pedidos Pendientes:</span>
										<span class="font-mono font-bold text-amber-700">
											{selectedProductAnalysis.stats.pendingUnits} unidades ({selectedProductAnalysis.stats.pendingOrdersCount} órdenes)
										</span>
									</div>
									<div class="text-xs text-muted-foreground leading-relaxed">
										{#if selectedSalesProduct.components.length > 0 && selectedSalesProduct.components[0].item}
											{@const mainStock = selectedSalesProduct.components[0].item.currentStock}
											{@const pendingDemand = selectedProductAnalysis.stats.pendingUnits}
											{#if pendingDemand === 0}
												<span>No hay órdenes pendientes de entrega para este producto. Puedes vender directamente del stock existente.</span>
											{:else if mainStock >= pendingDemand}
												<span class="text-emerald-700 font-semibold">
													✓ Tienes {formatQty(mainStock)} u listas en depósito. Cubres los {pendingDemand} pedidos pendientes sin necesidad de elaborar más.
												</span>
											{:else}
												<span class="text-amber-700 font-semibold">
													⚠ Tienes {formatQty(mainStock)} u en stock. Faltan elaborar {formatQty(pendingDemand - mainStock)} u para cumplir con todas las órdenes comprometidas.
												</span>
											{/if}
										{/if}
									</div>
								</div>
							</div>
						</Card.Content>
					</Card.Root>

					<!-- Card 2: Gráfico de Barras shadcn/ui: Comparativa Insumos vs Cantidad de Pedidos -->
					<Card.Root class="border-border bg-card shadow-xs">
						<Card.Header class="p-5 border-b border-border space-y-3">
							<div class="flex flex-wrap items-center justify-between gap-3">
								<div>
									<Card.Title class="text-base font-bold text-foreground flex items-center gap-2">
										<BarChart3 class="size-5 text-primary" />
										<span>Comparativa de Insumos vs Pedidos</span>
									</Card.Title>
									<Card.Description class="text-xs text-muted-foreground">
										Gráfico de barras que compara el stock disponible de materias primas/sub-ensambles con la demanda requerida
									</Card.Description>
								</div>

								<!-- Selector interactivo de cantidad de pedidos a analizar -->
								<div class="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border">
									{#if selectedProductAnalysis.stats.pendingUnits > 0}
										<button
											type="button"
											onclick={() => (analysisOrderUnits = selectedProductAnalysis.stats.pendingUnits)}
											class="rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer {analysisOrderUnits === selectedProductAnalysis.stats.pendingUnits
												? 'bg-amber-500 text-white font-bold shadow-xs'
												: 'text-muted-foreground hover:bg-muted'}"
										>
											Pedidos Pendientes ({selectedProductAnalysis.stats.pendingUnits} u)
										</button>
									{/if}
									<button
										type="button"
										onclick={() => (analysisOrderUnits = 1)}
										class="rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer {analysisOrderUnits === 1
											? 'bg-primary text-primary-foreground font-bold shadow-xs'
											: 'text-muted-foreground hover:bg-muted'}"
									>
										1 u
									</button>
									<button
										type="button"
										onclick={() => (analysisOrderUnits = 5)}
										class="rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer {analysisOrderUnits === 5
											? 'bg-primary text-primary-foreground font-bold shadow-xs'
											: 'text-muted-foreground hover:bg-muted'}"
									>
										5 u
									</button>
									<button
										type="button"
										onclick={() => (analysisOrderUnits = 10)}
										class="rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer {analysisOrderUnits === 10
											? 'bg-primary text-primary-foreground font-bold shadow-xs'
											: 'text-muted-foreground hover:bg-muted'}"
									>
										10 u
									</button>
									<div class="flex items-center gap-1 pl-1">
										<Input
											type="number"
											min="1"
											step="1"
											bind:value={analysisOrderUnits}
											class="w-16 h-7 text-xs font-mono font-bold text-center p-1"
										/>
										<span class="text-[11px] text-muted-foreground pr-1">u</span>
									</div>
								</div>
							</div>

							<!-- Leyenda del Gráfico de Barras -->
							<div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50 text-xs">
								<div class="flex items-center gap-4">
									<div class="flex items-center gap-1.5">
										<div class="size-3 rounded-sm bg-primary/80 ring-1 ring-primary"></div>
										<span class="text-muted-foreground">Insumo Requerido para {analysisOrderUnits} {analysisOrderUnits === 1 ? 'pedido' : 'pedidos'}</span>
									</div>
									<div class="flex items-center gap-1.5">
										<div class="size-3 rounded-sm bg-emerald-500"></div>
										<span class="text-muted-foreground">Stock Disponible (Suficiente)</span>
									</div>
									<div class="flex items-center gap-1.5">
										<div class="size-3 rounded-sm bg-red-500"></div>
										<span class="text-muted-foreground">Stock Disponible (Déficit / Falta)</span>
									</div>
								</div>

								{#if selectedProductAnalysis.deficitCount > 0}
									<Badge variant="destructive" class="gap-1 text-[11px] font-semibold">
										<AlertTriangle class="size-3" />
										<span>{selectedProductAnalysis.deficitCount} {selectedProductAnalysis.deficitCount === 1 ? 'insumo en falta' : 'insumos en falta'}</span>
									</Badge>
								{:else}
									<Badge variant="outline" class="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 gap-1 text-[11px] font-semibold">
										<Check class="size-3" />
										<span>Insumos 100% Cubiertos</span>
									</Badge>
								{/if}
							</div>
						</Card.Header>

						<Card.Content class="p-5">
							{#if !selectedProductAnalysis.hasRecipe}
								<div class="rounded-xl border border-dashed border-border p-8 text-center space-y-2">
									<ChefHat class="mx-auto size-8 text-muted-foreground/60" />
									<h4 class="text-sm font-semibold text-foreground">
										Este producto no tiene receta de insumos configurada
									</h4>
									<p class="text-xs text-muted-foreground max-w-md mx-auto">
										Configura la receta de sus ítems asociados en la sección de Inventario para visualizar la comparativa de insumos.
									</p>
									<Button variant="outline" size="sm" href="/inventory" class="mt-2 gap-1.5 cursor-pointer">
										<Boxes class="size-3.5" />
										<span>Configurar Receta en Inventario</span>
									</Button>
								</div>
							{:else}
								<!-- GRÁFICO DE BARRAS SHADCN-UI -->
								<div class="space-y-4">
									{#each selectedProductAnalysis.insumos as insumo (insumo.itemId)}
										{@const reqBarWidth = Math.min(100, (insumo.requiredForOrders / selectedProductAnalysis.maxBarValue) * 100)}
										{@const stockBarWidth = Math.min(100, (insumo.currentStock / selectedProductAnalysis.maxBarValue) * 100)}
										
										<div class="rounded-xl border border-border/80 bg-muted/10 p-3.5 space-y-2.5 transition-all hover:border-primary/40 hover:bg-muted/20">
											<!-- Encabezado de la barra: Nombre del insumo, código y estado -->
											<div class="flex items-center justify-between gap-2">
												<div class="flex items-center gap-2 truncate">
													<span class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
														{insumo.code}
													</span>
													<span class="text-sm font-bold text-foreground truncate">
														{insumo.name}
													</span>
													<ItemTypeBadge type={insumo.type} />
												</div>

												<!-- Badge de Estado de Cobertura -->
												<div class="shrink-0">
													{#if insumo.isDeficit}
														<Badge variant="destructive" class="text-[11px] font-mono gap-1">
															<AlertTriangle class="size-3" />
															<span>Faltan {formatQty(Math.abs(insumo.difference))} {insumo.baseUnit}</span>
														</Badge>
													{:else}
														<Badge variant="outline" class="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 text-[11px] font-mono gap-1">
															<Check class="size-3" />
															<span>Cubierto (+{formatQty(insumo.difference)} {insumo.baseUnit})</span>
														</Badge>
													{/if}
												</div>
											</div>

											<!-- Grupo de Barras Comparativas -->
											<div class="space-y-1.5 pt-1">
												<!-- Barra 1: Demanda Requerida para Pedidos -->
												<div class="space-y-0.5">
													<div class="flex justify-between text-[11px] font-mono">
														<span class="text-muted-foreground flex items-center gap-1 font-sans font-medium">
															<span class="size-2 rounded-full bg-primary inline-block"></span>
															Requerido para pedidos:
														</span>
														<span class="font-bold text-foreground">
															{formatQty(insumo.requiredForOrders)} {insumo.baseUnit}
														</span>
													</div>
													<div class="h-3 w-full bg-muted/60 rounded-md overflow-hidden">
														<div
															class="h-full bg-primary/80 transition-all duration-300 rounded-md"
															style="width: {Math.max(2, reqBarWidth)}%;"
														></div>
													</div>
												</div>

												<!-- Barra 2: Stock Actual en Depósito -->
												<div class="space-y-0.5">
													<div class="flex justify-between text-[11px] font-mono">
														<span class="text-muted-foreground flex items-center gap-1 font-sans font-medium">
															<span class="size-2 rounded-full {insumo.isDeficit ? 'bg-red-500' : 'bg-emerald-500'} inline-block"></span>
															Stock actual disponible:
														</span>
														<span class="font-bold {insumo.isDeficit ? 'text-red-600' : 'text-emerald-700'}">
															{formatQty(insumo.currentStock)} {insumo.baseUnit}
														</span>
													</div>
													<div class="h-3 w-full bg-muted/60 rounded-md overflow-hidden">
														<div
															class="h-full transition-all duration-300 rounded-md {insumo.isDeficit ? 'bg-red-500' : 'bg-emerald-500'}"
															style="width: {Math.max(2, stockBarWidth)}%;"
														></div>
													</div>
												</div>
											</div>

											<!-- Botón de Restock Rápido para este Insumo -->
											<div class="pt-1.5 border-t border-border/40 flex items-center justify-between text-[11px]">
												<span class="text-muted-foreground">
													Stock mínimo de seguridad: {formatQty(insumo.minStock)} {insumo.baseUnit}
												</span>
												<button
													type="button"
													onclick={() => {
														const raw = data.items.find((i) => i.id === insumo.itemId);
														if (raw) openQuickRestock(raw);
													}}
													class="inline-flex items-center gap-1 text-primary hover:underline font-medium cursor-pointer"
												>
													<RefreshCw class="size-3" />
													<span>Ajustar stock de {insumo.name}</span>
												</button>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</Card.Content>
					</Card.Root>
				{:else}
					<div class="rounded-xl border border-border bg-card p-12 text-center space-y-3">
						<CakeSlice class="mx-auto size-12 text-muted-foreground/40" />
						<h3 class="text-base font-bold text-foreground">
							Selecciona un producto del catálogo
						</h3>
						<p class="text-xs text-muted-foreground max-w-sm mx-auto">
							Elige cualquier producto de la lista izquierda para consultar sus ítems asociados, el stock disponible y el gráfico de barras comparativo de insumos.
						</p>
					</div>
				{/if}
			</div>
		{/snippet}

		{#snippet newItemModal()}
	<!-- Modal de Alta Rápida de Nuevo Ítem -->
	{#if showNewItemModal}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
			<div class="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl space-y-5">
				<div class="flex items-center justify-between border-b border-border pb-3">
					<div>
						<h3 class="text-lg font-bold text-foreground">Alta de Nuevo Ítem</h3>
						<p class="text-xs text-muted-foreground">
							Crea materias primas, sub-ensambles o productos finales
						</p>
					</div>
					<button
						type="button"
						onclick={() => (showNewItemModal = false)}
						class="rounded-lg p-1 text-muted-foreground hover:bg-muted cursor-pointer"
					>
						<X class="size-5" />
					</button>
				</div>

				<form
					method="POST"
					action="?/createItem"
					use:enhance={() => {
						return async ({ update }) => {
							await update();
							showNewItemModal = false;
						};
					}}
					class="space-y-4 text-xs"
				>
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1">
							<Label class="text-xs font-medium">Tipo de Ítem</Label>
							<select
								name="type"
								bind:value={newItemType}
								class="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs"
							>
								{#each ITEM_TYPES as t}
									<option value={t}>{ITEM_TYPE_LABELS[t]}</option>
								{/each}
							</select>
						</div>

						<div class="space-y-1">
							<Label class="text-xs font-medium">Código Automático</Label>
							<Input
								name="code"
								value={nextAutoCode}
								readonly
								class="h-9 bg-muted font-mono font-bold text-xs"
							/>
						</div>
					</div>

					<div class="space-y-1">
						<Label class="text-xs font-medium">Nombre del Ítem</Label>
						<Input
							name="name"
							required
							placeholder="Ej. Harina 0000, Bizcochuelo Vainilla..."
							class="h-9 text-xs"
						/>
					</div>

					<div class="grid grid-cols-3 gap-3">
						<div class="space-y-1">
							<Label class="text-xs font-medium">Unidad Base</Label>
							<select
								name="baseUnit"
								bind:value={newItemBaseUnit}
								class="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs"
							>
								{#each UNITS_OF_MEASURE as u}
									<option value={u}>{UNIT_LABELS[u]}</option>
								{/each}
							</select>
						</div>

						<div class="space-y-1">
							<Label class="text-xs font-medium">Stock Inicial</Label>
							<Input
								type="number"
								step="0.01"
								name="currentStock"
								value="0"
								class="h-9 font-mono text-xs"
							/>
						</div>

						<div class="space-y-1">
							<Label class="text-xs font-medium">Stock Mínimo</Label>
							<Input
								type="number"
								step="0.01"
								name="minStock"
								bind:value={newItemMinStock}
								class="h-9 font-mono text-xs"
							/>
						</div>
					</div>

					{#if newItemType === 'raw_material'}
						<div class="grid grid-cols-2 gap-3">
							<div class="space-y-1">
								<Label class="text-xs font-medium">Costo de Compra ($)</Label>
								<Input
									type="number"
									step="0.01"
									name="referenceCost"
									value="0"
									class="h-9 font-mono text-xs"
								/>
							</div>
							<div class="space-y-1">
								<Label class="text-xs font-medium">Cant. Envase Compra ({newItemBaseUnit})</Label>
								<Input
									type="number"
									step="0.01"
									name="purchaseQuantity"
									value="1"
									class="h-9 font-mono text-xs"
								/>
							</div>
						</div>
						<input type="hidden" name="yieldQuantity" value="1" />
					{:else}
						<div class="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-2.5 text-xs text-muted-foreground">
							<p class="font-medium text-foreground">
								Esta elaboración calculará su costo y rendimiento en <strong class="text-primary">Estructura de Recetas</strong>.
							</p>
						</div>
						<input type="hidden" name="referenceCost" value="0" />
						<input type="hidden" name="purchaseQuantity" value="1" />
						<input type="hidden" name="yieldQuantity" value="1" />
					{/if}

					<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
						<Button
							type="button"
							variant="outline"
							onclick={() => (showNewItemModal = false)}
							class="cursor-pointer"
						>
							Cancelar
						</Button>
						<Button type="submit" class="cursor-pointer shadow-sm">
							Guardar Ítem
						</Button>
					</div>
				</form>
			</div>
		</div>
	{/if}
	{/snippet}

	{#snippet restockModal()}
	<!-- Modal de Ajuste Rápido de Stock -->
	{#if restockModalItem}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
			<div class="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
				<div class="flex items-center justify-between border-b border-border pb-3">
					<div>
						<h3 class="text-base font-bold text-foreground">Ajuste Rápido de Stock</h3>
						<p class="text-xs text-muted-foreground truncate" title={restockModalItem.name}>
							{restockModalItem.name} ({restockModalItem.code})
						</p>
					</div>
					<button
						type="button"
						onclick={() => (restockModalItemId = null)}
						class="rounded-lg p-1 text-muted-foreground hover:bg-muted cursor-pointer"
					>
						<X class="size-4" />
					</button>
				</div>

				<form
					method="POST"
					action="?/quickRestock"
					use:enhance={() => {
						return async ({ update }) => {
							await update();
							restockModalItemId = null;
						};
					}}
					class="space-y-4 text-xs"
				>
					<input type="hidden" name="id" value={restockModalItem.id} />

					<div class="space-y-1.5">
						<Label class="text-xs font-medium">
							Stock Actual ({restockModalItem.baseUnit})
						</Label>
						<Input
							type="number"
							step="0.01"
							name="currentStock"
							bind:value={restockCurrentStock}
							class="h-10 font-mono text-sm font-bold"
						/>
					</div>

					<div class="space-y-1.5">
						<Label class="text-xs font-medium">
							Stock Mínimo de Alerta ({restockModalItem.baseUnit})
						</Label>
						<Input
							type="number"
							step="0.01"
							name="minStock"
							bind:value={restockMinStock}
							class="h-9 font-mono text-xs"
						/>
					</div>

					<div class="flex items-center justify-end gap-2 pt-2 border-t border-border">
						<Button
							type="button"
							variant="outline"
							onclick={() => (restockModalItemId = null)}
							class="cursor-pointer"
						>
							Cancelar
						</Button>
						<Button type="submit" class="cursor-pointer shadow-sm">
							Actualizar Stock
						</Button>
					</div>
				</form>
			</div>
		</div>
	{/if}
{/snippet}

<AppShell
	user={data.user}
	businesses={data.businesses}
	activeBusiness={data.activeBusiness}
	currentSection="dashboard"
	title="Dashboard de Productos, Pedidos e Insumos"
	description="Supervisa productos de venta con sus ítems asociados, analiza la cobertura de insumos requeridos por pedidos y gestiona el stock en tiempo real"
	{headerActions}
>
	<div class="space-y-6">
		{@render kpiSummary()}

		<div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
			{@render catalogColumn()}
			{@render detailAndChartColumn()}
		</div>
	</div>

	{@render newItemModal()}
	{@render restockModal()}
</AppShell>
