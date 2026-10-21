<script lang="ts">
	import { enhance } from '$app/forms';
	import { replaceState } from '$app/navigation';
	import type { PageProps } from './$types';
	import {
		ITEM_TYPES,
		ITEM_TYPE_LABELS,
		UNITS_OF_MEASURE,
		UNIT_LABELS,
		areUnitsCompatible,
		generateNextItemCode,
		getDirectUnitCost,
		type Item,
		type ItemType,
		type UnitOfMeasure
	} from '#lib/features/items/domain/item.entity';
	import {
		generateNextSalesProductCode,
		type SalesProductComponentInput,
		type SalesProductWithItems
	} from '#lib/features/orders/domain/order.entity';
	import ItemTypeBadge from '#lib/features/items/ui/item-type-badge.svelte';
	import RecipeTreeRow from '#lib/features/recipes/ui/recipe-tree-row.svelte';
	import AppShell from '#lib/components/layout/app-shell.svelte';
	import TablePagination from '#lib/components/ui/pagination/table-pagination.svelte';
	import { Button } from '#lib/components/ui/button';
	import { Badge } from '#lib/components/ui/badge';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import Package from '@lucide/svelte/icons/package';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import Layers from '@lucide/svelte/icons/layers';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Check from '@lucide/svelte/icons/check';
	import Pencil from '@lucide/svelte/icons/pencil';
	import X from '@lucide/svelte/icons/x';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Wheat from '@lucide/svelte/icons/wheat';
	import ChefHat from '@lucide/svelte/icons/chef-hat';
	import CakeSlice from '@lucide/svelte/icons/cake-slice';
	import Calculator from '@lucide/svelte/icons/calculator';
	import Settings2 from '@lucide/svelte/icons/settings-2';
	import Tag from '@lucide/svelte/icons/tag';
	import Link2 from '@lucide/svelte/icons/link-2';
	import Star from '@lucide/svelte/icons/star';

	let { data }: PageProps = $props();

	// Pestaña activa: 'stock' (Inventario) | 'recipes' (Estructura de Recetas) | 'products' (Productos para Venta)
	let activeTab = $state<'stock' | 'recipes' | 'products' | null>(null);
	const currentTab = $derived<'stock' | 'recipes' | 'products'>(activeTab ?? data.initialTab);

	function switchTab(tab: 'stock' | 'recipes' | 'products') {
		activeTab = tab;
		if (typeof window !== 'undefined') {
			const url = new URL(window.location.href);
			url.searchParams.set('tab', tab);
			replaceState(url, {});
		}
	}

	// =========================================================================
	// ESTADO COMPARTIDO Y MODAL DE ALTA DE ÍTEM DE INVENTARIO / RECETA
	// =========================================================================
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

	// =========================================================================
	// TAB 1: EXISTENCIAS E INVENTARIO
	// =========================================================================
	let searchQuery = $state('');
	let filterType = $state<ItemType | 'all'>('all');
	let onlyLowStock = $state(false);

	let editingItemId = $state<string | null>(null);
	let editingMinStock = $state<number>(0);
	let viewingRecipeItemId = $state<string | null>(null);
	let deletingItemId = $state<string | null>(null);

	let currentPage = $state(1);
	let pageSize = $state(10);
	let recipeModalPage = $state(1);
	let recipeModalPageSize = $state(5);

	const viewingRecipeItem = $derived(
		viewingRecipeItemId ? (data.items.find((i) => i.id === viewingRecipeItemId) ?? null) : null
	);
	const deletingItem = $derived(
		deletingItemId ? (data.items.find((i) => i.id === deletingItemId) ?? null) : null
	);

	const lowStockCount = $derived(
		data.items.filter((i) => i.minStock > 0 && i.currentStock <= i.minStock).length
	);

	const totalInventoryValue = $derived(
		data.items.reduce((sum, item) => {
			const unitCost =
				data.recipeSummaries[item.id]?.estimatedUnitCost ?? getDirectUnitCost(item);
			return sum + item.currentStock * unitCost;
		}, 0)
	);

	const filteredItems = $derived(
		data.items.filter((item) => {
			if (filterType !== 'all' && item.type !== filterType) return false;
			if (onlyLowStock && !(item.minStock > 0 && item.currentStock <= item.minStock)) {
				return false;
			}
			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase().trim();
				return (
					item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q)
				);
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
		void viewingRecipeItemId;
		recipeModalPage = 1;
	});

	// Si venimos desde Dashboard con ?restock=ID, posicionar y abrir edición
	$effect(() => {
		if (data.restockItemId) {
			activeTab = 'stock';
			const idx = filteredItems.findIndex((i) => i.id === data.restockItemId);
			if (idx !== -1) {
				currentPage = Math.floor(idx / pageSize) + 1;
				const target = filteredItems[idx];
				editingItemId = target.id;
				editingMinStock = target.minStock;
			}
		}
	});

	function startEditing(item: Item) {
		editingItemId = item.id;
		editingMinStock = item.minStock;
	}

	const paginatedItems = $derived(
		filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize)
	);

	// =========================================================================
	// TAB 2: ESTRUCTURA DE RECETAS (MULTINIVEL)
	// =========================================================================
	let recipeSearchQuery = $state('');
	let recipeFilterType = $state<ItemType | 'all'>('all');
	let catalogPage = $state(1);
	let catalogPageSize = $state(6);
	let recipeTablePage = $state(1);
	let recipeTablePageSize = $state(8);

	let showEditItemModal = $state(false);
	let showAddRecipeLineModal = $state(false);
	let showDeleteRecipeItemModal = $state(false);

	let selectedItemId = $state<string | null>(null);

	const filteredRecipeCatalog = $derived(
		data.items.filter((item) => {
			if (recipeFilterType !== 'all' && item.type !== recipeFilterType) return false;
			if (recipeSearchQuery.trim()) {
				const q = recipeSearchQuery.toLowerCase().trim();
				return (
					item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q)
				);
			}
			return true;
		})
	);

	$effect(() => {
		void recipeSearchQuery;
		void recipeFilterType;
		catalogPage = 1;
	});

	const paginatedCatalogItems = $derived(
		filteredRecipeCatalog.slice(
			(catalogPage - 1) * catalogPageSize,
			catalogPage * catalogPageSize
		)
	);

	const selectedRoot = $derived(
		(selectedItemId ? data.items.find((i) => i.id === selectedItemId) : null) ??
			data.selectedRecipeTree?.rootItem ??
			data.items[0] ??
			null
	);

	const selectedTree = $derived.by(() => {
		if (!selectedRoot) return null;
		const summary = data.recipeSummaries[selectedRoot.id];
		return {
			rootItem: selectedRoot,
			nodes: summary?.nodes ?? [],
			estimatedTotalCost: summary?.estimatedTotalCost ?? selectedRoot.referenceCost,
			estimatedUnitCost: summary?.estimatedUnitCost ?? getDirectUnitCost(selectedRoot)
		};
	});

	function selectCatalogItem(itemId: string) {
		selectedItemId = itemId;
		activeTab = 'recipes';
		const idx = filteredRecipeCatalog.findIndex((i) => i.id === itemId);
		if (idx !== -1) {
			catalogPage = Math.floor(idx / catalogPageSize) + 1;
		}
		if (typeof window !== 'undefined') {
			const url = new URL(window.location.href);
			url.searchParams.set('tab', 'recipes');
			url.searchParams.set('item', itemId);
			replaceState(url, {});
		}
	}

	$effect(() => {
		void selectedRoot?.id;
		recipeTablePage = 1;
	});

	const availableComponentsForSelected = $derived(
		data.items.filter((item) => item.id !== selectedRoot?.id)
	);

	let selectedComponentId = $state('');
	let selectedRecipeUnit = $state<UnitOfMeasure>('g');

	const selectedComponent = $derived(
		data.items.find((i) => i.id === selectedComponentId) ?? null
	);

	const compatibleUnits = $derived<UnitOfMeasure[]>(
		selectedComponent
			? UNITS_OF_MEASURE.filter((u) => areUnitsCompatible(u, selectedComponent.baseUnit))
			: [...UNITS_OF_MEASURE]
	);

	$effect(() => {
		if (selectedComponent && !areUnitsCompatible(selectedRecipeUnit, selectedComponent.baseUnit)) {
			selectedRecipeUnit = selectedComponent.baseUnit;
		}
	});

	$effect(() => {
		if (
			availableComponentsForSelected.length > 0 &&
			(!selectedComponentId || selectedComponentId === selectedRoot?.id)
		) {
			const first = availableComponentsForSelected[0];
			selectedComponentId = first.id;
			selectedRecipeUnit = first.baseUnit;
		}
	});

	// =========================================================================
	// TAB 3: PRODUCTOS PARA VENTA (CATÁLOGO COMERCIAL Y COMBOS ASOCIADOS A ITEMS)
	// =========================================================================
	let salesProductSearch = $state('');
	let salesProductPage = $state(1);
	let salesProductPageSize = $state(8);

	let showNewSalesProductModal = $state(false);
	let editingSalesProduct = $state<SalesProductWithItems | null>(null);
	let deletingSalesProduct = $state<SalesProductWithItems | null>(null);

	// Permitir vincular cualquier ítem de inventario (materia prima, sub-ensamble o producto final)
	const linkableItems = $derived(data.items);

	let newSalesComponents = $state<SalesProductComponentInput[]>([]);
	let newSalesName = $state('');
	let newSalesPrice = $state(0);

	let editSalesComponents = $state<SalesProductComponentInput[]>([]);
	let editSalesPrice = $state(0);

	$effect(() => {
		if (newSalesComponents.length === 0 && linkableItems.length > 0) {
			const first = linkableItems[0];
			newSalesComponents = [{ itemId: first.id, quantity: 1 }];
			if (!newSalesName) newSalesName = first.name;
		}
	});

	function openEditSalesProduct(sp: SalesProductWithItems) {
		editingSalesProduct = sp;
		editSalesPrice = sp.salePrice;
		if (sp.components.length > 0) {
			editSalesComponents = sp.components.map((c) => ({
				itemId: c.itemId,
				quantity: c.quantity
			}));
		} else if (linkableItems.length > 0) {
			editSalesComponents = [{ itemId: linkableItems[0].id, quantity: 1 }];
		} else {
			editSalesComponents = [];
		}
	}

	function addNewSalesComponentLine() {
		if (linkableItems.length === 0) return;
		const unused =
			linkableItems.find((cand) => !newSalesComponents.some((c) => c.itemId === cand.id)) ??
			linkableItems[0];
		newSalesComponents = [...newSalesComponents, { itemId: unused.id, quantity: 1 }];
	}

	function removeNewSalesComponentLine(index: number) {
		if (newSalesComponents.length <= 1) return;
		newSalesComponents = newSalesComponents.filter((_, i) => i !== index);
	}

	function addEditSalesComponentLine() {
		if (linkableItems.length === 0) return;
		const unused =
			linkableItems.find((cand) => !editSalesComponents.some((c) => c.itemId === cand.id)) ??
			linkableItems[0];
		editSalesComponents = [...editSalesComponents, { itemId: unused.id, quantity: 1 }];
	}

	function removeEditSalesComponentLine(index: number) {
		if (editSalesComponents.length <= 1) return;
		editSalesComponents = editSalesComponents.filter((_, i) => i !== index);
	}

	function calculateComponentsRecipeCost(comps: SalesProductComponentInput[]): number {
		let total = 0;
		for (const comp of comps) {
			const found = data.items.find((i) => i.id === comp.itemId);
			if (!found) continue;
			const unitCost =
				data.recipeSummaries[found.id]?.estimatedUnitCost ?? getDirectUnitCost(found);
			const qty = Number(comp.quantity) > 0 ? Number(comp.quantity) : 0;
			total += unitCost * qty;
		}
		return total;
	}

	const estimatedCostForNewSalesProduct = $derived(
		calculateComponentsRecipeCost(newSalesComponents)
	);

	const estimatedCostForEditSalesProduct = $derived(
		calculateComponentsRecipeCost(editSalesComponents)
	);

	const nextSalesProductCode = $derived(
		generateNextSalesProductCode(data.salesProducts.map((p) => p.code))
	);

	const filteredSalesProducts = $derived(
		data.salesProducts.filter((p) => {
			if (!salesProductSearch.trim()) return true;
			const q = salesProductSearch.toLowerCase().trim();
			return (
				p.name.toLowerCase().includes(q) ||
				p.code.toLowerCase().includes(q) ||
				p.components.some(
					(c) =>
						(c.item?.name.toLowerCase().includes(q) ?? false) ||
						(c.item?.code.toLowerCase().includes(q) ?? false)
				)
			);
		})
	);

	const paginatedSalesProducts = $derived(
		filteredSalesProducts.slice(
			(salesProductPage - 1) * salesProductPageSize,
			salesProductPage * salesProductPageSize
		)
	);

	function formatCurrency(val: number): string {
		return `$ ${new Intl.NumberFormat('es-AR', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(val)}`;
	}
</script>

<svelte:head>
	<title>Inventario, Recetas y Productos — {data.activeBusiness.name}</title>
</svelte:head>

<AppShell
	user={data.user}
	activeBusiness={data.activeBusiness}
	businesses={data.businesses}
	currentSection="inventory"
	title="Inventario, Estructura de Recetas y Productos para Venta"
	description="Gestiona tus existencias, arma recetas multinivel y publica los productos comerciales disponibles para Órdenes"
>
	{#snippet headerActions()}
		{#if currentTab === 'products'}
			<Button href="/inventory/products/new">
				<Plus class="size-4" />
				<span>Nuevo Producto para Venta</span>
			</Button>
		{:else}
			<Button onclick={() => (showNewItemModal = true)}>
				<Plus class="size-4" />
				<span>Nuevo Ítem de Inventario</span>
			</Button>
		{/if}
	{/snippet}

	<!-- Barra de Pestañas Unificada (Inventario | Recetas | Productos para Venta) -->
	<div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-1.5 shadow-2xs">
		<div class="flex flex-wrap items-center gap-1">
			<button
				type="button"
				onclick={() => switchTab('stock')}
				class="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all {currentTab ===
				'stock'
					? 'bg-primary text-primary-foreground shadow-xs'
					: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
			>
				<Package class="size-4" />
				<span>Inventario</span>
				<Badge
					variant={currentTab === 'stock' ? 'secondary' : 'outline'}
					class="ml-1 px-1.5 py-0 text-[11px]"
				>
					{data.items.length}
				</Badge>
			</button>

			<button
				type="button"
				onclick={() => switchTab('recipes')}
				class="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all {currentTab ===
				'recipes'
					? 'bg-primary text-primary-foreground shadow-xs'
					: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
			>
				<Layers class="size-4" />
				<span>Recetas</span>
			</button>

			<button
				type="button"
				onclick={() => switchTab('products')}
				class="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all {currentTab ===
				'products'
					? 'bg-primary text-primary-foreground shadow-xs'
					: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
			>
				<Tag class="size-4" />
				<span>Productos para Venta</span>
				<Badge
					variant={currentTab === 'products' ? 'secondary' : 'outline'}
					class="ml-1 px-1.5 py-0 text-[11px]"
				>
					{data.salesProducts.length}
				</Badge>
			</button>
		</div>

		<div class="px-3 text-xs text-muted-foreground hidden lg:block">
			{#if currentTab === 'stock'}
				Al incrementar stock de un sub-ensamble o producto, se descuentan sus ingredientes automáticamente.
			{:else if currentTab === 'recipes'}
				Define qué insumos y sub-ensambles componen cada receta y su rendimiento.
			{:else}
				Productos y combos comerciales disponibles para el módulo de Órdenes.
			{/if}
		</div>
	</div>

	<!-- ========================================================================
	     VISTA 1: INVENTARIO Y EXISTENCIAS
	     ======================================================================== -->
	{#if currentTab === 'stock'}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			<Card>
				<CardContent class="flex items-center justify-between p-4 sm:p-5">
					<div class="space-y-1">
						<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
							Total en Catálogo Técnico
						</p>
						<p class="text-2xl font-bold text-foreground">{data.items.length} ítems</p>
						<p class="text-xs text-muted-foreground">
							{data.items.filter((i) => i.type === 'raw_material').length} insumos ·
							{data.items.filter((i) => i.type === 'sub_assembly').length} bases ·
							{data.items.filter((i) => i.type === 'finished_product').length} productos
						</p>
					</div>
					<div class="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<Package class="size-5" />
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardContent class="flex items-center justify-between p-4 sm:p-5">
					<div class="space-y-1">
						<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
							Alertas de Stock Bajo
						</p>
						<p class="text-2xl font-bold {lowStockCount > 0 ? 'text-destructive' : 'text-foreground'}">
							{lowStockCount}
						</p>
						<p class="text-xs text-muted-foreground">
							Ítems en o por debajo del punto de alerta
						</p>
					</div>
					<div
						class="flex size-11 items-center justify-center rounded-xl {lowStockCount > 0
							? 'bg-destructive/10 text-destructive'
							: 'bg-muted text-muted-foreground'}"
					>
						<AlertTriangle class="size-5" />
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardContent class="flex items-center justify-between p-4 sm:p-5">
					<div class="space-y-1">
						<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
							Valor Valorizado en Stock
						</p>
						<p class="font-mono text-2xl font-bold text-foreground">
							{formatCurrency(totalInventoryValue)}
						</p>
						<p class="text-xs text-muted-foreground">
							Calculado según costo unitario o Receta
						</p>
					</div>
					<div class="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<Layers class="size-5" />
					</div>
				</CardContent>
			</Card>
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
							<Wheat class="size-3.5" />
							<span>Insumos</span>
						</Button>
						<Button
							size="sm"
							variant={filterType === 'sub_assembly' ? 'default' : 'outline'}
							class="gap-1.5"
							onclick={() => (filterType = 'sub_assembly')}
						>
							<ChefHat class="size-3.5" />
							<span>Sub-ensambles</span>
						</Button>
						<Button
							size="sm"
							variant={filterType === 'finished_product' ? 'default' : 'outline'}
							class="gap-1.5"
							onclick={() => (filterType = 'finished_product')}
						>
							<CakeSlice class="size-3.5" />
							<span>Productos</span>
						</Button>
						<Button
							size="sm"
							variant={onlyLowStock ? 'destructive' : 'outline'}
							onclick={() => (onlyLowStock = !onlyLowStock)}
						>
							<AlertTriangle class="size-3.5" />
							<span>Stock Bajo</span>
						</Button>
					</div>
				</div>
			</CardHeader>

			<CardContent class="p-6 pt-2 sm:p-8 sm:pt-4">
				{#if filteredItems.length > 0}
					{#if editingItemId}
						{@const activeEditItem = filteredItems.find((i) => i.id === editingItemId)}
						{#if activeEditItem}
							<form
								id="inv-form-{activeEditItem.id}"
								method="POST"
								action="?/updateStockAndCost"
								use:enhance={() => {
									return async ({ result, update }) => {
										await update();
										if (result.type === 'success') {
											editingItemId = null;
										}
									};
								}}
								class="hidden"
							>
								<input type="hidden" name="businessId" value={data.activeBusiness.id} />
								<input type="hidden" name="id" value={activeEditItem.id} />
								{#if activeEditItem.type !== 'raw_material'}
									<input type="hidden" name="referenceCost" value={activeEditItem.referenceCost} />
									<input
										type="hidden"
										name="purchaseQuantity"
										value={activeEditItem.purchaseQuantity}
									/>
								{/if}
							</form>
						{/if}
					{/if}

					<div class="space-y-4">
						<div class="overflow-x-auto rounded-xl border border-border">
							<table class="w-full text-left text-sm">
								<thead class="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
									<tr>
										<th class="py-3.5 pr-4 pl-5 font-semibold whitespace-nowrap">SKU / Ítem</th>
										<th class="px-4 py-3.5 font-semibold whitespace-nowrap">Tipo</th>
										<th class="px-4 py-3.5 font-semibold whitespace-nowrap">
											Stock (Actual / Mín.)
										</th>
										<th class="px-4 py-3.5 font-semibold whitespace-nowrap">Costo Base / Receta</th>
										<th class="py-3.5 pr-5 pl-4 text-right font-semibold whitespace-nowrap">
											Acciones
										</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-border/60">
									{#each paginatedItems as item (item.id)}
										{@const isLow = item.minStock > 0 && item.currentStock <= item.minStock}
										{@const recipeSummary = data.recipeSummaries[item.id]}
										{@const isEditing = editingItemId === item.id}
										<tr
											class="transition-colors {isEditing
												? 'bg-primary/5'
												: 'hover:bg-muted/20'}"
										>
											<td class="py-4 pr-4 pl-5 align-middle">
												<div class="flex items-center gap-2.5">
													<span class="shrink-0 whitespace-nowrap rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold">
														{item.code}
													</span>
													<button
														type="button"
														onclick={() => selectCatalogItem(item.id)}
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
												{#if isEditing}
													<div class="space-y-3 rounded-xl border border-border bg-background p-3 shadow-2xs">
														<div class="flex items-center justify-between gap-2">
															<span class="text-xs font-medium text-muted-foreground">
																Stock actual:
															</span>
															<div class="flex items-center gap-1.5">
																<Input
																	form="inv-form-{item.id}"
																	name="currentStock"
																	type="number"
																	step="any"
																	min="0"
																	value={item.currentStock}
																	aria-label="Stock actual de {item.name}"
																	class="h-8 w-24 font-mono text-xs"
																/>
																<span class="text-xs text-muted-foreground">{item.baseUnit}</span>
															</div>
														</div>

														<div class="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
															<span class="text-xs font-medium text-muted-foreground">
																Punto de alerta:
															</span>
															<div class="flex items-center gap-1.5">
																<Input
																	form="inv-form-{item.id}"
																	name="minStock"
																	type="number"
																	step="any"
																	min="0"
																	bind:value={editingMinStock}
																	aria-label="Punto de alerta de {item.name}"
																	class="h-8 w-24 font-mono text-xs"
																/>
																<span class="text-xs text-muted-foreground">{item.baseUnit}</span>
															</div>
														</div>
													</div>
												{:else}
													<div class="space-y-0.5">
														<p class="font-mono text-xs font-semibold {isLow ? 'text-destructive' : 'text-foreground'}">
															{item.currentStock} {item.baseUnit}
														</p>
														<p class="font-mono text-[11px] text-muted-foreground">
															Mín: {item.minStock} {item.baseUnit}
														</p>
													</div>
												{/if}
											</td>

											<td class="px-4 py-4 align-middle whitespace-nowrap">
												{#if item.type === 'raw_material'}
													{#if isEditing}
														<div class="flex items-center gap-1.5">
															<span class="text-xs text-muted-foreground">$</span>
															<Input
																form="inv-form-{item.id}"
																name="referenceCost"
																type="number"
																step="any"
																min="0"
																value={item.referenceCost}
																aria-label="Costo de referencia de {item.name}"
																class="h-8 w-24 font-mono text-xs"
															/>
															<span class="text-xs text-muted-foreground">por</span>
															<Input
																form="inv-form-{item.id}"
																name="purchaseQuantity"
																type="number"
																step="any"
																min="0.001"
																value={item.purchaseQuantity}
																aria-label="Cantidad de compra de {item.name}"
																class="h-8 w-16 font-mono text-xs"
															/>
															<span class="text-xs text-muted-foreground">{item.baseUnit}</span>
														</div>
													{:else}
														<div class="space-y-0.5">
															<p class="font-mono text-xs font-semibold text-foreground">
																{formatCurrency(item.referenceCost)}
																<span class="font-sans font-normal text-muted-foreground">
																	por {item.purchaseQuantity} {item.baseUnit}
																</span>
															</p>
															{#if item.purchaseQuantity !== 1}
																<p class="font-mono text-[11px] text-muted-foreground">
																	({formatCurrency(getDirectUnitCost(item))} / {item.baseUnit})
																</p>
															{/if}
														</div>
													{/if}
												{:else if recipeSummary && recipeSummary.directComponentsCount > 0}
													<div class="space-y-0.5">
														<p class="font-mono text-xs font-semibold text-foreground">
															{formatCurrency(recipeSummary.estimatedUnitCost)} / {item.baseUnit}
														</p>
														<p class="text-[11px] text-muted-foreground">
															Calculado por Receta ({recipeSummary.directComponentsCount} ingr. · rinde {item.yieldQuantity} {item.baseUnit})
														</p>
													</div>
												{:else}
													<button
														type="button"
														onclick={() => selectCatalogItem(item.id)}
														class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
													>
														<span>Armar Receta →</span>
													</button>
												{/if}
											</td>

											<td class="py-4 pr-5 pl-4 text-right align-middle whitespace-nowrap">
												{#if isEditing}
													<div class="inline-flex items-center justify-end gap-1.5">
														<Button
															form="inv-form-{item.id}"
															type="submit"
															size="sm"
															class="h-8 px-2.5 text-xs"
															title="Guardar cambios"
														>
															<Check class="size-3.5" />
															<span>Guardar</span>
														</Button>
														<Button
															type="button"
															size="icon"
															variant="ghost"
															class="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
															title="Eliminar ítem"
															onclick={() => (deletingItemId = item.id)}
														>
															<Trash2 class="size-4" />
														</Button>
														<Button
															type="button"
															size="icon"
															variant="ghost"
															class="size-8 text-muted-foreground hover:text-foreground"
															title="Cancelar edición"
															onclick={() => (editingItemId = null)}
														>
															<X class="size-4" />
														</Button>
													</div>
												{:else}
													<div class="inline-flex items-center justify-end gap-1">
														{#if item.type !== 'raw_material'}
															<Button
																type="button"
																size="sm"
																variant="ghost"
																class="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-primary"
																title="Ver receta"
																onclick={() => (viewingRecipeItemId = item.id)}
															>
																<BookOpen class="size-3.5" />
																<span>Receta</span>
															</Button>
														{/if}
														<Button
															type="button"
															size="icon"
															variant="ghost"
															class="size-8 text-muted-foreground hover:text-foreground"
															title="Editar fila"
															onclick={() => startEditing(item)}
														>
															<Pencil class="size-4" />
														</Button>
													</div>
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						<TablePagination
							bind:currentPage
							bind:pageSize
							totalItems={filteredItems.length}
							itemLabel="ítems"
						/>
					</div>
				{:else}
					<div class="rounded-xl border border-dashed border-border p-12 text-center">
						<Package class="mx-auto size-10 text-muted-foreground/60" />
						<p class="mt-3 text-base font-medium text-foreground">
							No hay ítems que coincidan con la búsqueda
						</p>
						<p class="mt-1 text-sm text-muted-foreground">
							Registra insumos, bases o productos con código autogenerado desde el modal de alta.
						</p>
						<Button class="mt-4" onclick={() => (showNewItemModal = true)}>
							<Plus class="size-4" />
							<span>Dar de Alta Nuevo Ítem</span>
						</Button>
					</div>
				{/if}
			</CardContent>
		</Card>
	{/if}

	<!-- ========================================================================
	     VISTA 2: ESTRUCTURA DE RECETAS (MULTINIVEL)
	     ======================================================================== -->
	{#if currentTab === 'recipes'}
		<div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
			<!-- Columna Izquierda: Catálogo de Ítems -->
			<div class="space-y-6 lg:col-span-4">
				<Card>
					<CardHeader class="space-y-4 p-6 pb-5">
						<div class="space-y-1.5">
							<div class="flex items-center justify-between">
								<CardTitle class="text-lg">Catálogo de Recetas</CardTitle>
								<Badge variant="secondary" class="px-2.5 py-0.5">
									{filteredRecipeCatalog.length} ítems
								</Badge>
							</div>
							<CardDescription>
								Selecciona un ítem para ver o armar su Estructura de Receta
							</CardDescription>
						</div>

						<div class="relative">
							<Search class="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
							<Input
								type="search"
								placeholder="Buscar por código o nombre..."
								bind:value={recipeSearchQuery}
								class="h-10 pl-9"
							/>
						</div>

						<div class="flex flex-wrap gap-2">
							<Button
								size="sm"
								variant={recipeFilterType === 'all' ? 'default' : 'outline'}
								class="h-8 px-3 text-xs"
								onclick={() => (recipeFilterType = 'all')}
							>
								Todos
							</Button>
							<Button
								size="sm"
								variant={recipeFilterType === 'finished_product' ? 'default' : 'outline'}
								class="h-8 gap-1.5 px-3 text-xs"
								onclick={() => (recipeFilterType = 'finished_product')}
							>
								<CakeSlice class="size-3.5" />
								<span>Productos</span>
							</Button>
							<Button
								size="sm"
								variant={recipeFilterType === 'sub_assembly' ? 'default' : 'outline'}
								class="h-8 gap-1.5 px-3 text-xs"
								onclick={() => (recipeFilterType = 'sub_assembly')}
							>
								<ChefHat class="size-3.5" />
								<span>Sub-ensambles</span>
							</Button>
							<Button
								size="sm"
								variant={recipeFilterType === 'raw_material' ? 'default' : 'outline'}
								class="h-8 gap-1.5 px-3 text-xs"
								onclick={() => (recipeFilterType = 'raw_material')}
							>
								<Wheat class="size-3.5" />
								<span>Insumos</span>
							</Button>
						</div>
					</CardHeader>

					<CardContent class="space-y-4 p-6 pt-0">
						<div class="space-y-3.5">
							{#each paginatedCatalogItems as item (item.id)}
								{@const summary = data.recipeSummaries[item.id]}
								{@const isSelected = selectedRoot?.id === item.id}
								<a
									href="/inventory?tab=recipes&item={item.id}"
									onclick={(e) => {
										e.preventDefault();
										selectCatalogItem(item.id);
									}}
									class="block rounded-xl border p-4 transition-all {isSelected
										? 'border-primary bg-primary/5 ring-1 ring-primary'
										: 'border-border hover:border-primary/40 hover:bg-muted/40'}"
								>
									<div class="flex items-start justify-between gap-3">
										<div class="min-w-0 space-y-2">
											<div class="flex flex-wrap items-center gap-2">
												<span class="rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold">
													{item.code}
												</span>
												<ItemTypeBadge type={item.type} short={true} />
											</div>
											<p class="text-sm leading-snug font-medium text-foreground">
												{item.name}
											</p>
										</div>

										<div class="shrink-0 space-y-0.5 text-right">
											<span class="font-mono text-sm font-semibold text-foreground">
												{formatCurrency(summary?.estimatedTotalCost ?? item.referenceCost)}
											</span>
											<span class="block text-xs text-muted-foreground">
												{#if (summary?.directComponentsCount ?? 0) > 0}
													por {item.yieldQuantity} {item.baseUnit}
												{:else}
													por {item.purchaseQuantity} {item.baseUnit}
												{/if}
											</span>
										</div>
									</div>

									<div class="mt-3.5 flex items-center justify-between border-t border-border/50 pt-2.5 text-xs text-muted-foreground">
										<span>Unidad base: <strong class="text-foreground">{item.baseUnit}</strong></span>
										{#if (summary?.directComponentsCount ?? 0) > 0}
											<span class="inline-flex items-center gap-1.5 font-medium text-primary">
												<Layers class="size-3.5" />
												{summary.directComponentsCount} ingr. directos
											</span>
										{:else}
											<span>Insumo directo</span>
										{/if}
									</div>
								</a>
							{:else}
								<div class="space-y-3 py-10 text-center">
									<p class="text-sm text-muted-foreground">
										Todavía no hay ítems cargados.
									</p>
									<Button size="sm" variant="outline" onclick={() => (showNewItemModal = true)}>
										<Plus class="size-4" />
										<span>Crear primer ítem</span>
									</Button>
								</div>
							{/each}
						</div>

						<TablePagination
							bind:currentPage={catalogPage}
							bind:pageSize={catalogPageSize}
							totalItems={filteredRecipeCatalog.length}
							itemLabel="ítems"
							compact={true}
						/>
					</CardContent>
				</Card>
			</div>

			<!-- Columna Derecha: Constructor y Estructura de Receta Multinivel -->
			<div class="space-y-8 lg:col-span-8">
				{#if selectedTree && selectedRoot}
					{@const tree = selectedTree}
					{@const paginatedRecipeNodes = tree.nodes.slice(
						(recipeTablePage - 1) * recipeTablePageSize,
						recipeTablePage * recipeTablePageSize
					)}
					<Card>
						<CardHeader class="border-b border-border/60 p-6 sm:p-8">
							<div class="flex flex-wrap items-start justify-between gap-6">
								<div class="space-y-2.5">
									<div class="flex items-center gap-2.5">
										<span class="rounded-md bg-muted px-2.5 py-1 font-mono text-xs font-bold">
											{selectedRoot.code}
										</span>
										<ItemTypeBadge type={selectedRoot.type} />
									</div>
									<CardTitle class="text-2xl leading-tight">{selectedRoot.name}</CardTitle>
									{#if selectedRoot.notes}
										<CardDescription class="text-sm">{selectedRoot.notes}</CardDescription>
									{/if}
								</div>

								<div class="flex flex-wrap items-center gap-3">
									{#if selectedRoot.type !== 'raw_material'}
										<form
											method="POST"
											action="?/updateRecipeYield"
											use:enhance
											class="flex flex-col justify-center rounded-xl border border-border bg-muted/20 px-3.5 py-2 shadow-2xs"
										>
											<input type="hidden" name="businessId" value={data.activeBusiness.id} />
											<input type="hidden" name="id" value={selectedRoot.id} />
											<Label for="quick-recipe-yield" class="text-[11px] font-medium text-muted-foreground">
												Rendimiento de la Receta
											</Label>
											<div class="mt-1 flex items-center gap-1.5">
												<Input
													id="quick-recipe-yield"
													name="yieldQuantity"
													type="number"
													step="any"
													min="0.001"
													value={selectedRoot.yieldQuantity}
													class="h-8 w-24 text-right font-mono text-sm font-semibold"
													required
												/>
												<span class="text-xs font-semibold text-foreground">{selectedRoot.baseUnit}</span>
												<Button type="submit" size="sm" variant="secondary" class="h-8 px-2.5 text-xs">
													Guardar
												</Button>
											</div>
										</form>
									{/if}

									<div class="space-y-1 rounded-xl border border-border bg-muted/30 px-5 py-3.5 text-right">
										<div class="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
											<Calculator class="size-3.5" />
											<span>
												{tree.nodes.length > 0
													? `Costo Receta (Rinde ${selectedRoot.yieldQuantity} ${selectedRoot.baseUnit})`
													: `Costo Ref. (${selectedRoot.purchaseQuantity} ${selectedRoot.baseUnit})`}
											</span>
										</div>
										<p class="font-mono text-xl font-bold text-foreground">
											{formatCurrency(tree.estimatedTotalCost)}
										</p>
										<p class="font-mono text-xs text-muted-foreground">
											Unitario: {formatCurrency(tree.estimatedUnitCost)} / {selectedRoot.baseUnit}
										</p>
									</div>

									<Button
										variant="outline"
										size="icon"
										class="size-10"
										title="Editar parámetros del ítem"
										onclick={() => (showEditItemModal = true)}
									>
										<Settings2 class="size-4" />
									</Button>
								</div>
							</div>
						</CardHeader>

						<CardContent class="space-y-6 p-6 sm:p-8">
							<div class="flex flex-wrap items-center justify-between gap-4">
								<div>
									<h4 class="text-base font-semibold text-foreground">
										Estructura de la Receta (Ingredientes y Sub-recetas)
									</h4>
									<p class="text-xs text-muted-foreground">
										Ingredientes para producir {selectedRoot.yieldQuantity} {selectedRoot.baseUnit} de "{selectedRoot.name}"
									</p>
								</div>

								{#if selectedRoot.type !== 'raw_material'}
									<Button
										type="button"
										size="sm"
										disabled={availableComponentsForSelected.length === 0}
										onclick={() => (showAddRecipeLineModal = true)}
									>
										<Plus class="size-4" />
										<span>Agregar Ingrediente / Base a la Receta</span>
									</Button>
								{/if}
							</div>

							{#if tree.nodes.length > 0}
								<div class="space-y-4">
									<div class="overflow-x-auto rounded-xl border border-border">
										<table class="w-full text-left text-sm">
											<thead class="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
												<tr>
													<th class="py-3.5 pr-4 pl-5 font-semibold">Ingrediente / Sub-receta</th>
													<th class="px-4 py-3.5 font-semibold">Tipo</th>
													<th class="px-4 py-3.5 text-right font-semibold">Cantidad</th>
													<th class="px-4 py-3.5 text-right font-semibold">Costo Unit. Ref.</th>
													<th class="px-4 py-3.5 text-right font-semibold">Subtotal Est.</th>
													<th class="py-3.5 pr-5 pl-3 text-right font-semibold">Acción</th>
												</tr>
											</thead>
											<tbody>
												{#each paginatedRecipeNodes as node (node.lineId)}
													<RecipeTreeRow
														{node}
														businessId={data.activeBusiness.id}
														isDirectChild={true}
														onSelectItem={selectCatalogItem}
													/>
												{/each}
											</tbody>
											<tfoot class="border-t-2 border-border bg-muted/30 font-medium">
												<tr>
													<td colspan="4" class="py-4 pr-4 pl-5 text-right text-sm">
														Costo Total Estimado de la Receta (para {selectedRoot.yieldQuantity}
														{selectedRoot.baseUnit}):
													</td>
													<td class="px-4 py-4 text-right font-mono text-base font-bold text-foreground">
														{formatCurrency(tree.estimatedTotalCost)}
													</td>
													<td></td>
												</tr>
											</tfoot>
										</table>
									</div>

									<TablePagination
										bind:currentPage={recipeTablePage}
										bind:pageSize={recipeTablePageSize}
										pageSizeOptions={[5, 8, 15, 30]}
										totalItems={tree.nodes.length}
										itemLabel="ingredientes directos"
									/>
								</div>
							{:else}
								<div class="rounded-xl border border-dashed border-border p-10 text-center">
									<Layers class="mx-auto size-9 text-muted-foreground/60" />
									<p class="mt-3 text-base font-medium text-foreground">
										Este ítem aún no tiene ingredientes cargados en su receta
									</p>
									<p class="mx-auto mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground">
										{#if selectedRoot.type === 'raw_material'}
											Es una materia prima directa; su costo se toma de su precio de compra ({formatCurrency(
												selectedRoot.referenceCost
											)} por {selectedRoot.purchaseQuantity} {selectedRoot.baseUnit}).
										{:else}
											Haz clic en el botón para añadir las materias primas o sub-ensambles que componen esta receta.
										{/if}
									</p>
									{#if selectedRoot.type !== 'raw_material' && availableComponentsForSelected.length > 0}
										<Button
											class="mt-5"
											size="sm"
											onclick={() => (showAddRecipeLineModal = true)}
										>
											<Plus class="size-4" />
											<span>Agregar primer ingrediente a la Receta</span>
										</Button>
									{/if}
								</div>
							{/if}
						</CardContent>
					</Card>
				{/if}
			</div>
		</div>
	{/if}

	<!-- ========================================================================
	     VISTA 3: PRODUCTOS PARA VENTA (CATÁLOGO COMERCIAL PARA ÓRDENES)
	     ======================================================================== -->
	{#if currentTab === 'products'}
		<Card>
			<CardHeader class="space-y-4 p-6 sm:p-8 sm:pb-4">
				<div class="flex flex-wrap items-center justify-between gap-4">
					<div class="space-y-1">
						<CardTitle class="flex items-center gap-2 text-lg">
							<Tag class="size-5 text-primary" />
							Catálogo de Productos para Venta
						</CardTitle>
						<CardDescription>
							Cada producto comercial tiene asociado uno o varios Productos Finales de tu inventario/recetas para que el módulo de Órdenes opere de forma independiente y descuente stock o ejecute producción Just-In-Time.
						</CardDescription>
					</div>

					<div class="flex flex-wrap items-center gap-3">
						<div class="relative w-64">
							<Search class="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
							<Input
								type="search"
								placeholder="Buscar producto de venta..."
								bind:value={salesProductSearch}
								class="h-10 pl-9"
							/>
						</div>
						<Button href="/inventory/products/new" class="gap-1.5 font-semibold shadow-xs">
							<Plus class="size-4" />
							<span>Nuevo Producto para Venta</span>
						</Button>
					</div>
				</div>
			</CardHeader>

			<CardContent class="p-6 pt-2 sm:p-8 sm:pt-4">
				{#if filteredSalesProducts.length > 0}
					<div class="space-y-4">
						<div class="overflow-x-auto rounded-xl border border-border">
							<table class="w-full text-left text-sm">
								<thead class="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
									<tr>
										<th class="py-3.5 pr-4 pl-5 font-semibold">Código / Producto Comercial</th>
										<th class="px-4 py-3.5 font-semibold">Productos Finales Asociados (Recetas)</th>
										<th class="px-4 py-3.5 text-right font-semibold">Costo Receta Est.</th>
										<th class="px-4 py-3.5 text-right font-semibold">Precio de Venta</th>
										<th class="px-4 py-3.5 text-right font-semibold">Margen Est.</th>
										<th class="py-3.5 pr-5 pl-4 text-right font-semibold">Acciones</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-border/60">
									{#each paginatedSalesProducts as sp (sp.id)}
										{@const margin = sp.salePrice - sp.estimatedRecipeCost}
										{@const marginPct =
											sp.salePrice > 0 ? Math.round((margin / sp.salePrice) * 100) : 0}
										<tr class="transition-colors hover:bg-muted/20">
											<td class="py-4 pr-4 pl-5 align-middle">
												<div class="flex flex-wrap items-center gap-2">
													<span class="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
														{sp.code}
													</span>
													<span class="font-semibold text-foreground">{sp.name}</span>
													{#if sp.isShortcut}
														<Badge variant="outline" class="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 text-[10px]">
															<Star class="size-2.5 fill-amber-500 text-amber-500" />
															Atajo Rápido
														</Badge>
													{/if}
													{#if sp.isCombo}
														<Badge variant="secondary" class="text-[10px]">
															Combo ({sp.components.length})
														</Badge>
													{/if}
													{#if !sp.isActive}
														<Badge variant="outline" class="text-[10px]">Pausado</Badge>
													{/if}
												</div>
												{#if sp.description}
													<p class="mt-1 text-xs text-muted-foreground">{sp.description}</p>
												{/if}
											</td>

											<td class="px-4 py-4 align-middle">
												{#if sp.components.length > 0}
													<div class="flex flex-col gap-1.5">
														{#each sp.components as comp (comp.id)}
															{#if comp.item}
																<div class="flex flex-wrap items-center gap-2">
																	<span class="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-mono text-xs font-medium">
																		<Link2 class="size-3 text-muted-foreground" />
																		{comp.item.code}
																	</span>
																	<button
																		type="button"
																		onclick={() => selectCatalogItem(comp.item!.id)}
																		class="text-xs font-medium text-foreground hover:text-primary hover:underline"
																	>
																		{comp.item.name}
																	</button>
																	<ItemTypeBadge type={comp.item.type} short={true} />
																	<span class="font-mono text-xs text-muted-foreground">
																		× {comp.quantity} {comp.item.baseUnit} (Stock: {comp.item.currentStock} {comp.item.baseUnit})
																	</span>
																</div>
															{:else}
																<span class="text-xs text-destructive">Ítem eliminado</span>
															{/if}
														{/each}
													</div>
												{:else}
													<span class="text-xs text-destructive">Sin productos asociados</span>
												{/if}
											</td>

											<td class="px-4 py-4 text-right align-middle font-mono text-xs text-muted-foreground">
												{formatCurrency(sp.estimatedRecipeCost)}
											</td>

											<td class="px-4 py-4 text-right align-middle">
												<span class="font-mono text-sm font-bold text-foreground block">
													{formatCurrency(sp.salePrice)}
												</span>
												{#if sp.pricingTiers && sp.pricingTiers.length > 0}
													<div class="mt-1 flex flex-wrap justify-end gap-1">
														{#each sp.pricingTiers as tier}
															<span class="rounded bg-sky-500/10 px-1.5 py-0.2 text-[10px] font-mono font-medium text-sky-700" title="Escala por cantidad">
																≥{tier.minQuantity}u: {tier.type === 'percentage' ? `-${tier.value}%` : formatCurrency(tier.value)}
															</span>
														{/each}
													</div>
												{/if}
											</td>

											<td class="px-4 py-4 text-right align-middle font-mono text-xs">
												<span class={margin >= 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-destructive'}>
													{formatCurrency(margin)} ({marginPct}%)
												</span>
											</td>

											<td class="py-4 pr-5 pl-4 text-right align-middle whitespace-nowrap">
												<div class="inline-flex items-center justify-end gap-1">
													<form method="POST" action="?/toggleSalesProductShortcut" use:enhance class="inline">
														<input type="hidden" name="businessId" value={data.activeBusiness.id} />
														<input type="hidden" name="id" value={sp.id} />
														<button
															type="submit"
															class="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted {sp.isShortcut ? 'text-amber-500' : 'text-muted-foreground/40 hover:text-muted-foreground'}"
															title={sp.isShortcut ? 'Quitar de atajos rápidos' : 'Marcar como atajo rápido en ventas'}
														>
															<Star class="size-4 {sp.isShortcut ? 'fill-amber-500' : ''}" />
														</button>
													</form>
													<Button
														href="/inventory/products/{sp.id}/edit"
														size="icon"
														variant="ghost"
														class="size-8 text-muted-foreground hover:text-foreground"
														title="Editar producto de venta (Pantalla Completa)"
													>
														<Pencil class="size-4" />
													</Button>
													<Button
														type="button"
														size="icon"
														variant="ghost"
														class="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
														title="Eliminar producto de venta"
														onclick={() => (deletingSalesProduct = sp)}
													>
														<Trash2 class="size-4" />
													</Button>
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						<TablePagination
							bind:currentPage={salesProductPage}
							bind:pageSize={salesProductPageSize}
							totalItems={filteredSalesProducts.length}
							itemLabel="productos de venta"
						/>
					</div>
				{:else}
					<div class="rounded-xl border border-dashed border-border p-12 text-center">
						<Tag class="mx-auto size-10 text-muted-foreground/60" />
						<p class="mt-3 text-base font-medium text-foreground">
							Aún no tienes Productos para Venta configurados
						</p>
						<p class="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
							Crea tus productos comerciales o combos vinculándolos con los Productos Finales de tu inventario/recetas para poder tomar órdenes y ventas.
						</p>
						<Button class="mt-4" href="/inventory/products/new">
							<Plus class="size-4" />
							<span>Crear Primer Producto para Venta</span>
						</Button>
					</div>
				{/if}
			</CardContent>
		</Card>
	{/if}

	<!-- ========================================================================
	     MODAL COMPARTIDO: Alta de Nuevo Ítem en Inventario / Recetas
	     ======================================================================== -->
	{#if showNewItemModal}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
			role="dialog"
			aria-modal="true"
			aria-labelledby="inv-new-item-title"
		>
			<div class="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
				<div class="flex items-start justify-between gap-4 border-b border-border p-6">
					<div class="space-y-1">
						<div class="flex items-center gap-2">
							<Badge variant="secondary" class="font-mono text-xs">
								SKU autogenerado: {nextAutoCode}
							</Badge>
							<ItemTypeBadge type={newItemType} short={true} />
						</div>
						<h2 id="inv-new-item-title" class="text-xl font-bold text-foreground">
							Registrar Nuevo Ítem en Inventario / Recetas
						</h2>
					</div>
					<Button
						type="button"
						size="icon"
						variant="ghost"
						class="size-8 text-muted-foreground hover:text-foreground"
						onclick={() => (showNewItemModal = false)}
					>
						<X class="size-4" />
					</Button>
				</div>

				<form
					method="POST"
					action="?/createItem"
					use:enhance={() => {
						return async ({ result, update }) => {
							await update();
							if (result.type === 'success') {
								showNewItemModal = false;
								const createdId = (result.data as { createdItemId?: string } | undefined)
									?.createdItemId;
								if (createdId && currentTab === 'recipes') {
									selectCatalogItem(createdId);
								}
							}
						};
					}}
				>
					<div class="max-h-[70vh] space-y-5 overflow-y-auto p-6">
						<input type="hidden" name="businessId" value={data.activeBusiness.id} />

						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div class="space-y-2 sm:col-span-2">
								<Label for="inv-new-name">Nombre del Ítem</Label>
								<Input
									id="inv-new-name"
									name="name"
									class="h-10"
									placeholder="Ej. Chocolate Cobertura 70% o Combo Cumpleaños"
									required
								/>
							</div>

							<div class="space-y-2">
								<Label for="inv-new-type">Categoría / Tipo</Label>
								<select
									id="inv-new-type"
									name="type"
									bind:value={newItemType}
									class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
								>
									{#each ITEM_TYPES as t}
										<option value={t}>{ITEM_TYPE_LABELS[t]}</option>
									{/each}
								</select>
							</div>

							<div class="space-y-2">
								<Label for="inv-new-baseUnit">Unidad de Medida</Label>
								<select
									id="inv-new-baseUnit"
									name="baseUnit"
									bind:value={newItemBaseUnit}
									class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
								>
									{#each UNITS_OF_MEASURE as u}
										<option value={u}>{UNIT_LABELS[u]}</option>
									{/each}
								</select>
							</div>

							<div class="space-y-2">
								<Label for="inv-new-currentStock">Stock Inicial ({newItemBaseUnit})</Label>
								<Input
									id="inv-new-currentStock"
									name="currentStock"
									type="number"
									step="any"
									min="0"
									value="0"
									class="h-10"
									required
								/>
							</div>

							{#if newItemType === 'raw_material'}
								<div class="space-y-2">
									<Label for="inv-new-referenceCost">Costo Compra ($)</Label>
									<Input
										id="inv-new-referenceCost"
										name="referenceCost"
										type="number"
										step="any"
										min="0"
										value="0"
										class="h-10"
									/>
								</div>

								<div class="space-y-2">
									<Label for="inv-new-purchaseQty">Cant. Envase Compra ({newItemBaseUnit})</Label>
									<Input
										id="inv-new-purchaseQty"
										name="purchaseQuantity"
										type="number"
										step="any"
										min="0.001"
										value="1"
										class="h-10"
									/>
								</div>
								<input type="hidden" name="yieldQuantity" value="1" />
							{:else}
								<div class="space-y-1.5 sm:col-span-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
									<p class="font-medium text-foreground">
										Este {newItemType === 'sub_assembly' ? 'sub-ensamble' : 'producto'} calculará su costo y rendimiento en la pestaña <strong class="text-primary">Estructura de Recetas</strong>.
									</p>
									<p class="mt-0.5">Podrás configurar cuánto rinde la receta y cargar sus ingredientes una vez creado el ítem.</p>
								</div>
								<input type="hidden" name="yieldQuantity" value="1" />
								<input type="hidden" name="referenceCost" value="0" />
								<input type="hidden" name="purchaseQuantity" value="1" />
							{/if}

							<div class="space-y-1.5 sm:col-span-2">
								<div class="flex items-center justify-between">
									<Label for="inv-new-min-stock">Punto de Alerta (Stock Mínimo)</Label>
									<span class="text-xs text-muted-foreground font-mono">Unidad: {newItemBaseUnit}</span>
								</div>
								<div class="flex items-center gap-2">
									<Input
										id="inv-new-min-stock"
										name="minStock"
										type="number"
										step="any"
										min="0"
										bind:value={newItemMinStock}
										class="h-10 font-mono text-sm"
										placeholder="0"
									/>
									<span class="rounded-md border border-input bg-muted px-3 py-2 font-mono text-sm text-muted-foreground">
										{newItemBaseUnit}
									</span>
								</div>
								<p class="text-[11px] text-muted-foreground">
									El sistema te avisará cuando las existencias estén en o por debajo de esta cantidad.
								</p>
							</div>

							<div class="space-y-2 sm:col-span-2">
								<Label for="inv-new-notes">Notas (opcional)</Label>
								<Input
									id="inv-new-notes"
									name="notes"
									class="h-10"
									placeholder="Marca, proveedor o detalle de preparación"
								/>
							</div>
						</div>
					</div>

					<div class="flex items-center justify-end gap-3 border-t border-border bg-muted/20 px-6 py-4">
						<Button type="button" variant="outline" onclick={() => (showNewItemModal = false)}>
							Cancelar
						</Button>
						<Button type="submit">
							<Plus class="size-4" />
							<span>Guardar en Inventario</span>
						</Button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- ========================================================================
	     MODAL RECETAS: Agregar Ingrediente / Sub-ensamble a la Receta
	     ======================================================================== -->
	{#if showAddRecipeLineModal && selectedRoot}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
			role="dialog"
			aria-modal="true"
			aria-labelledby="add-recipe-modal-title"
		>
			<div class="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
				<div class="flex items-start justify-between gap-4 border-b border-border p-6">
					<div class="space-y-1">
						<div class="flex items-center gap-2">
							<span class="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold">
								{selectedRoot.code}
							</span>
							<ItemTypeBadge type={selectedRoot.type} short={true} />
						</div>
						<h2 id="add-recipe-modal-title" class="text-lg font-bold text-foreground">
							Agregar Ingrediente a "{selectedRoot.name}"
						</h2>
						<p class="text-xs text-muted-foreground">
							Cantidad expresada para un lote de {selectedRoot.yieldQuantity} {selectedRoot.baseUnit}
						</p>
					</div>
					<Button
						type="button"
						size="icon"
						variant="ghost"
						class="size-8 text-muted-foreground hover:text-foreground"
						onclick={() => (showAddRecipeLineModal = false)}
					>
						<X class="size-4" />
					</Button>
				</div>

				<form
					method="POST"
					action="?/addRecipeLine"
					use:enhance={() => {
						return async ({ result, update }) => {
							await update();
							if (result.type === 'success') {
								showAddRecipeLineModal = false;
							}
						};
					}}
				>
					<div class="space-y-4 p-6">
						<input type="hidden" name="businessId" value={data.activeBusiness.id} />
						<input type="hidden" name="parentItemId" value={selectedRoot.id} />

						<div class="space-y-2">
							<Label for="recipe-componentItemId">Ingrediente / Componente (Materia Prima, Sub-ensamble o Producto)</Label>
							<select
								id="recipe-componentItemId"
								name="componentItemId"
								bind:value={selectedComponentId}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
								required
							>
								{#each availableComponentsForSelected as candidate (candidate.id)}
									<option value={candidate.id}>
										[{candidate.code}] {candidate.name} ({ITEM_TYPE_LABELS[candidate.type]})
									</option>
								{/each}
							</select>
						</div>

						<div class="grid grid-cols-2 gap-4">
							<div class="space-y-2">
								<Label for="recipe-quantity">Cantidad Requerida</Label>
								<Input
									id="recipe-quantity"
									name="quantity"
									type="number"
									step="any"
									min="0.001"
									class="h-10"
									placeholder="Ej. 250"
									required
								/>
							</div>

							<div class="space-y-2">
								<Label for="recipe-unit">Unidad</Label>
								<select
									id="recipe-unit"
									name="unit"
									bind:value={selectedRecipeUnit}
									class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
								>
									{#each compatibleUnits as u}
										<option value={u}>{u}</option>
									{/each}
								</select>
							</div>
						</div>

						<div class="space-y-2">
							<Label for="recipe-notes">Nota / Etapa de preparación (opcional)</Label>
							<Input
								id="recipe-notes"
								name="notes"
								class="h-10"
								placeholder="Ej. Tamizada, para el relleno o cobertura"
							/>
						</div>
					</div>

					<div class="flex items-center justify-end gap-3 border-t border-border bg-muted/20 px-6 py-4">
						<Button type="button" variant="outline" onclick={() => (showAddRecipeLineModal = false)}>
							Cancelar
						</Button>
						<Button type="submit">
							<Plus class="size-4" />
							<span>Añadir a la Receta</span>
						</Button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- ========================================================================
	     MODAL RECETAS: Editar Ficha Técnica del Ítem Seleccionado
	     ======================================================================== -->
	{#if showEditItemModal && selectedRoot}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
			role="dialog"
			aria-modal="true"
			aria-labelledby="edit-item-modal-title"
		>
			<div class="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
				<div class="flex items-start justify-between gap-4 border-b border-border p-6">
					<div class="space-y-1">
						<div class="flex items-center gap-2">
							<span class="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold">
								{selectedRoot.code}
							</span>
							<ItemTypeBadge type={selectedRoot.type} short={true} />
						</div>
						<h2 id="edit-item-modal-title" class="text-lg font-bold text-foreground">
							Editar "{selectedRoot.name}"
						</h2>
					</div>
					<Button
						type="button"
						size="icon"
						variant="ghost"
						class="size-8 text-muted-foreground hover:text-foreground"
						onclick={() => (showEditItemModal = false)}
					>
						<X class="size-4" />
					</Button>
				</div>

				<form
					method="POST"
					action="?/updateItem"
					use:enhance={() => {
						return async ({ result, update }) => {
							await update();
							if (result.type === 'success') {
								showEditItemModal = false;
							}
						};
					}}
				>
					<div class="space-y-4 p-6">
						<input type="hidden" name="businessId" value={data.activeBusiness.id} />
						<input type="hidden" name="id" value={selectedRoot.id} />

						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div class="space-y-2 sm:col-span-2">
								<Label for="edit-name">Nombre</Label>
								<Input id="edit-name" name="name" class="h-10" value={selectedRoot.name} required />
							</div>

							<div class="space-y-2">
								<Label for="edit-type">Tipo</Label>
								<select
									id="edit-type"
									name="type"
									value={selectedRoot.type}
									class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
								>
									{#each ITEM_TYPES as t}
										<option value={t}>{ITEM_TYPE_LABELS[t]}</option>
									{/each}
								</select>
							</div>

							<div class="space-y-2">
								<Label for="edit-baseUnit">Unidad Base</Label>
								<select
									id="edit-baseUnit"
									name="baseUnit"
									value={selectedRoot.baseUnit}
									class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
								>
									{#each UNITS_OF_MEASURE as u}
										<option value={u}>{UNIT_LABELS[u]}</option>
									{/each}
								</select>
							</div>

							{#if selectedRoot.type === 'raw_material'}
								<div class="space-y-2">
									<Label for="edit-purchaseQuantity">Cant. Compra ({selectedRoot.baseUnit})</Label>
									<Input
										id="edit-purchaseQuantity"
										name="purchaseQuantity"
										type="number"
										step="any"
										min="0.001"
										class="h-10"
										value={selectedRoot.purchaseQuantity}
										required
									/>
								</div>
								<div class="space-y-2">
									<Label for="edit-referenceCost">Costo Compra ($)</Label>
									<Input
										id="edit-referenceCost"
										name="referenceCost"
										type="number"
										step="any"
										min="0"
										class="h-10"
										value={selectedRoot.referenceCost}
										required
									/>
								</div>
								<input type="hidden" name="yieldQuantity" value={selectedRoot.yieldQuantity} />
							{:else}
								<div class="space-y-2 sm:col-span-2">
									<Label for="edit-yieldQuantity">
										Rendimiento de la Receta ({selectedRoot.baseUnit})
									</Label>
									<Input
										id="edit-yieldQuantity"
										name="yieldQuantity"
										type="number"
										step="any"
										min="0.001"
										class="h-10"
										value={selectedRoot.yieldQuantity}
										required
									/>
								</div>
								<input type="hidden" name="purchaseQuantity" value={selectedRoot.purchaseQuantity} />
								<input type="hidden" name="referenceCost" value={selectedRoot.referenceCost} />
							{/if}

							<div class="space-y-2 sm:col-span-2">
								<Label for="edit-notes">Notas</Label>
								<Input id="edit-notes" name="notes" class="h-10" value={selectedRoot.notes ?? ''} />
							</div>
						</div>
					</div>

					<div class="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-4">
						<Button
							type="button"
							variant="destructive"
							size="sm"
							onclick={() => {
								showEditItemModal = false;
								showDeleteRecipeItemModal = true;
							}}
						>
							<Trash2 class="size-4" />
							<span>Eliminar Ítem</span>
						</Button>
						<div class="flex gap-2.5">
							<Button type="button" variant="outline" size="sm" onclick={() => (showEditItemModal = false)}>
								Cancelar
							</Button>
							<Button type="submit" size="sm">Guardar Cambios</Button>
						</div>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- ========================================================================
	     MODAL PRODUCTOS PARA VENTA: Alta de Producto Comercial
	     ======================================================================== -->
	{#if showNewSalesProductModal}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
			role="dialog"
			aria-modal="true"
			aria-labelledby="new-sales-product-title"
		>
			<div class="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
				<div class="flex items-start justify-between gap-4 border-b border-border p-6">
					<div class="space-y-1">
						<Badge variant="secondary" class="font-mono text-xs">
							Código Comercial: {nextSalesProductCode}
						</Badge>
						<h2 id="new-sales-product-title" class="text-xl font-bold text-foreground">
							Nuevo Producto para Venta
						</h2>
						<p class="text-xs text-muted-foreground">
							Vincula uno o varios Productos Finales de tu inventario/recetas para habilitarlo en el módulo de Órdenes.
						</p>
					</div>
					<Button
						type="button"
						size="icon"
						variant="ghost"
						class="size-8 text-muted-foreground hover:text-foreground"
						onclick={() => (showNewSalesProductModal = false)}
					>
						<X class="size-4" />
					</Button>
				</div>

				{#if linkableItems.length === 0}
					<div class="space-y-4 p-8 text-center">
						<CakeSlice class="mx-auto size-10 text-muted-foreground" />
						<p class="text-base font-semibold text-foreground">
							No tienes ítems registrados en Inventario
						</p>
						<p class="mx-auto max-w-md text-sm text-muted-foreground">
							Para crear un producto de venta necesitas al menos un ítem registrado en el inventario (materia prima, sub-ensamble o producto final).
						</p>
						<div class="flex justify-center gap-3 pt-2">
							<Button variant="outline" onclick={() => (showNewSalesProductModal = false)}>
								Cancelar
							</Button>
							<Button
								type="button"
								onclick={() => {
									showNewSalesProductModal = false;
									showNewItemModal = true;
								}}
							>
								<Plus class="size-4" />
								<span>Crear Ítem en Inventario</span>
							</Button>
						</div>
					</div>
				{:else}
					<form
						method="POST"
						action="?/createSalesProduct"
						use:enhance={() => {
							return async ({ result, update }) => {
								await update();
								if (result.type === 'success') {
									showNewSalesProductModal = false;
									newSalesName = '';
									newSalesPrice = 0;
									if (linkableItems.length > 0) {
										newSalesComponents = [{ itemId: linkableItems[0].id, quantity: 1 }];
									}
								}
							};
						}}
					>
						<div class="max-h-[70vh] space-y-4 overflow-y-auto p-6">
							<input type="hidden" name="businessId" value={data.activeBusiness.id} />
							<input
								type="hidden"
								name="componentsJson"
								value={JSON.stringify(newSalesComponents)}
							/>

							<div class="space-y-2">
								<Label for="sp-name">Nombre Comercial para la Venta</Label>
								<Input
									id="sp-name"
									name="name"
									bind:value={newSalesName}
									placeholder="Ej. Torta 20 Porciones o Combo Cumpleaños"
									class="h-10"
									required
								/>
							</div>

							<!-- Lista de Productos Finales asociados (permite 1 producto o múltiples para Combos) -->
							<div class="space-y-2.5 rounded-xl border border-border bg-muted/20 p-3.5">
								<div class="flex items-center justify-between gap-2">
									<div>
										<p class="text-xs font-semibold text-foreground">
											Productos Finales que incluye ({newSalesComponents.length})
										</p>
										<p class="text-[11px] text-muted-foreground">
											Puedes asociar 1 producto final o combinar varios para armar un Combo.
										</p>
									</div>
									<Button
										type="button"
										variant="outline"
										size="sm"
										class="h-7 px-2.5 text-xs"
										onclick={addNewSalesComponentLine}
									>
										<Plus class="size-3.5" />
										<span>Agregar otro Producto Final</span>
									</Button>
								</div>

								<div class="space-y-2">
									{#each newSalesComponents as comp, idx (idx)}
										{@const selectedItem = data.items.find((i) => i.id === comp.itemId)}
										<div class="flex items-center gap-2 rounded-lg border border-border bg-background p-2">
											<div class="min-w-0 flex-1">
												<select
													aria-label="Producto Final {idx + 1}"
													bind:value={comp.itemId}
													onchange={() => {
														if (newSalesComponents.length === 1) {
															const found = data.items.find((i) => i.id === comp.itemId);
															if (found && !newSalesName) newSalesName = found.name;
														}
													}}
													class="flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-2xs"
													required
												>
													{#each linkableItems as candidate (candidate.id)}
														<option value={candidate.id}>
															[{candidate.code}] {candidate.name} ({ITEM_TYPE_LABELS[candidate.type]} · Stock: {candidate.currentStock} {candidate.baseUnit})
														</option>
													{/each}
												</select>
											</div>

											<div class="flex items-center gap-1.5">
												<Input
													type="number"
													step="any"
													min="0.001"
													bind:value={comp.quantity}
													class="h-9 w-20 text-right font-mono text-xs"
													required
												/>
												<span class="w-8 text-[11px] text-muted-foreground">
													{selectedItem?.baseUnit ?? 'unit'}
												</span>
											</div>

											{#if newSalesComponents.length > 1}
												<Button
													type="button"
													size="icon"
													variant="ghost"
													class="size-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
													title="Quitar ítem del combo"
													onclick={() => removeNewSalesComponentLine(idx)}
												>
													<Trash2 class="size-3.5" />
												</Button>
											{/if}
										</div>
									{/each}
								</div>
							</div>

							<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<div class="space-y-2">
									<Label for="sp-salePrice">Precio de Venta ($)</Label>
									<Input
										id="sp-salePrice"
										name="salePrice"
										type="number"
										step="any"
										min="0"
										bind:value={newSalesPrice}
										class="h-10"
										required
									/>
								</div>

								<div class="space-y-2">
									<Label for="sp-description">Descripción / Presentación (opcional)</Label>
									<Input
										id="sp-description"
										name="description"
										placeholder="Ej. Incluye vela y caja"
										class="h-10"
									/>
								</div>
							</div>

							<div class="flex items-center gap-2 pt-1">
								<input
									id="sp-isShortcut"
									name="isShortcut"
									type="checkbox"
									value="true"
									class="size-4 rounded border-input text-primary focus:ring-primary"
								/>
								<Label for="sp-isShortcut" class="text-xs font-medium cursor-pointer">
									⭐ Fijar como Atajo Rápido en la pantalla de Ventas / Órdenes
								</Label>
							</div>

							<div class="rounded-xl border border-border bg-muted/30 p-3.5 text-xs">
								<div class="flex items-center justify-between">
									<span class="text-muted-foreground">
										Costo estimado total según Receta ({newSalesComponents.length} {newSalesComponents.length === 1 ? 'ítem' : 'ítems'}):
									</span>
									<span class="font-mono font-semibold text-foreground">
										{formatCurrency(estimatedCostForNewSalesProduct)}
									</span>
								</div>
								<div class="mt-1 flex items-center justify-between">
									<span class="text-muted-foreground">Margen bruto proyectado:</span>
									<span
										class="font-mono font-semibold {newSalesPrice - estimatedCostForNewSalesProduct >= 0
											? 'text-emerald-600'
											: 'text-destructive'}"
									>
										{formatCurrency(newSalesPrice - estimatedCostForNewSalesProduct)}
									</span>
								</div>
							</div>
						</div>

						<div class="flex items-center justify-end gap-3 border-t border-border bg-muted/20 px-6 py-4">
							<Button
								type="button"
								variant="outline"
								onclick={() => (showNewSalesProductModal = false)}
							>
								Cancelar
							</Button>
							<Button type="submit">
								<Plus class="size-4" />
								<span>Guardar Producto de Venta</span>
							</Button>
						</div>
					</form>
				{/if}
			</div>
		</div>
	{/if}

	<!-- ========================================================================
	     MODAL PRODUCTOS PARA VENTA: Editar Producto Comercial / Combo
	     ======================================================================== -->
	{#if editingSalesProduct}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
			role="dialog"
			aria-modal="true"
		>
			<div class="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
				<div class="flex items-start justify-between gap-4 border-b border-border p-6">
					<div class="space-y-1">
						<div class="flex items-center gap-2">
							<Badge variant="secondary" class="font-mono text-xs">
								{editingSalesProduct.code}
							</Badge>
							{#if editSalesComponents.length > 1}
								<Badge variant="outline" class="text-xs">Combo</Badge>
							{/if}
						</div>
						<h2 class="text-lg font-bold text-foreground">
							Editar Producto de Venta "{editingSalesProduct.name}"
						</h2>
					</div>
					<Button
						type="button"
						size="icon"
						variant="ghost"
						class="size-8"
						onclick={() => (editingSalesProduct = null)}
					>
						<X class="size-4" />
					</Button>
				</div>

				<form
					method="POST"
					action="?/updateSalesProduct"
					use:enhance={() => {
						return async ({ result, update }) => {
							await update();
							if (result.type === 'success') {
								editingSalesProduct = null;
							}
						};
					}}
				>
					<div class="max-h-[70vh] space-y-4 overflow-y-auto p-6">
						<input type="hidden" name="businessId" value={data.activeBusiness.id} />
						<input type="hidden" name="id" value={editingSalesProduct.id} />
						<input
							type="hidden"
							name="componentsJson"
							value={JSON.stringify(editSalesComponents)}
						/>

						<div class="space-y-2">
							<Label for="edit-sp-name">Nombre Comercial</Label>
							<Input
								id="edit-sp-name"
								name="name"
								value={editingSalesProduct.name}
								class="h-10"
								required
							/>
						</div>

						<!-- Lista de Productos Finales asociados -->
						<div class="space-y-2.5 rounded-xl border border-border bg-muted/20 p-3.5">
							<div class="flex items-center justify-between gap-2">
								<div>
									<p class="text-xs font-semibold text-foreground">
										Productos Finales Asociados ({editSalesComponents.length})
									</p>
									<p class="text-[11px] text-muted-foreground">
										Solo ítems de categoría Producto Final.
									</p>
								</div>
								<Button
									type="button"
									variant="outline"
									size="sm"
									class="h-7 px-2.5 text-xs"
									onclick={addEditSalesComponentLine}
								>
									<Plus class="size-3.5" />
									<span>Agregar otro Producto Final</span>
								</Button>
							</div>

							<div class="space-y-2">
								{#each editSalesComponents as comp, idx (idx)}
									{@const selectedItem = data.items.find((i) => i.id === comp.itemId)}
									<div class="flex items-center gap-2 rounded-lg border border-border bg-background p-2">
										<div class="min-w-0 flex-1">
											<select
												aria-label="Producto Final {idx + 1}"
												bind:value={comp.itemId}
												class="flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-2xs"
												required
											>
												{#each linkableItems as candidate (candidate.id)}
													<option value={candidate.id}>
														[{candidate.code}] {candidate.name} ({ITEM_TYPE_LABELS[candidate.type]} · Stock: {candidate.currentStock} {candidate.baseUnit})
													</option>
												{/each}
											</select>
										</div>

										<div class="flex items-center gap-1.5">
											<Input
												type="number"
												step="any"
												min="0.001"
												bind:value={comp.quantity}
												class="h-9 w-20 text-right font-mono text-xs"
												required
											/>
											<span class="w-8 text-[11px] text-muted-foreground">
												{selectedItem?.baseUnit ?? 'unit'}
											</span>
										</div>

										{#if editSalesComponents.length > 1}
											<Button
												type="button"
												size="icon"
												variant="ghost"
												class="size-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
												title="Quitar ítem del combo"
												onclick={() => removeEditSalesComponentLine(idx)}
											>
												<Trash2 class="size-3.5" />
											</Button>
										{/if}
									</div>
								{/each}
							</div>
						</div>

						<div class="grid grid-cols-2 gap-4">
							<div class="space-y-2">
								<Label for="edit-sp-price">Precio de Venta ($)</Label>
								<Input
									id="edit-sp-price"
									name="salePrice"
									type="number"
									step="any"
									min="0"
									bind:value={editSalesPrice}
									class="h-10"
									required
								/>
							</div>

							<div class="space-y-2">
								<Label for="edit-sp-active">Estado</Label>
								<select
									id="edit-sp-active"
									name="isActive"
									value={editingSalesProduct.isActive ? 'true' : 'false'}
									class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
								>
									<option value="true">Activo para Órdenes</option>
									<option value="false">Pausado</option>
								</select>
							</div>
						</div>

						<div class="space-y-2">
							<Label for="edit-sp-desc">Descripción</Label>
							<Input
								id="edit-sp-desc"
								name="description"
								value={editingSalesProduct.description ?? ''}
								class="h-10"
							/>
						</div>

						<div class="flex items-center gap-2 pt-1">
							<input
								id="edit-sp-shortcut"
								name="isShortcut"
								type="checkbox"
								value="true"
								checked={editingSalesProduct.isShortcut}
								class="size-4 rounded border-input text-primary focus:ring-primary"
							/>
							<Label for="edit-sp-shortcut" class="text-xs font-medium cursor-pointer">
								⭐ Fijar como Atajo Rápido en la pantalla de Ventas / Órdenes
							</Label>
						</div>

						<div class="rounded-xl border border-border bg-muted/30 p-3.5 text-xs">
							<div class="flex items-center justify-between">
								<span class="text-muted-foreground">Costo estimado según Receta:</span>
								<span class="font-mono font-semibold text-foreground">
									{formatCurrency(estimatedCostForEditSalesProduct)}
								</span>
							</div>
							<div class="mt-1 flex items-center justify-between">
								<span class="text-muted-foreground">Margen bruto proyectado:</span>
								<span
									class="font-mono font-semibold {editSalesPrice - estimatedCostForEditSalesProduct >= 0
										? 'text-emerald-600'
										: 'text-destructive'}"
								>
									{formatCurrency(editSalesPrice - estimatedCostForEditSalesProduct)}
								</span>
							</div>
						</div>
					</div>

					<div class="flex items-center justify-end gap-3 border-t border-border bg-muted/20 px-6 py-4">
						<Button type="button" variant="outline" onclick={() => (editingSalesProduct = null)}>
							Cancelar
						</Button>
						<Button type="submit">Guardar Cambios</Button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- ========================================================================
	     MODAL PRODUCTOS PARA VENTA: Confirmar Eliminación
	     ======================================================================== -->
	{#if deletingSalesProduct}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
			role="dialog"
			aria-modal="true"
		>
			<div class="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
				<div class="space-y-3 p-6">
					<div class="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
						<AlertTriangle class="size-5" />
					</div>
					<div class="space-y-1.5">
						<h2 class="text-lg font-bold text-foreground">
							¿Eliminar "{deletingSalesProduct.name}"?
						</h2>
						<p class="text-sm text-muted-foreground">
							Se quitará del catálogo comercial de ventas (el ítem técnico de inventario no se borra).
						</p>
					</div>
				</div>

				<div class="flex items-center justify-end gap-2.5 border-t border-border bg-muted/20 px-6 py-4">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onclick={() => (deletingSalesProduct = null)}
					>
						Cancelar
					</Button>
					<form
						method="POST"
						action="?/deleteSalesProduct"
						use:enhance={() => {
							return async ({ update }) => {
								await update();
								deletingSalesProduct = null;
							};
						}}
					>
						<input type="hidden" name="businessId" value={data.activeBusiness.id} />
						<input type="hidden" name="id" value={deletingSalesProduct.id} />
						<Button type="submit" variant="destructive" size="sm">
							<Trash2 class="size-3.5" />
							<span>Sí, eliminar</span>
						</Button>
					</form>
				</div>
			</div>
		</div>
	{/if}

	<!-- ========================================================================
	     MODAL INVENTARIO: Ver Receta Rápida
	     ======================================================================== -->
	{#if viewingRecipeItem}
		{@const recipeSummary = data.recipeSummaries[viewingRecipeItem.id]}
		{@const allRecipeNodes = recipeSummary?.nodes ?? []}
		{@const paginatedRecipeNodes = allRecipeNodes.slice(
			(recipeModalPage - 1) * recipeModalPageSize,
			recipeModalPage * recipeModalPageSize
		)}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
			role="dialog"
			aria-modal="true"
		>
			<div class="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
				<div class="flex items-start justify-between gap-4 border-b border-border p-6">
					<div class="space-y-1">
						<div class="flex items-center gap-2">
							<span class="rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold">
								{viewingRecipeItem.code}
							</span>
							<ItemTypeBadge type={viewingRecipeItem.type} short={true} />
						</div>
						<h2 class="text-xl font-bold text-foreground">
							Receta de {viewingRecipeItem.name}
						</h2>
						<p class="text-xs text-muted-foreground">
							Rendimiento base: <strong>{viewingRecipeItem.yieldQuantity} {viewingRecipeItem.baseUnit}</strong>
						</p>
					</div>
					<Button
						type="button"
						size="icon"
						variant="ghost"
						class="size-8"
						onclick={() => (viewingRecipeItemId = null)}
					>
						<X class="size-4" />
					</Button>
				</div>

				<div class="max-h-[65vh] space-y-4 overflow-y-auto p-6">
					{#if allRecipeNodes.length > 0}
						<div class="overflow-x-auto rounded-xl border border-border">
							<table class="w-full text-left text-sm">
								<thead class="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
									<tr>
										<th class="py-3 pr-3 pl-4 font-semibold">Ingrediente / Sub-ensamble</th>
										<th class="px-3 py-3 text-right font-semibold">Cantidad</th>
										<th class="px-3 py-3 text-right font-semibold">Costo Unit.</th>
										<th class="py-3 pr-4 pl-3 text-right font-semibold">Subtotal</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-border/60">
									{#each paginatedRecipeNodes as node (node.lineId)}
										<tr>
											<td class="py-3 pr-3 pl-4">
												<div class="flex items-center gap-2">
													<span class="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium">
														{node.component.code}
													</span>
													<span class="font-medium text-foreground">{node.component.name}</span>
												</div>
											</td>
											<td class="px-3 py-3 text-right font-mono text-xs font-semibold">
												{node.quantity} {node.unit}
											</td>
											<td class="px-3 py-3 text-right font-mono text-xs text-muted-foreground">
												{formatCurrency(node.componentUnitCost)} / {node.component.baseUnit}
											</td>
											<td class="py-3 pr-4 pl-3 text-right font-mono text-xs font-semibold text-foreground">
												{formatCurrency(node.estimatedLineCost)}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						<TablePagination
							bind:currentPage={recipeModalPage}
							bind:pageSize={recipeModalPageSize}
							pageSizeOptions={[5, 10, 20]}
							totalItems={allRecipeNodes.length}
							itemLabel="ingredientes"
							compact={true}
						/>
					{:else}
						<div class="rounded-xl border border-dashed border-border p-8 text-center">
							<p class="text-sm font-medium text-foreground">
								Este ítem aún no tiene ingredientes cargados en su Receta.
							</p>
						</div>
					{/if}
				</div>

				<div class="flex items-center justify-between gap-3 border-t border-border bg-muted/20 px-6 py-4">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onclick={() => {
							const id = viewingRecipeItem.id;
							viewingRecipeItemId = null;
							selectCatalogItem(id);
						}}
					>
						<Layers class="size-3.5" />
						<span>Abrir en Pestaña Estructura de Recetas</span>
					</Button>
					<Button type="button" size="sm" onclick={() => (viewingRecipeItemId = null)}>
						Cerrar
					</Button>
				</div>
			</div>
		</div>
	{/if}

	<!-- ========================================================================
	     MODAL INVENTARIO / RECETAS: Confirmación de Eliminación de Ítem
	     ======================================================================== -->
	{#if deletingItem || (showDeleteRecipeItemModal && selectedRoot)}
		{@const targetToDelete = deletingItem ?? selectedRoot!}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
			role="dialog"
			aria-modal="true"
		>
			<div class="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
				<div class="space-y-3 p-6">
					<div class="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
						<AlertTriangle class="size-5" />
					</div>
					<div class="space-y-1.5">
						<h2 class="text-lg font-bold text-foreground">
							¿Eliminar "{targetToDelete.name}"?
						</h2>
						<p class="text-sm text-muted-foreground">
							Estás por eliminar el ítem <strong class="text-foreground">{targetToDelete.code}</strong> del inventario. Esta acción no se puede deshacer.
						</p>
					</div>
				</div>

				<div class="flex items-center justify-end gap-2.5 border-t border-border bg-muted/20 px-6 py-4">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onclick={() => {
							deletingItemId = null;
							showDeleteRecipeItemModal = false;
						}}
					>
						Cancelar
					</Button>
					<form
						method="POST"
						action="?/deleteItem"
						use:enhance={() => {
							return async ({ result, update }) => {
								await update();
								deletingItemId = null;
								showDeleteRecipeItemModal = false;
								if (result.type === 'success') {
									editingItemId = null;
								}
							};
						}}
					>
						<input type="hidden" name="businessId" value={data.activeBusiness.id} />
						<input type="hidden" name="id" value={targetToDelete.id} />
						<Button type="submit" variant="destructive" size="sm">
							<Trash2 class="size-3.5" />
							<span>Sí, eliminar</span>
						</Button>
					</form>
				</div>
			</div>
		</div>
	{/if}
</AppShell>
