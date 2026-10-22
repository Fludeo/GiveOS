<script lang="ts">
	import type { Item } from '#lib/features/items/domain/item.entity';
	import { getDirectUnitCost } from '#lib/features/items/domain/item.entity';
	import ItemTypeBadge from '#lib/features/items/ui/item-type-badge.svelte';
	import TablePagination from '#lib/components/ui/pagination/table-pagination.svelte';
	import { Card, CardHeader, CardContent } from '#lib/components/ui/card';
	import { Button } from '#lib/components/ui/button';
	import { Input } from '#lib/components/ui/input';
	import { Badge } from '#lib/components/ui/badge';
	import Package from '@lucide/svelte/icons/package';
	import Layers from '@lucide/svelte/icons/layers';
	import Boxes from '@lucide/svelte/icons/boxes';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import Search from '@lucide/svelte/icons/search';
	import Wheat from '@lucide/svelte/icons/wheat';
	import GraphHub from '@lucide/svelte/icons/graph-hub';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import List from '@lucide/svelte/icons/list';
	import Plus from '@lucide/svelte/icons/plus';
	import Clock from '@lucide/svelte/icons/clock';
	import PackagePlus from '@lucide/svelte/icons/package-plus';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Pencil from '@lucide/svelte/icons/pencil';
	import History from '@lucide/svelte/icons/history';
	import CirclePile from '@lucide/svelte/icons/circle-pile';
	import FilterX from '@lucide/svelte/icons/filter-x';
	import { formatCurrency, formatQuantity, getDaysAgo } from '../utils';

	interface Props {
		items: Item[];
		recipeSummaries: Record<string, { directComponentsCount: number; estimatedUnitCost: number }>;
		restockItemId?: string | null;
		onOpenNewItem: () => void;
		onOpenAddStock: (item: Item) => void;
		onOpenAdjust: (item: Item) => void;
		onSelectCatalogItem: (itemId: string) => void;
		onViewRecipe: (itemId: string) => void;
	}

	let {
		items,
		recipeSummaries,
		restockItemId,
		onOpenNewItem,
		onOpenAddStock,
		onOpenAdjust,
		onSelectCatalogItem,
		onViewRecipe
	}: Props = $props();

	let searchQuery = $state('');
	let filterType = $state<'all' | 'raw_material' | 'prepared'>('all');
	let onlyLowStock = $state(false);
	let stockViewMode = $state<'cards' | 'table'>('cards');
	let currentPage = $state(1);
	let pageSize = $state(12);

	function toggleStockView(mode: 'cards' | 'table') {
		stockViewMode = mode;
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem('giveos-stock-view-mode', mode);
			} catch {}
		}
	}

	$effect(() => {
		if (typeof window !== 'undefined') {
			try {
				const saved = localStorage.getItem('giveos-stock-view-mode');
				if (saved === 'cards' || saved === 'table') {
					stockViewMode = saved;
				}
			} catch {}
		}
	});

	const lowStockCount = $derived(
		items.filter((i) => i.minStock > 0 && i.currentStock <= i.minStock).length
	);

	const totalInventoryValue = $derived(
		items.reduce((sum, item) => {
			const unitCost = recipeSummaries[item.id]?.estimatedUnitCost ?? getDirectUnitCost(item);
			return sum + item.currentStock * unitCost;
		}, 0)
	);

	const filteredItems = $derived(
		items.filter((item) => {
			if (filterType !== 'all' && item.type !== filterType) return false;
			if (onlyLowStock && !(item.minStock > 0 && item.currentStock <= item.minStock)) {
				return false;
			}
			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase().trim();
				return item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q);
			}
			return true;
		})
	);

	$effect(() => {
		void searchQuery;
		void filterType;
		void onlyLowStock;
		currentPage = 1;
	});

	$effect(() => {
		if (restockItemId) {
			const idx = filteredItems.findIndex((i) => i.id === restockItemId);
			if (idx !== -1) {
				currentPage = Math.floor(idx / pageSize) + 1;
				const target = filteredItems[idx];
				if (target.type === 'raw_material') {
					onOpenAddStock(target);
				} else {
					onOpenAdjust(target);
				}
			}
		}
	});

	const paginatedItems = $derived(
		filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize)
	);
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
	<!-- KPI 1: Catálogo (Primary / Blue) -->
	<div class="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-2">
		<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
			Catálogo
		</span>
		<div class="flex items-center gap-3 pt-0.5">
			<div class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
				<Package class="size-6" />
			</div>
			<div class="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
				{items.length} <span class="text-sm font-semibold text-muted-foreground font-sans">ítems</span>
			</div>
		</div>
		<p class="text-xs text-muted-foreground">
			{items.filter((i) => i.type === 'raw_material').length} insumos ·
			{items.filter((i) => i.type === 'prepared').length} elaboraciones
		</p>
	</div>

	<!-- KPI 2: Stock Bajo (Destructive / Warning) -->
	<div class="rounded-2xl border {lowStockCount > 0 ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-card'} p-4 sm:p-5 shadow-xs space-y-2">
		<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
			Stock Bajo
		</span>
		<div class="flex items-center gap-3 pt-0.5">
			<div
				class="flex size-11 shrink-0 items-center justify-center rounded-2xl {lowStockCount > 0
					? 'bg-destructive/15 text-destructive'
					: 'bg-muted text-muted-foreground'}"
			>
				<AlertTriangle class="size-6" />
			</div>
			<div class="font-mono text-2xl sm:text-3xl font-bold tracking-tight {lowStockCount > 0 ? 'text-destructive' : 'text-foreground'}">
				{lowStockCount}
			</div>
		</div>
		<p class="text-xs text-muted-foreground">
			{lowStockCount > 0 ? 'Bajo el punto de alerta de reposición' : 'Todas las existencias sobre el mínimo'}
		</p>
	</div>

	<!-- KPI 3: Valor en Stock (Secondary / Indigo) -->
	<div class="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-2">
		<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
			Valor en Stock
		</span>
		<div class="flex items-center gap-3 pt-0.5">
			<div class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary/15 text-secondary">
				<Boxes class="size-6" />
			</div>
			<div class="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
				{formatCurrency(totalInventoryValue)}
			</div>
		</div>
		<p class="text-xs text-muted-foreground">
			Costo valorizado total de existencias
		</p>
	</div>
</div>

<Card>
	<CardHeader class="space-y-4 p-6 sm:p-8 sm:pb-4">
		<div class="flex flex-wrap items-center justify-between gap-4">
			<div class="relative w-full max-w-sm">
				<Search class="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
				<Input
					type="search"
					placeholder="Buscar por SKU o nombre..."
					bind:value={searchQuery}
					class="h-10 pl-9"
				/>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<Button
					size="sm"
					variant={filterType === 'all' ? 'default' : 'outline'}
					onclick={() => (filterType = 'all')}
				>
					Todos
				</Button>
				<Button
					size="sm"
					variant={filterType === 'raw_material' ? 'default' : 'outline'}
					class="gap-1.5"
					onclick={() => (filterType = 'raw_material')}
				>
					<Wheat class="size-3.5 {filterType === 'raw_material' ? 'text-primary-foreground' : 'text-yellow-600 dark:text-yellow-400'}" />
					<span>Insumos</span>
				</Button>
				<Button
					size="sm"
					variant={filterType === 'prepared' ? 'default' : 'outline'}
					class="gap-1.5"
					onclick={() => (filterType = 'prepared')}
				>
					<GraphHub class="size-3.5 {filterType === 'prepared' ? 'text-primary-foreground' : 'text-secondary'}" />
					<span>Elaboraciones</span>
				</Button>
				<Button
					size="sm"
					variant={onlyLowStock ? 'destructive' : 'outline'}
					class="gap-1.5"
					onclick={() => (onlyLowStock = !onlyLowStock)}
				>
					<AlertTriangle class="size-3.5 {onlyLowStock ? 'text-destructive-foreground' : 'text-destructive'}" />
					<span>Stock Bajo</span>
				</Button>

				<div class="ml-auto hidden sm:flex items-center gap-1 rounded-xl border border-border bg-muted/30 p-0.5">
					<Button
						type="button"
						variant={stockViewMode === 'cards' ? 'default' : 'ghost'}
						size="sm"
						class="h-7 px-2 text-xs gap-1"
						onclick={() => toggleStockView('cards')}
						title="Vista de Tarjetas (Móvil)"
					>
						<LayoutGrid class="size-3.5" />
						<span>Tarjetas</span>
					</Button>
					<Button
						type="button"
						variant={stockViewMode === 'table' ? 'default' : 'ghost'}
						size="sm"
						class="h-7 px-2 text-xs gap-1"
						onclick={() => toggleStockView('table')}
						title="Vista de Tabla"
					>
						<List class="size-3.5" />
						<span>Tabla</span>
					</Button>
				</div>

				<Button
					variant="tertiary"
					onclick={onOpenNewItem}
					class="h-9 gap-1.5 shadow-xs font-semibold cursor-pointer"
				>
					<Plus class="size-4" />
					<span>Nuevo Ítem</span>
				</Button>
			</div>
		</div>
	</CardHeader>

	<CardContent class="p-4 pt-2 sm:p-6 sm:pt-4">
		{#if filteredItems.length > 0}
			<div class="space-y-4">
				{#if stockViewMode === 'cards'}
					<!-- VISTA DE TARJETAS (MOBILE-FIRST) -->
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{#each paginatedItems as item (item.id)}
							{@const isLow = item.minStock > 0 && item.currentStock <= item.minStock}
							{@const recipeSummary = recipeSummaries[item.id]}
							{@const latestBatch = item.batches && item.batches.length > 0 ? item.batches[item.batches.length - 1] : null}
							{@const activeBatches = item.batches ? item.batches.filter((b) => b.remainingQuantity > 0) : []}
							<div
								class="flex flex-col justify-between rounded-2xl border p-4 transition-all shadow-2xs {isLow
									? 'border-destructive/40 bg-card hover:border-destructive/60'
									: 'border-border bg-card hover:border-border/80'}"
							>
								<div>
									<div class="flex items-center justify-between gap-2">
										<span class="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-tight bg-muted text-muted-foreground">
											{item.code}
										</span>
										<div class="flex items-center gap-1.5">
											{#if isLow}
												<Badge variant="destructive" class="text-[10px] px-1.5 py-0">Reponer</Badge>
											{/if}
											<ItemTypeBadge type={item.type} short={true} />
										</div>
									</div>

									<div class="mt-2.5">
										<button
											type="button"
											onclick={() => onSelectCatalogItem(item.id)}
											class="text-left font-bold text-base text-foreground hover:text-primary transition-colors line-clamp-1 cursor-pointer"
										>
											{item.name}
										</button>
										{#if item.notes}
											<p class="mt-0.5 text-xs text-muted-foreground line-clamp-1">{item.notes}</p>
										{/if}
									</div>

									<!-- HERO: Stock Actual Protagonista Grande con Ícono -->
									<div class="mt-3.5 flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 p-3">
										<div class="flex items-center gap-3">
											<div
												class="flex size-11 shrink-0 items-center justify-center rounded-2xl {isLow
													? 'bg-destructive/15 text-destructive'
													: item.type === 'prepared'
														? 'bg-secondary/15 text-secondary'
														: 'bg-amber-500/15 text-amber-600 dark:text-amber-400'}"
											>
												<Package class="size-6" />
											</div>
											<div>
												<span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
													Stock Disponible
												</span>
												<div class="flex items-baseline gap-1.5 font-mono">
													<span class="text-2xl sm:text-3xl font-black tracking-tight {isLow ? 'text-destructive' : 'text-foreground'}">
														{formatQuantity(item.currentStock)}
													</span>
													<span class="text-xs font-semibold text-muted-foreground uppercase font-sans">
														{item.baseUnit === 'unit' ? 'un.' : item.baseUnit}
													</span>
												</div>
											</div>
										</div>

										<div class="text-right">
											<div class="flex items-center justify-end gap-1 font-mono text-[11px] {isLow ? 'text-destructive font-bold' : 'text-muted-foreground'}">
												<AlertTriangle class="size-3.5 {isLow ? 'text-destructive' : 'text-muted-foreground/70'}" />
												<span>Mín: {formatQuantity(item.minStock)} {item.baseUnit === 'unit' ? 'un.' : item.baseUnit}</span>
											</div>
											{#if isLow}
												<span class="text-[10px] text-destructive font-semibold">Stock Crítico</span>
											{:else}
												<span class="text-[10px] text-muted-foreground/70">Al día</span>
											{/if}
										</div>
									</div>

									<!-- Metadata Secundaria: Costo Unitario y Última Carga -->
									<div class="mt-2.5 flex items-center justify-between gap-2 px-1 text-xs">
										<div class="flex items-center gap-1.5 text-muted-foreground text-[11px] truncate">
											<History class="size-3.5 shrink-0 text-muted-foreground/70" />
											{#if latestBatch}
												<span class="truncate">Últ: <strong class="text-foreground/90 font-medium">{getDaysAgo(latestBatch.createdAt)}</strong> <span class="{item.type === 'prepared' ? 'text-secondary' : 'text-primary'} font-bold">(+{formatQuantity(latestBatch.initialQuantity)} {item.baseUnit === 'unit' ? 'un.' : item.baseUnit})</span></span>
											{:else}
												<span class="text-muted-foreground/60">Sin cargas</span>
											{/if}
										</div>

										<div class="shrink-0 text-right">
											{#if item.type === 'raw_material'}
												<span class="font-mono text-xs font-bold text-foreground">
													{formatCurrency(getDirectUnitCost(item))}
												</span>
												<span class="text-[10px] text-muted-foreground">/{item.baseUnit === 'unit' ? 'un.' : item.baseUnit}</span>
											{:else if recipeSummary && recipeSummary.directComponentsCount > 0}
												<span class="font-mono text-xs font-bold text-foreground">
													{formatCurrency(recipeSummary.estimatedUnitCost)}
												</span>
												<span class="text-[10px] text-muted-foreground">/{item.baseUnit === 'unit' ? 'un.' : item.baseUnit}</span>
											{:else}
												<button
													type="button"
													onclick={() => onSelectCatalogItem(item.id)}
													class="text-[11px] font-semibold text-primary hover:underline"
												>
													+ Armar Receta
												</button>
											{/if}
										</div>
									</div>
								</div>

								<div class="mt-3.5 flex items-center justify-end gap-2 border-t border-border/50 pt-3">
									{#if item.type === 'raw_material'}
										<Button
											type="button"
											variant="outline"
											size="sm"
											class="h-8 text-xs gap-1"
											onclick={() => onOpenAddStock(item)}
										>
											<PackagePlus class="size-3.5 text-yellow-600 dark:text-yellow-400" />
											<span>Cargar Stock</span>
										</Button>
									{:else}
										<Button
											type="button"
											variant="outline"
											size="sm"
											class="h-8 text-xs gap-1"
											onclick={() => onOpenAddStock(item)}
										>
											<PackagePlus class="size-3.5 text-secondary" />
											<span>Cargar Stock</span>
										</Button>
										<Button
											type="button"
											variant="outline"
											size="sm"
											class="h-8 text-xs gap-1"
											onclick={() => onViewRecipe(item.id)}
										>
											<BookOpen class="size-3.5 text-secondary" />
											<span>Receta</span>
										</Button>
									{/if}
									<Button
										type="button"
										variant="outline"
										size="sm"
										class="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
										onclick={() => onOpenAdjust(item)}
									>
										<Pencil class="size-3.5" />
										<span>Ajustar</span>
									</Button>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<!-- VISTA DE TABLA -->
					<div class="overflow-x-auto rounded-xl border border-border">
						<table class="w-full text-left text-sm">
							<thead class="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
								<tr>
									<th class="py-3.5 pr-4 pl-5 font-semibold whitespace-nowrap">Ítem</th>
									<th class="px-4 py-3.5 font-semibold whitespace-nowrap">Tipo</th>
									<th class="px-4 py-3.5 font-semibold whitespace-nowrap">Stock / Alerta</th>
									<th class="px-4 py-3.5 font-semibold whitespace-nowrap">Últ. Carga</th>
									<th class="px-4 py-3.5 font-semibold whitespace-nowrap">Costo Unit.</th>
									<th class="py-3.5 pr-5 pl-4 text-right font-semibold whitespace-nowrap">Acciones</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border/60">
								{#each paginatedItems as item (item.id)}
									{@const isLow = item.minStock > 0 && item.currentStock <= item.minStock}
									{@const recipeSummary = recipeSummaries[item.id]}
									{@const latestBatch = item.batches && item.batches.length > 0 ? item.batches[item.batches.length - 1] : null}
									{@const activeBatches = item.batches ? item.batches.filter((b) => b.remainingQuantity > 0) : []}
									<tr class="transition-colors hover:bg-muted/20">
										<td class="py-4 pr-4 pl-5 align-middle">
											<div class="flex items-center gap-2.5">
												<span class="shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-tight bg-muted text-muted-foreground">
													{item.code}
												</span>
												<button
													type="button"
													onclick={() => onSelectCatalogItem(item.id)}
													class="text-left font-medium text-foreground hover:text-primary hover:underline"
												>
													{item.name}
												</button>
												{#if isLow}
													<Badge variant="destructive" class="shrink-0 text-[10px]">Reponer</Badge>
												{/if}
											</div>
											{#if item.notes}
												<p class="mt-1 text-xs text-muted-foreground">{item.notes}</p>
											{/if}
										</td>

										<td class="px-4 py-4 align-middle whitespace-nowrap">
											<ItemTypeBadge type={item.type} short={true} />
										</td>

										<td class="px-4 py-4 align-middle whitespace-nowrap">
											<div class="space-y-0.5">
												<p class="font-mono text-xs font-semibold {isLow ? 'text-destructive' : 'text-foreground'}">
													{formatQuantity(item.currentStock)} {item.baseUnit === 'unit' ? 'un.' : item.baseUnit}
												</p>
												<div class="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
													<AlertTriangle class="size-3 text-muted-foreground/70" />
													<span>{formatQuantity(item.minStock)} {item.baseUnit === 'unit' ? 'un.' : item.baseUnit}</span>
												</div>
											</div>
										</td>

										<td class="px-4 py-4 align-middle whitespace-nowrap">
											<div class="space-y-0.5 text-xs">
												{#if latestBatch}
													<div class="flex items-center gap-1.5 text-foreground font-medium">
														<History class="size-3 text-muted-foreground shrink-0" />
														<span>{getDaysAgo(latestBatch.createdAt)}</span>
													</div>
													<p class="font-mono text-[11px] {item.type === 'prepared' ? 'text-secondary' : 'text-primary'} font-bold">
														+{formatQuantity(latestBatch.initialQuantity)} {item.baseUnit === 'unit' ? 'un.' : item.baseUnit}
													</p>
												{:else}
													<div class="flex items-center gap-1.5 text-muted-foreground">
														<History class="size-3 shrink-0" />
														<span>Sin cargas</span>
													</div>
												{/if}
											</div>
										</td>

										<td class="px-4 py-4 align-middle whitespace-nowrap">
											{#if item.type === 'raw_material'}
												<div class="space-y-0.5">
													<p class="font-mono text-xs font-semibold text-foreground">
														{formatCurrency(getDirectUnitCost(item))}
														<span class="font-sans font-normal text-muted-foreground">
															/ {item.baseUnit === 'unit' ? 'un.' : item.baseUnit}
														</span>
													</p>
												</div>
											{:else if recipeSummary && recipeSummary.directComponentsCount > 0}
												<div class="space-y-0.5">
													<p class="font-mono text-xs font-semibold text-foreground">
														{formatCurrency(recipeSummary.estimatedUnitCost)} / {item.baseUnit === 'unit' ? 'un.' : item.baseUnit}
													</p>
												</div>
											{:else}
												<button
													type="button"
													onclick={() => onSelectCatalogItem(item.id)}
													class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
												>
													<span>Armar Receta →</span>
												</button>
											{/if}
										</td>

										<td class="py-4 pr-5 pl-4 text-right align-middle whitespace-nowrap">
											<div class="inline-flex items-center justify-end gap-1.5">
												{#if item.type === 'raw_material'}
													<Button
														type="button"
														size="sm"
														variant="outline"
														class="h-8 gap-1.5 px-2.5 text-xs"
														title="Cargar stock"
														onclick={() => onOpenAddStock(item)}
													>
														<PackagePlus class="size-3.5 text-yellow-600 dark:text-yellow-400" />
														<span>Cargar Stock</span>
													</Button>
												{:else}
													<Button
														type="button"
														size="sm"
														variant="outline"
														class="h-8 gap-1.5 px-2.5 text-xs"
														title="Cargar stock elaborado"
														onclick={() => onOpenAddStock(item)}
													>
														<PackagePlus class="size-3.5 text-secondary" />
														<span>Cargar Stock</span>
													</Button>
													<Button
														type="button"
														size="sm"
														variant="outline"
														class="h-8 gap-1.5 px-2.5 text-xs"
														title="Ver receta"
														onclick={() => onViewRecipe(item.id)}
													>
														<BookOpen class="size-3.5 text-secondary" />
														<span>Receta</span>
													</Button>
												{/if}
												<Button
													type="button"
													size="icon"
													variant="outline"
													class="size-8 text-muted-foreground hover:text-foreground"
													title="Ajustar ítem"
													onclick={() => onOpenAdjust(item)}
												>
													<Pencil class="size-3.5" />
												</Button>
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
					totalItems={filteredItems.length}
					itemLabel="ítems"
				/>
			</div>
		{:else}
			{@const hasActiveFilters = searchQuery.trim() !== '' || filterType !== 'all' || onlyLowStock}
			<div class="rounded-xl border border-dashed border-border p-12 text-center">
				{#if hasActiveFilters}
					<FilterX class="mx-auto size-10 text-muted-foreground/60" />
					<p class="mt-3 text-base font-semibold text-foreground">
						No se encontraron ítems con los filtros aplicados
					</p>
					<p class="mt-1 text-sm text-muted-foreground">
						Prueba restablecer los filtros o cambiar el término de búsqueda.
					</p>
					<Button
						variant="outline"
						class="mt-4 gap-1.5 cursor-pointer"
						onclick={() => {
							searchQuery = '';
							filterType = 'all';
							onlyLowStock = false;
						}}
					>
						<FilterX class="size-4" />
						<span>Quitar Filtros</span>
					</Button>
				{:else}
					<Package class="mx-auto size-10 text-muted-foreground/60" />
					<p class="mt-3 text-base font-semibold text-foreground">
						No hay ítems registrados en el inventario
					</p>
					<p class="mt-1 text-sm text-muted-foreground">
						Registra insumos o productos para comenzar el control de stock.
					</p>
					<Button variant="tertiary" class="mt-4 gap-1.5 cursor-pointer" onclick={onOpenNewItem}>
						<Plus class="size-4" />
						<span>Nuevo Ítem</span>
					</Button>
				{/if}
			</div>
		{/if}
	</CardContent>
</Card>
