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
	import GraphHub from '@lucide/svelte/icons/graph-hub';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Check from '@lucide/svelte/icons/check';
	import Pencil from '@lucide/svelte/icons/pencil';
	import X from '@lucide/svelte/icons/x';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Wheat from '@lucide/svelte/icons/wheat';
	import CakeSlice from '@lucide/svelte/icons/cake-slice';
	import ChefHat from '@lucide/svelte/icons/chef-hat';
	import Clock from '@lucide/svelte/icons/clock';
	import Calculator from '@lucide/svelte/icons/calculator';
	import Settings2 from '@lucide/svelte/icons/settings-2';
	import Tag from '@lucide/svelte/icons/tag';
	import Link2 from '@lucide/svelte/icons/link-2';
	import Star from '@lucide/svelte/icons/star';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import List from '@lucide/svelte/icons/list';

	let { data }: PageProps = $props();

	// Modo de visualización: 'cards' (Tarjetas - recomendado móviles) | 'table' (Tabla clásica)
	let stockViewMode = $state<'cards' | 'table'>('cards');
	let salesViewMode = $state<'cards' | 'table'>('cards');

	$effect(() => {
		if (typeof window !== 'undefined') {
			const savedStock = localStorage.getItem('giveos_stock_view');
			if (savedStock === 'cards' || savedStock === 'table') {
				stockViewMode = savedStock;
			}
			const savedSales = localStorage.getItem('giveos_sales_view');
			if (savedSales === 'cards' || savedSales === 'table') {
				salesViewMode = savedSales;
			}
		}
	});

	function toggleStockView(mode: 'cards' | 'table') {
		stockViewMode = mode;
		if (typeof window !== 'undefined') {
			localStorage.setItem('giveos_stock_view', mode);
		}
	}

	function toggleSalesView(mode: 'cards' | 'table') {
		salesViewMode = mode;
		if (typeof window !== 'undefined') {
			localStorage.setItem('giveos_sales_view', mode);
		}
	}

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
	// ESTADO COMPARTIDO Y MODAL DE ALTA DE ÍTEM DE INVENTARIO / RECETA (WIZARD)
	// =========================================================================
	let showNewItemModal = $state(false);
	let newItemStep = $state<1 | 2 | 3>(1);
	let newItemType = $state<ItemType>('raw_material');
	let newItemName = $state('');
	let newItemBaseUnit = $state<UnitOfMeasure>('g');
	let newItemCurrentStock = $state(0);
	let newItemMinStock = $state(0);
	let newItemRefCost = $state(0);
	let newItemPurchaseQty = $state(1);
	let newItemPrepTime = $state(0);
	let newItemNotes = $state('');

	let newItemInitialType = $state<ItemType>('raw_material');

	function openNewItemModal(type: ItemType = 'raw_material') {
		newItemInitialType = type;
		newItemType = type;
		newItemStep = type === 'prepared' ? 2 : 1;
		newItemName = '';
		newItemBaseUnit = type === 'raw_material' ? 'g' : 'unit';
		newItemCurrentStock = 0;
		newItemMinStock = 0;
		newItemRefCost = 0;
		newItemPurchaseQty = 1;
		newItemPrepTime = 0;
		newItemNotes = '';
		showNewItemModal = true;
	}

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
	let catalogPage = $state(1);
	let catalogPageSize = $state(8);
	let recipeTablePage = $state(1);
	let recipeTablePageSize = $state(8);

	let isEditingRecipeParams = $state(false);
	let editRecipeYield = $state(1);
	let editRecipePrepTime = $state(0);

	function startEditingRecipeParams() {
		if (!selectedRoot) return;
		editRecipeYield = selectedRoot.yieldQuantity;
		editRecipePrepTime = selectedRoot.prepTimeMinutes ?? 0;
		isEditingRecipeParams = true;
	}

	function cancelEditingRecipeParams() {
		isEditingRecipeParams = false;
	}

	let showEditItemModal = $state(false);
	let showAddRecipeLineModal = $state(false);
	let showDeleteRecipeItemModal = $state(false);

	let selectedItemId = $state<string | null>(null);

	const filteredRecipeCatalog = $derived(
		data.items
			.filter((item) => item.type === 'prepared')
			.filter((item) => {
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
		catalogPage = 1;
	});

	const paginatedCatalogItems = $derived(
		filteredRecipeCatalog.slice(
			(catalogPage - 1) * catalogPageSize,
			catalogPage * catalogPageSize
		)
	);

	const selectedRoot = $derived(
		(selectedItemId ? data.items.find((i) => i.id === selectedItemId && i.type === 'prepared') : null) ??
			(data.selectedRecipeTree?.rootItem?.type === 'prepared' ? data.selectedRecipeTree.rootItem : null) ??
			filteredRecipeCatalog[0] ??
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
		isEditingRecipeParams = false;
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
	let newSalesStep = $state<1 | 2>(1);
	let newSalesIsCombo = $state(false);
	let newSalesIsShortcut = $state(false);
	let newSalesDescription = $state('');
	let editingSalesProduct = $state<SalesProductWithItems | null>(null);
	let deletingSalesProduct = $state<SalesProductWithItems | null>(null);

	// Permitir vincular cualquier ítem de inventario (materia prima, sub-ensamble o producto final)
	const linkableItems = $derived(data.items);

	let newSalesComponents = $state<SalesProductComponentInput[]>([]);
	let newSalesName = $state('');
	let newSalesPrice = $state(0);

	let editSalesComponents = $state<SalesProductComponentInput[]>([]);
	let editSalesPrice = $state(0);

	function openNewSalesProductModal() {
		newSalesStep = 1;
		newSalesPrice = 0;
		newSalesDescription = '';
		newSalesIsShortcut = false;
		newSalesIsCombo = false;
		if (linkableItems.length > 0) {
			const first = linkableItems[0];
			newSalesComponents = [{ itemId: first.id, quantity: 1 }];
			newSalesName = first.name;
		} else {
			newSalesComponents = [];
			newSalesName = '';
		}
		showNewSalesProductModal = true;
	}

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

{#snippet headerActions()}
	{#if currentTab === 'products'}
		<Button variant="secondary" onclick={openNewSalesProductModal} class="gap-1.5 shadow-xs font-semibold">
			<Plus class="size-4" />
			<span>Nuevo Producto</span>
		</Button>
	{:else}
		<Button variant="secondary" onclick={() => openNewItemModal()} class="gap-1.5 shadow-xs font-semibold">
			<Plus class="size-4" />
			<span>Nuevo Ítem</span>
		</Button>
	{/if}
{/snippet}

{#snippet tabsBar()}
	<!-- Barra de Pestañas Unificada (Inventario | Recetas | Productos para Venta) -->
	<div class="flex items-center gap-1 rounded-2xl border border-border bg-card p-1.5 shadow-2xs">
		<button
			type="button"
			onclick={() => switchTab('stock')}
			class="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors cursor-pointer {currentTab ===
			'stock'
				? 'bg-primary text-primary-foreground shadow-xs font-semibold'
				: 'text-muted-foreground hover:text-foreground'}"
		>
			<Package class="size-4" />
			<span>Inventario</span>
		</button>

		<button
			type="button"
			onclick={() => switchTab('recipes')}
			class="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors cursor-pointer {currentTab ===
			'recipes'
				? 'bg-primary text-primary-foreground shadow-xs font-semibold'
				: 'text-muted-foreground hover:text-foreground'}"
		>
			<CakeSlice class="size-4" />
			<span>Recetas</span>
		</button>

		<button
			type="button"
			onclick={() => switchTab('products')}
			class="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors cursor-pointer {currentTab ===
			'products'
				? 'bg-primary text-primary-foreground shadow-xs font-semibold'
				: 'text-muted-foreground hover:text-foreground'}"
		>
			<Tag class="size-4" />
			<span>Productos de Venta</span>
		</button>
	</div>
{/snippet}

{#snippet stockView()}
	<!-- ========================================================================
	     VISTA 1: INVENTARIO Y EXISTENCIAS
	     ======================================================================== -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			<Card>
				<CardContent class="flex items-center justify-between p-4 sm:p-5">
					<div class="space-y-1">
						<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Catálogo
						</p>
						<p class="text-2xl font-bold text-foreground">{data.items.length} ítems</p>
						<p class="text-xs text-muted-foreground">
							{data.items.filter((i) => i.type === 'raw_material').length} insumos ·
							{data.items.filter((i) => i.type === 'prepared').length} elaboraciones
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
						<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Stock Bajo
						</p>
						<p class="text-2xl font-bold {lowStockCount > 0 ? 'text-destructive' : 'text-foreground'}">
							{lowStockCount}
						</p>
						<p class="text-xs text-muted-foreground">
							{lowStockCount > 0 ? 'Bajo el punto de alerta' : 'Existencias al día'}
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
						<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Valor en Stock
						</p>
						<p class="font-mono text-2xl font-bold text-foreground">
							{formatCurrency(totalInventoryValue)}
						</p>
						<p class="text-xs text-muted-foreground">
							Costo valorizado total
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
							variant={filterType === 'prepared' ? 'default' : 'outline'}
							class="gap-1.5"
							onclick={() => (filterType = 'prepared')}
						>
							<CakeSlice class="size-3.5 text-secondary" />
							<span>Elaboraciones</span>
						</Button>
						<Button
							size="sm"
							variant={onlyLowStock ? 'destructive' : 'outline'}
							onclick={() => (onlyLowStock = !onlyLowStock)}
						>
							<AlertTriangle class="size-3.5" />
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
					</div>
				</div>
			</CardHeader>

			<CardContent class="p-4 pt-2 sm:p-6 sm:pt-4">
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
						{#if stockViewMode === 'cards'}
							<!-- VISTA DE TARJETAS (MOBILE-FIRST) -->
							<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{#each paginatedItems as item (item.id)}
									{@const isLow = item.minStock > 0 && item.currentStock <= item.minStock}
									{@const recipeSummary = data.recipeSummaries[item.id]}
									{@const isEditing = editingItemId === item.id}
									<div
										class="flex flex-col justify-between rounded-2xl border p-4 transition-all shadow-2xs {isEditing
											? 'border-primary ring-2 ring-primary/20 bg-background'
											: isLow
												? 'border-destructive/40 bg-card hover:border-destructive/60'
												: 'border-border bg-card hover:border-border/80'}"
									>
										<div>
											<div class="flex items-center justify-between gap-2">
												<span class="rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground">
													{item.code}
												</span>
												<div class="flex items-center gap-1.5">
													{#if isLow}
														<Badge variant="destructive" class="text-[10px] px-1.5 py-0">Bajo Stock</Badge>
													{/if}
													{#if item.type === 'prepared' && item.prepTimeMinutes > 0}
														<span class="inline-flex items-center gap-1 rounded-md border border-secondary/30 bg-secondary/10 px-1.5 py-0.5 text-[11px] font-semibold text-secondary">
															<Clock class="size-2.5" />
															{item.prepTimeMinutes}m
														</span>
													{/if}
													<ItemTypeBadge type={item.type} short={true} />
												</div>
											</div>

											<div class="mt-2.5">
												<button
													type="button"
													onclick={() => selectCatalogItem(item.id)}
													class="text-left font-bold text-base text-foreground hover:text-primary transition-colors line-clamp-1"
												>
													{item.name}
												</button>
												{#if item.notes}
													<p class="mt-0.5 text-xs text-muted-foreground line-clamp-1">{item.notes}</p>
												{/if}
											</div>

											<!-- Métricas: Stock y Costo -->
											<div class="mt-3.5 grid grid-cols-2 gap-2 rounded-xl border border-border/60 bg-muted/20 p-2.5">
												{#if isEditing}
													<div class="space-y-1">
														<span class="text-[11px] font-medium text-muted-foreground">Stock actual:</span>
														<div class="flex items-center gap-1">
															<Input
																form="inv-form-{item.id}"
																name="currentStock"
																type="number"
																step="any"
																min="0"
																value={item.currentStock}
																class="h-8 font-mono text-xs"
															/>
															<span class="text-xs text-muted-foreground">{item.baseUnit}</span>
														</div>
													</div>
													<div class="space-y-1">
														<span class="text-[11px] font-medium text-muted-foreground">Aviso mínimo:</span>
														<div class="flex items-center gap-1">
															<Input
																form="inv-form-{item.id}"
																name="minStock"
																type="number"
																step="any"
																min="0"
																bind:value={editingMinStock}
																class="h-8 font-mono text-xs"
															/>
															<span class="text-xs text-muted-foreground">{item.baseUnit}</span>
														</div>
													</div>
													{#if item.type === 'raw_material'}
														<div class="col-span-2 pt-1 border-t border-border/40 grid grid-cols-2 gap-2">
															<div class="space-y-1">
																<span class="text-[11px] font-medium text-muted-foreground">Costo compra ($):</span>
																<Input
																	form="inv-form-{item.id}"
																	name="referenceCost"
																	type="number"
																	step="any"
																	min="0"
																	value={item.referenceCost}
																	class="h-8 font-mono text-xs"
																/>
															</div>
															<div class="space-y-1">
																<span class="text-[11px] font-medium text-muted-foreground">Envase ({item.baseUnit}):</span>
																<Input
																	form="inv-form-{item.id}"
																	name="purchaseQuantity"
																	type="number"
																	step="any"
																	min="0.001"
																	value={item.purchaseQuantity}
																	class="h-8 font-mono text-xs"
																/>
															</div>
														</div>
													{/if}
												{:else}
													<div>
														<span class="text-[11px] font-medium text-muted-foreground">Stock Actual</span>
														<p class="font-mono text-base font-bold {isLow ? 'text-destructive' : 'text-foreground'}">
															{item.currentStock} <span class="text-xs font-normal text-muted-foreground">{item.baseUnit}</span>
														</p>
														<p class="font-mono text-[10px] text-muted-foreground">
															Mínimo: {item.minStock} {item.baseUnit}
														</p>
													</div>
													<div>
														<span class="text-[11px] font-medium text-muted-foreground">Costo Unit.</span>
														{#if item.type === 'raw_material'}
															<p class="font-mono text-base font-bold text-foreground">
																{formatCurrency(getDirectUnitCost(item))}
															</p>
															<p class="text-[10px] text-muted-foreground">
																por {item.baseUnit}
															</p>
														{:else if recipeSummary && recipeSummary.directComponentsCount > 0}
															<p class="font-mono text-base font-bold text-foreground">
																{formatCurrency(recipeSummary.estimatedUnitCost)}
															</p>
															<p class="text-[10px] text-muted-foreground">
																{recipeSummary.directComponentsCount} ingr. · rinde {item.yieldQuantity} {item.baseUnit}
															</p>
														{:else}
															<button
																type="button"
																onclick={() => selectCatalogItem(item.id)}
																class="text-xs font-medium text-primary hover:underline mt-1 block"
															>
																+ Armar Receta
															</button>
														{/if}
													</div>
												{/if}
											</div>
										</div>

										<div class="mt-3.5 flex items-center justify-between border-t border-border/50 pt-3">
											{#if isEditing}
												<Button
													type="button"
													variant="ghost"
													size="sm"
													class="text-destructive hover:bg-destructive/10 h-8 text-xs"
													onclick={() => (deletingItemId = item.id)}
												>
													<Trash2 class="size-3.5 mr-1" />
													Eliminar
												</Button>
												<div class="flex items-center gap-1.5">
													<Button
														type="button"
														variant="outline"
														size="sm"
														class="h-8 text-xs"
														onclick={() => (editingItemId = null)}
													>
														Cancelar
													</Button>
													<Button
														form="inv-form-{item.id}"
														type="submit"
														size="sm"
														class="h-8 text-xs font-semibold"
													>
														<Check class="size-3.5 mr-1" />
														Guardar
													</Button>
												</div>
											{:else}
												<div class="flex items-center gap-1.5">
													{#if item.type !== 'raw_material'}
														<Button
															type="button"
															variant="outline"
															size="sm"
															class="h-8 text-xs gap-1"
															onclick={() => selectCatalogItem(item.id)}
														>
															<Layers class="size-3.5" />
															<span>Receta</span>
														</Button>
													{/if}
												</div>
												<Button
													type="button"
													variant="secondary"
													size="sm"
													class="h-8 text-xs gap-1"
													onclick={() => startEditing(item)}
												>
													<Pencil class="size-3.5" />
													<span>Ajustar Stock</span>
												</Button>
											{/if}
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
											<th class="px-4 py-3.5 font-semibold whitespace-nowrap">Stock / Mín.</th>
											<th class="px-4 py-3.5 font-semibold whitespace-nowrap">Costo Unit.</th>
											<th class="py-3.5 pr-5 pl-4 text-right font-semibold whitespace-nowrap">Acciones</th>
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
						{/if}

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
						<p class="mt-3 text-base font-semibold text-foreground">
							No se encontraron ítems
						</p>
						<p class="mt-1 text-sm text-muted-foreground">
							Registra insumos o productos para comenzar el control de stock.
						</p>
						<Button variant="secondary" class="mt-4" onclick={() => openNewItemModal()}>
							<Plus class="size-4" />
							<span>Nuevo Ítem</span>
						</Button>
					</div>
				{/if}
			</CardContent>
		</Card>
{/snippet}

{#snippet recipesView()}
	<!-- ========================================================================
	     VISTA 2: ESTRUCTURA DE RECETAS (2 COLUMNAS: CATÁLOGO IZQ + RECETA DER)
	     ======================================================================== -->
	<div class="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
			<!-- COLUMNA IZQUIERDA: CATÁLOGO DE ELABORACIONES (lg:col-span-3 para maximizar espacio de tabla) -->
			<div class="space-y-4 lg:col-span-3">
				<Card class="border-border shadow-xs">
					<CardHeader class="p-3.5 sm:p-4 pb-2.5">
						<div class="flex items-center justify-between gap-1.5">
							<div class="flex items-center gap-1.5 min-w-0">
								<ChefHat class="size-4 text-secondary shrink-0" />
								<CardTitle class="text-sm font-bold truncate">Elaboraciones</CardTitle>
								<Badge variant="secondary" class="px-1.5 py-0.2 text-[10px] font-semibold shrink-0">
									{filteredRecipeCatalog.length}
								</Badge>
							</div>
							<Button
								size="sm"
								variant="secondary"
								class="h-7 px-2 gap-1 font-medium text-xs shadow-xs shrink-0"
								onclick={() => openNewItemModal('prepared')}
							>
								<Plus class="size-3.5" />
								<span>Nueva</span>
							</Button>
						</div>
						<CardDescription class="text-[11px] mt-0.5 leading-snug">
							Selecciona para ver o armar su receta
						</CardDescription>

						<!-- Buscador -->
						<div class="relative mt-2.5">
							<Search class="pointer-events-none absolute top-2.5 left-2.5 size-3.5 text-muted-foreground" />
							<Input
								type="search"
								placeholder="Buscar por nombre o código..."
								bind:value={recipeSearchQuery}
								class="h-8.5 pl-8 text-xs"
							/>
						</div>
					</CardHeader>

					<CardContent class="p-3.5 sm:p-4 pt-0 space-y-2">
						{#if filteredRecipeCatalog.length > 0}
							<div class="space-y-2">
								{#each paginatedCatalogItems as item (item.id)}
									{@const summary = data.recipeSummaries[item.id]}
									{@const isSelected = selectedRoot?.id === item.id}
									<button
										type="button"
										onclick={() => selectCatalogItem(item.id)}
										class="w-full text-left rounded-xl border p-2.5 sm:p-3 transition-all cursor-pointer shadow-2xs {isSelected
											? 'border-secondary bg-secondary/10 ring-2 ring-secondary/30'
											: 'border-border bg-card hover:border-secondary/40 hover:bg-muted/30'}"
									>
										<div class="flex items-center justify-between gap-1">
											<span class="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] font-bold text-foreground">
												{item.code}
											</span>
											{#if item.prepTimeMinutes > 0}
												<span class="inline-flex items-center gap-1 font-semibold text-[11px] text-secondary">
													<Clock class="size-3" />
													{item.prepTimeMinutes} min
												</span>
											{/if}
										</div>

										<h4 class="mt-1.5 text-xs sm:text-sm font-bold text-foreground line-clamp-1">
											{item.name}
										</h4>

										<div class="mt-2 pt-1.5 border-t border-border/50 flex items-center justify-between text-[11px]">
											<span class="text-muted-foreground truncate mr-1">
												Rinde: <strong class="text-foreground">{item.yieldQuantity} {item.baseUnit}</strong>
											</span>
											<div class="flex items-center gap-1.5 shrink-0">
												<span class="font-mono font-bold text-foreground">
													{formatCurrency(summary?.estimatedTotalCost ?? 0)}
												</span>
												<span class="inline-flex items-center gap-0.5 font-medium text-primary text-[10px]">
													<Layers class="size-2.5" />
													{summary?.directComponentsCount ?? 0}
												</span>
											</div>
										</div>
									</button>
								{/each}
							</div>

							{#if filteredRecipeCatalog.length > catalogPageSize}
								<div class="pt-1">
									<TablePagination
										bind:currentPage={catalogPage}
										bind:pageSize={catalogPageSize}
										totalItems={filteredRecipeCatalog.length}
										itemLabel="elaboraciones"
										compact={true}
									/>
								</div>
							{/if}
						{:else}
							<div class="py-6 text-center rounded-xl border border-dashed border-border p-3">
								<ChefHat class="mx-auto size-7 text-muted-foreground/50" />
								<p class="mt-1.5 text-xs font-semibold text-foreground">
									No hay elaboraciones
								</p>
								<p class="mt-0.5 text-[11px] text-muted-foreground">
									Crea una elaboración para diseñar su receta.
								</p>
								<Button
									size="sm"
									variant="secondary"
									class="mt-2.5 h-7 text-xs gap-1"
									onclick={() => openNewItemModal('prepared')}
								>
									<Plus class="size-3.5" />
									<span>Crear Elaboración</span>
								</Button>
							</div>
						{/if}
					</CardContent>
				</Card>
			</div>

			<!-- COLUMNA DERECHA: RECETA Y DETALLES DE LA ELABORACIÓN SELECCIONADA (lg:col-span-9) -->
			<div class="lg:col-span-9 space-y-6">
				{#if selectedTree && selectedRoot}
					{@const tree = selectedTree}
					{@const paginatedRecipeNodes = tree.nodes.slice(
						(recipeTablePage - 1) * recipeTablePageSize,
						recipeTablePage * recipeTablePageSize
					)}

					<Card class="border-border shadow-xs">
						<CardHeader class="border-b border-border/60 p-5 sm:p-6 pb-4">
							<div class="flex flex-wrap items-center justify-between gap-4">
								<div class="space-y-1">
									<div class="flex items-center gap-2">
										<span class="rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-bold text-foreground">
											{selectedRoot.code}
										</span>
										<Badge variant="secondary" class="gap-1.5 px-2.5 py-0.5 text-xs font-semibold">
											<ChefHat class="size-3.5" />
											<span>Elaboración</span>
										</Badge>
									</div>
									<CardTitle class="text-2xl leading-tight font-bold">{selectedRoot.name}</CardTitle>
									{#if selectedRoot.notes}
										<CardDescription class="text-xs">{selectedRoot.notes}</CardDescription>
									{/if}
								</div>
							</div>

							<!-- TARJETAS GRANDES Y SIMPLIFICADAS PARA RENDIMIENTO, TIEMPO Y COSTO -->
							{#if !isEditingRecipeParams}
								<div class="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
									<!-- Tarjeta 1: Rendimiento -->
									<div class="relative overflow-hidden rounded-2xl border border-secondary/20 bg-gradient-to-br from-secondary/5 to-secondary/10 p-4 transition-all">
										<div class="flex items-center justify-between">
											<div class="flex items-center gap-2">
												<div class="flex size-8 items-center justify-center rounded-lg bg-secondary/15 text-secondary">
													<ChefHat class="size-4" />
												</div>
												<span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rendimiento</span>
											</div>
											<Button
												variant="ghost"
												size="icon"
												class="size-7 rounded-lg text-muted-foreground hover:bg-secondary/20 hover:text-secondary"
												onclick={startEditingRecipeParams}
												title="Modificar rendimiento y tiempo"
											>
												<Pencil class="size-3.5" />
											</Button>
										</div>
										<div class="mt-2.5">
											<div class="flex items-baseline gap-1.5 font-mono">
												<span class="text-2xl font-black text-foreground">
													{selectedRoot.yieldQuantity}
												</span>
												<span class="text-sm font-semibold text-muted-foreground uppercase">
													{selectedRoot.baseUnit}
												</span>
											</div>
											<p class="mt-0.5 text-[11px] text-muted-foreground">
												Tamaño del lote producido
											</p>
										</div>
									</div>

									<!-- Tarjeta 2: Tiempo de Elaboración -->
									<div class="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-amber-500/10 p-4 transition-all">
										<div class="flex items-center justify-between">
											<div class="flex items-center gap-2">
												<div class="flex size-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400">
													<Clock class="size-4" />
												</div>
												<span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tiempo Estimado</span>
											</div>
											<Button
												variant="ghost"
												size="icon"
												class="size-7 rounded-lg text-muted-foreground hover:bg-amber-500/20 hover:text-amber-700 dark:hover:text-amber-300"
												onclick={startEditingRecipeParams}
												title="Modificar rendimiento y tiempo"
											>
												<Pencil class="size-3.5" />
											</Button>
										</div>
										<div class="mt-2.5">
											<div class="flex items-baseline gap-1.5 font-mono">
												<span class="text-2xl font-black text-foreground">
													{selectedRoot.prepTimeMinutes ? selectedRoot.prepTimeMinutes : 0}
												</span>
												<span class="text-sm font-semibold text-muted-foreground">
													minutos
												</span>
											</div>
											<p class="mt-0.5 text-[11px] text-muted-foreground">
												Preparación y cocción
											</p>
										</div>
									</div>

									<!-- Tarjeta 3: Costo Estimado -->
									<div class="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-muted/30 to-muted/10 p-4">
										<div class="flex items-center justify-between">
											<div class="flex items-center gap-2">
												<div class="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
													<Calculator class="size-4" />
												</div>
												<span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Costo Estimado</span>
											</div>
										</div>
										<div class="mt-2.5">
											<div class="font-mono text-2xl font-black text-foreground">
												{formatCurrency(tree.estimatedTotalCost)}
											</div>
											<p class="mt-0.5 font-mono text-[11px] text-muted-foreground">
												Unitario: {formatCurrency(tree.estimatedUnitCost)} / {selectedRoot.baseUnit}
											</p>
										</div>
									</div>
								</div>
							{:else}
								<!-- MODO EDICIÓN DE PARÁMETROS LIMPIO Y ACCESIBLE -->
								<form
									method="POST"
									action="?/updateRecipeYield"
									use:enhance={() => {
										return async ({ update }) => {
											await update();
											isEditingRecipeParams = false;
										};
									}}
									class="mt-5 rounded-2xl border-2 border-secondary/40 bg-secondary/5 p-4 sm:p-5 shadow-xs transition-all space-y-4"
								>
									<input type="hidden" name="businessId" value={data.activeBusiness.id} />
									<input type="hidden" name="id" value={selectedRoot.id} />

									<div class="flex items-center justify-between">
										<div class="flex items-center gap-2 text-sm font-bold text-secondary">
											<Pencil class="size-4" />
											<span>Editar Parámetros de la Receta</span>
										</div>
										<div class="flex items-center gap-2">
											<Button
												type="button"
												variant="ghost"
												size="sm"
												class="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
												onclick={cancelEditingRecipeParams}
											>
												<X class="size-3.5" />
												<span>Cancelar</span>
											</Button>
											<Button
												type="submit"
												variant="secondary"
												size="sm"
												class="h-8 gap-1.5 font-semibold text-xs shadow-xs"
											>
												<Check class="size-3.5" />
												<span>Guardar</span>
											</Button>
										</div>
									</div>

									<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
										<div class="space-y-1.5">
											<Label for="quick-recipe-yield" class="text-xs font-semibold flex items-center gap-1.5 text-foreground">
												<ChefHat class="size-3.5 text-secondary" />
												<span>Rendimiento del Lote ({selectedRoot.baseUnit})</span>
											</Label>
											<div class="relative flex items-center">
												<Input
													id="quick-recipe-yield"
													name="yieldQuantity"
													type="number"
													step="any"
													min="0.001"
													bind:value={editRecipeYield}
													class="h-9 pr-14 font-mono text-sm font-semibold bg-background"
													required
												/>
												<span class="pointer-events-none absolute right-3 font-semibold text-xs text-muted-foreground uppercase">
													{selectedRoot.baseUnit}
												</span>
											</div>
											<p class="text-[10px] text-muted-foreground">
												Cantidad total obtenida con los ingredientes detallados
											</p>
										</div>

										<div class="space-y-1.5">
											<Label for="quick-recipe-preptime" class="text-xs font-semibold flex items-center gap-1.5 text-foreground">
												<Clock class="size-3.5 text-amber-600" />
												<span>Tiempo de Elaboración (minutos)</span>
											</Label>
											<div class="relative flex items-center">
												<Clock class="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" />
												<Input
													id="quick-recipe-preptime"
													name="prepTimeMinutes"
													type="number"
													step="1"
													min="0"
													bind:value={editRecipePrepTime}
													class="h-9 pl-8 pr-12 font-mono text-sm font-semibold bg-background"
													placeholder="0"
												/>
												<span class="pointer-events-none absolute right-3 font-semibold text-xs text-muted-foreground">
													min
												</span>
											</div>
											<p class="text-[10px] text-muted-foreground">
												Tiempo de preparación, cocinado o armado
											</p>
										</div>
									</div>
								</form>
							{/if}
						</CardHeader>

						<CardContent class="space-y-6 p-5 sm:p-6">
							<div class="flex flex-wrap items-center justify-between gap-4">
								<div>
									<h4 class="text-base font-semibold text-foreground">
										Ingredientes y Sub-recetas
									</h4>
									<p class="text-xs text-muted-foreground">
										Fórmula para producir {selectedRoot.yieldQuantity} {selectedRoot.baseUnit} de "{selectedRoot.name}"
									</p>
								</div>

								<Button
									type="button"
									size="sm"
									variant="secondary"
									class="gap-1.5 font-semibold shadow-xs"
									disabled={availableComponentsForSelected.length === 0}
									onclick={() => (showAddRecipeLineModal = true)}
								>
									<Plus class="size-4" />
									<span>Agregar Ingrediente</span>
								</Button>
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
													<th class="px-4 py-3.5 text-center font-semibold">Tiempo</th>
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
														Costo Total Estimado de la Receta (para {selectedRoot.yieldQuantity} {selectedRoot.baseUnit}):
													</td>
													<td class="px-4 py-4 text-right font-mono text-base font-bold text-foreground">
														{formatCurrency(tree.estimatedTotalCost)}
													</td>
													<td colspan="2"></td>
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
								<div class="rounded-xl border border-dashed border-border p-8 text-center">
									<Layers class="mx-auto size-8 text-muted-foreground/60" />
									<p class="mt-2.5 text-base font-semibold text-foreground">
										Sin ingredientes en la receta
									</p>
									<p class="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
										Agrega materias primas u otras elaboraciones para costear y descontar existencias automáticamente.
									</p>
									{#if availableComponentsForSelected.length > 0}
										<Button
											class="mt-4 gap-1.5"
											variant="secondary"
											size="sm"
											onclick={() => (showAddRecipeLineModal = true)}
										>
											<Plus class="size-4" />
											<span>Agregar Ingrediente</span>
										</Button>
									{/if}
								</div>
							{/if}
						</CardContent>
					</Card>
				{:else}
					<Card class="border-border shadow-xs">
						<CardContent class="p-12 text-center">
							<ChefHat class="mx-auto size-12 text-muted-foreground/40" />
							<h3 class="mt-4 text-lg font-bold text-foreground">Selecciona una Elaboración</h3>
							<p class="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
								Elige una elaboración de la columna izquierda para ver su receta, modificar sus rendimientos o agregar ingredientes.
							</p>
						</CardContent>
					</Card>
				{/if}
			</div>
		</div>
{/snippet}

{#snippet productsView()}
	<!-- ========================================================================
	     VISTA 3: PRODUCTOS PARA VENTA (CATÁLOGO COMERCIAL PARA ÓRDENES)
	     ======================================================================== -->
	<Card>
			<CardHeader class="space-y-4 p-6 sm:p-8 sm:pb-4">
				<div class="flex flex-wrap items-center justify-between gap-4">
					<div class="space-y-1">
						<CardTitle class="flex items-center gap-2 text-lg">
							<Tag class="size-5 text-primary" />
							Productos para Venta
						</CardTitle>
						<CardDescription>
							Catálogo comercial disponible para el módulo de Órdenes.
						</CardDescription>
					</div>

					<div class="flex flex-wrap items-center gap-2">
						<div class="relative w-full sm:w-64">
							<Search class="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
							<Input
								type="search"
								placeholder="Buscar producto..."
								bind:value={salesProductSearch}
								class="h-10 pl-9"
							/>
						</div>

						<div class="ml-auto hidden sm:flex items-center gap-1 rounded-xl border border-border bg-muted/30 p-0.5">
							<Button
								type="button"
								variant={salesViewMode === 'cards' ? 'default' : 'ghost'}
								size="sm"
								class="h-7 px-2 text-xs gap-1"
								onclick={() => toggleSalesView('cards')}
								title="Vista de Tarjetas (Móvil)"
							>
								<LayoutGrid class="size-3.5" />
								<span>Tarjetas</span>
							</Button>
							<Button
								type="button"
								variant={salesViewMode === 'table' ? 'default' : 'ghost'}
								size="sm"
								class="h-7 px-2 text-xs gap-1"
								onclick={() => toggleSalesView('table')}
								title="Vista de Tabla"
							>
								<List class="size-3.5" />
								<span>Tabla</span>
							</Button>
						</div>

						<Button variant="secondary" onclick={openNewSalesProductModal} class="gap-1.5 font-semibold shadow-xs">
							<Plus class="size-4" />
							<span>Nuevo Producto</span>
						</Button>
					</div>
				</div>
			</CardHeader>

			<CardContent class="p-4 pt-2 sm:p-6 sm:pt-4">
				{#if filteredSalesProducts.length > 0}
					<div class="space-y-4">
						{#if salesViewMode === 'cards'}
							<!-- VISTA DE TARJETAS (MOBILE-FIRST) -->
							<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{#each paginatedSalesProducts as sp (sp.id)}
									{@const margin = sp.salePrice - sp.estimatedRecipeCost}
									{@const marginPct =
										sp.salePrice > 0 ? Math.round((margin / sp.salePrice) * 100) : 0}
									<div
										class="flex flex-col justify-between rounded-2xl border border-border bg-card p-4 transition-all shadow-2xs hover:border-border/80"
									>
										<div>
											<div class="flex items-center justify-between gap-2">
												<span class="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
													{sp.code}
												</span>
												<div class="flex items-center gap-1.5">
													{#if sp.isShortcut}
														<Badge variant="outline" class="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 text-[10px]">
															<Star class="size-2.5 fill-amber-500 text-amber-500" />
															Atajo
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
											</div>

											<div class="mt-2.5">
												<h3 class="font-bold text-base text-foreground line-clamp-1">{sp.name}</h3>
												{#if sp.description}
													<p class="mt-0.5 text-xs text-muted-foreground line-clamp-1">{sp.description}</p>
												{/if}
											</div>

											<!-- Componentes que descuenta -->
											<div class="mt-3 flex flex-wrap gap-1.5">
												{#each sp.components as comp (comp.id)}
													{#if comp.item}
														<span class="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-foreground">
															<span class="font-mono text-muted-foreground">[{comp.item.code}]</span>
															<span class="truncate max-w-[120px]">{comp.item.name}</span>
															<span class="font-bold text-primary">×{comp.quantity}</span>
														</span>
													{/if}
												{/each}
											</div>

											<!-- Tarjeta de Precio y Margen -->
											<div class="mt-3.5 grid grid-cols-2 gap-2 rounded-xl border border-border/60 bg-muted/20 p-2.5">
												<div>
													<span class="text-[11px] font-medium text-muted-foreground">Precio Venta</span>
													<p class="font-mono text-lg font-bold text-foreground">
														{formatCurrency(sp.salePrice)}
													</p>
													{#if sp.pricingTiers && sp.pricingTiers.length > 0}
														<div class="mt-1 flex flex-wrap gap-1">
															{#each sp.pricingTiers as tier}
																<span class="rounded bg-sky-500/10 px-1 py-0.2 text-[9px] font-mono text-sky-700">
																	≥{tier.minQuantity}u: {tier.type === 'percentage' ? `-${tier.value}%` : formatCurrency(tier.value)}
																</span>
															{/each}
														</div>
													{/if}
												</div>
												<div>
													<span class="text-[11px] font-medium text-muted-foreground">Margen</span>
													<p class="font-mono text-base font-bold {margin >= 0 ? 'text-emerald-600' : 'text-destructive'}">
														{formatCurrency(margin)}
														<span class="text-xs font-normal">({marginPct}%)</span>
													</p>
													<p class="text-[10px] text-muted-foreground">
														Costo: {formatCurrency(sp.estimatedRecipeCost)}
													</p>
												</div>
											</div>
										</div>

										<!-- Footer con Acciones -->
										<div class="mt-3.5 flex items-center justify-between border-t border-border/50 pt-3">
											<form method="POST" action="?/toggleSalesProductShortcut" use:enhance class="inline">
												<input type="hidden" name="businessId" value={data.activeBusiness.id} />
												<input type="hidden" name="id" value={sp.id} />
												<button
													type="submit"
													class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
													title={sp.isShortcut ? 'Quitar de atajos rápidos' : 'Marcar como atajo rápido en ventas'}
												>
													<Star class="size-3.5 {sp.isShortcut ? 'fill-amber-500 text-amber-500' : ''}" />
													<span>{sp.isShortcut ? 'En mostrador' : 'Atajo'}</span>
												</button>
											</form>
											<div class="flex items-center gap-1.5">
												<Button
													variant="ghost"
													size="sm"
													class="h-8 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
													onclick={() => (deletingSalesProduct = sp)}
												>
													<Trash2 class="size-3.5 mr-1" />
													<span>Eliminar</span>
												</Button>
												<Button
													variant="outline"
													size="sm"
													class="h-8 text-xs gap-1"
													onclick={() => openEditSalesProduct(sp)}
												>
													<Pencil class="size-3.5" />
													<span>Editar</span>
												</Button>
											</div>
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
											<th class="py-3.5 pr-4 pl-5 font-semibold">Producto</th>
											<th class="px-4 py-3.5 font-semibold">Composición</th>
											<th class="px-4 py-3.5 text-right font-semibold">Costo Est.</th>
											<th class="px-4 py-3.5 text-right font-semibold">Precio</th>
											<th class="px-4 py-3.5 text-right font-semibold">Margen</th>
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
						{/if}

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
						<p class="mt-3 text-base font-semibold text-foreground">
							Sin productos de venta
						</p>
						<p class="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
							Crea productos o combos comerciales para vender en el mostrador.
						</p>
						<Button variant="secondary" class="mt-4" onclick={openNewSalesProductModal}>
							<Plus class="size-4" />
							<span>Nuevo Producto</span>
						</Button>
					</div>
				{/if}
			</CardContent>
		</Card>
{/snippet}

{#snippet newItemModal()}
	<!-- ========================================================================
	     MODAL ONBOARDING: Alta de Nuevo Ítem en Inventario / Recetas (Paso a Paso)
	     ======================================================================== -->
	{#if showNewItemModal}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
			role="dialog"
			aria-modal="true"
			aria-labelledby="inv-new-item-title"
		>
			<div class="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
				<!-- Header con Barra de Progreso y Paso -->
				<div class="border-b border-border p-5">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="rounded-full {newItemInitialType === 'prepared' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'} px-2.5 py-0.5 text-xs font-bold">
								{#if newItemInitialType === 'prepared'}
									Paso {newItemStep === 2 ? 1 : 2} de 2 · Elaboración
								{:else}
									Paso {newItemStep} de 3
								{/if}
							</span>
							<span class="text-xs font-mono text-muted-foreground">{nextAutoCode}</span>
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

					<h2 id="inv-new-item-title" class="mt-3 text-lg font-bold text-foreground">
						{#if newItemStep === 1}
							¿Qué tipo de ítem vas a registrar?
						{:else if newItemStep === 2}
							{newItemInitialType === 'prepared' ? 'Nueva Elaboración: Nombre y unidad' : 'Nombre y unidad de medida'}
						{:else}
							{newItemType === 'raw_material' ? 'Stock inicial y costos' : 'Avisos de stock y notas'}
						{/if}
					</h2>

					<!-- Barra de progreso visual -->
					<div class="mt-3 flex gap-1.5">
						{#if newItemInitialType === 'prepared'}
							<div class="h-1 flex-1 rounded-full {newItemStep >= 2 ? 'bg-secondary' : 'bg-muted'}"></div>
							<div class="h-1 flex-1 rounded-full {newItemStep >= 3 ? 'bg-secondary' : 'bg-muted'}"></div>
						{:else}
							<div class="h-1 flex-1 rounded-full {newItemStep >= 1 ? 'bg-primary' : 'bg-muted'}"></div>
							<div class="h-1 flex-1 rounded-full {newItemStep >= 2 ? 'bg-primary' : 'bg-muted'}"></div>
							<div class="h-1 flex-1 rounded-full {newItemStep >= 3 ? 'bg-primary' : 'bg-muted'}"></div>
						{/if}
					</div>
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
					<input type="hidden" name="businessId" value={data.activeBusiness.id} />
					<input type="hidden" name="type" value={newItemType} />
					<input type="hidden" name="name" value={newItemName} />
					<input type="hidden" name="baseUnit" value={newItemBaseUnit} />
					<input type="hidden" name="currentStock" value={newItemType === 'raw_material' ? newItemCurrentStock : 0} />
					<input type="hidden" name="minStock" value={newItemMinStock} />
					<input
						type="hidden"
						name="referenceCost"
						value={newItemType === 'raw_material' ? newItemRefCost : 0}
					/>
					<input
						type="hidden"
						name="purchaseQuantity"
						value={newItemType === 'raw_material' ? newItemPurchaseQty : 1}
					/>
					<input type="hidden" name="yieldQuantity" value="1" />
					<input type="hidden" name="prepTimeMinutes" value={newItemPrepTime} />
					<input type="hidden" name="notes" value={newItemNotes} />

					<div class="p-6">
						{#if newItemStep === 1}
							<!-- PASO 1: Selección de Tipo de Ítem -->
							<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<button
									type="button"
									onclick={() => {
										newItemType = 'raw_material';
										newItemBaseUnit = 'g';
										newItemStep = 2;
									}}
									class="flex flex-col items-center justify-center rounded-2xl border-2 p-6 text-center transition-all cursor-pointer {newItemType ===
									'raw_material'
										? 'border-primary bg-primary/5 text-primary shadow-xs'
										: 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'}"
								>
									<div
										class="mb-3 flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600"
									>
										<Wheat class="size-7" />
									</div>
									<span class="text-base font-bold text-foreground">Insumo</span>
									<span class="mt-1 text-xs text-muted-foreground">Materia prima que compras (harina, huevos, azúcar...)</span>
								</button>

								<button
									type="button"
									onclick={() => {
										newItemType = 'prepared';
										newItemBaseUnit = 'unit';
										newItemStep = 2;
									}}
									class="flex flex-col items-center justify-center rounded-2xl border-2 p-6 text-center transition-all cursor-pointer {newItemType ===
									'prepared'
										? 'border-primary bg-primary/5 text-primary shadow-xs'
										: 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'}"
								>
									<div
										class="mb-3 flex size-14 items-center justify-center rounded-full bg-secondary/10 text-secondary"
									>
										<ChefHat class="size-7" />
									</div>
									<span class="text-base font-bold text-foreground">Elaboración</span>
									<span class="mt-1 text-xs text-muted-foreground">Receta de la casa (bases, rellenos, tortas, productos)</span>
								</button>
							</div>
						{:else if newItemStep === 2}
							<!-- PASO 2: Nombre y Unidad -->
							<div class="space-y-4">
								<div class="space-y-2">
									<Label for="inv-step-name">Nombre del Ítem</Label>
									<Input
										id="inv-step-name"
										bind:value={newItemName}
										placeholder={newItemType === 'raw_material'
											? 'Ej. Harina 0000'
											: 'Ej. Bizcochuelo de Vainilla o Torta Selva Negra'}
										class="h-11 text-base font-medium"
										required
										autofocus
									/>
								</div>

								<div class="space-y-2">
									<Label for="inv-step-unit">Unidad de Medida</Label>
									<select
										id="inv-step-unit"
										bind:value={newItemBaseUnit}
										class="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
									>
										{#each UNITS_OF_MEASURE as u}
											<option value={u}>{UNIT_LABELS[u]} ({u})</option>
										{/each}
									</select>
								</div>

								{#if newItemType === 'prepared'}
									<div class="space-y-2">
										<Label for="inv-step-preptime">Tiempo Estimado de Elaboración (minutos)</Label>
										<div class="relative flex items-center">
											<Clock class="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
											<Input
												id="inv-step-preptime"
												type="number"
												min="0"
												step="1"
												bind:value={newItemPrepTime}
												class="h-11 pl-9 font-mono"
												placeholder="0 (ej. 60)"
											/>
										</div>
									</div>
								{/if}
							</div>
						{:else}
							<!-- PASO 3: Stock y Costos -->
							<div class="space-y-4">
								{#if newItemType === 'raw_material'}
									<div class="grid grid-cols-2 gap-3">
										<div class="space-y-1.5">
											<Label for="inv-step-stock">Stock Inicial ({newItemBaseUnit})</Label>
											<Input
												id="inv-step-stock"
												type="number"
												step="any"
												min="0"
												bind:value={newItemCurrentStock}
												class="h-11 font-mono text-base"
											/>
										</div>

										<div class="space-y-1.5">
											<Label for="inv-step-min">Aviso Stock Mínimo</Label>
											<Input
												id="inv-step-min"
												type="number"
												step="any"
												min="0"
												bind:value={newItemMinStock}
												class="h-11 font-mono text-base"
												placeholder="0"
											/>
										</div>
									</div>
								{:else}
									<div class="space-y-1.5">
										<Label for="inv-step-min">Aviso Stock Mínimo en Vitrina ({newItemBaseUnit})</Label>
										<Input
											id="inv-step-min"
											type="number"
											step="any"
											min="0"
											bind:value={newItemMinStock}
											class="h-11 font-mono text-base"
											placeholder="0"
										/>
										<p class="text-[11px] text-muted-foreground">
											El stock de esta elaboración aumentará automáticamente al cocinar lotes de su receta.
										</p>
									</div>
								{/if}

								{#if newItemType === 'raw_material'}
									<div class="space-y-3 rounded-xl border border-border bg-muted/20 p-3.5">
										<div class="grid grid-cols-2 gap-3">
											<div class="space-y-1.5">
												<Label for="inv-step-cost">Costo de Compra ($)</Label>
												<Input
													id="inv-step-cost"
													type="number"
													step="any"
													min="0"
													bind:value={newItemRefCost}
													class="h-10 font-mono"
													placeholder="0.00"
												/>
											</div>
											<div class="space-y-1.5">
												<Label for="inv-step-pkg">Cantidad Envase ({newItemBaseUnit})</Label>
												<Input
													id="inv-step-pkg"
													type="number"
													step="any"
													min="0.001"
													bind:value={newItemPurchaseQty}
													class="h-10 font-mono"
													placeholder="1"
												/>
											</div>
										</div>
										<p class="text-[11px] text-muted-foreground">
											Calcula el costo unitario por cada {newItemBaseUnit} para tus recetas.
										</p>
									</div>
								{/if}

								<div class="space-y-1.5">
									<Label for="inv-step-notes">Notas (opcional)</Label>
									<Input
										id="inv-step-notes"
										bind:value={newItemNotes}
										placeholder="Proveedor, marca o detalle"
										class="h-9 text-xs"
									/>
								</div>
							</div>
						{/if}
					</div>

					<!-- Footer del Wizard -->
					<div class="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-4">
						{#if newItemStep === 1}
							<Button type="button" variant="outline" onclick={() => (showNewItemModal = false)}>
								Cancelar
							</Button>
							<Button type="button" onclick={() => (newItemStep = 2)}>
								Siguiente →
							</Button>
						{:else if newItemStep === 2}
							<Button
								type="button"
								variant="outline"
								onclick={() => {
									if (newItemInitialType === 'prepared') {
										showNewItemModal = false;
									} else {
										newItemStep = 1;
									}
								}}
							>
								{newItemInitialType === 'prepared' ? 'Cancelar' : '← Atrás'}
							</Button>
							<Button
								type="button"
								disabled={!newItemName.trim()}
								onclick={() => (newItemStep = 3)}
								variant={newItemType === 'prepared' ? 'secondary' : 'default'}
							>
								Siguiente →
							</Button>
						{:else}
							<Button type="button" variant="outline" onclick={() => (newItemStep = 2)}>
								← Atrás
							</Button>
							<Button
								type="submit"
								variant={newItemType === 'prepared' ? 'secondary' : 'default'}
							>
								<Check class="size-4" />
								<span>{newItemType === 'prepared' ? 'Guardar Elaboración' : 'Guardar Ítem'}</span>
							</Button>
						{/if}
					</div>
				</form>
			</div>
		</div>
	{/if}
{/snippet}

{#snippet addRecipeLineModal()}
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
			<div class="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
				<div class="flex items-start justify-between gap-4 border-b border-border p-5">
					<div class="space-y-1">
						<div class="flex items-center gap-2">
							<span class="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold">
								{selectedRoot.code}
							</span>
							<ItemTypeBadge type={selectedRoot.type} short={true} />
						</div>
						<h2 id="add-recipe-modal-title" class="text-lg font-bold text-foreground">
							Añadir a {selectedRoot.name}
						</h2>
						<p class="text-xs text-muted-foreground">
							Rinde {selectedRoot.yieldQuantity} {selectedRoot.baseUnit}
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
					<div class="space-y-4 p-5">
						<input type="hidden" name="businessId" value={data.activeBusiness.id} />
						<input type="hidden" name="parentItemId" value={selectedRoot.id} />

						<div class="space-y-1.5">
							<Label for="recipe-componentItemId">Ingrediente</Label>
							<select
								id="recipe-componentItemId"
								name="componentItemId"
								bind:value={selectedComponentId}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
								required
							>
								{#each availableComponentsForSelected as candidate (candidate.id)}
									<option value={candidate.id}>
										[{candidate.code}] {candidate.name} ({ITEM_TYPE_LABELS[candidate.type]})
									</option>
								{/each}
							</select>
						</div>

						<div class="grid grid-cols-2 gap-3">
							<div class="space-y-1.5">
								<Label for="recipe-quantity">Cantidad</Label>
								<Input
									id="recipe-quantity"
									name="quantity"
									type="number"
									step="any"
									min="0.001"
									class="h-10 font-mono"
									placeholder="Ej. 250"
									required
									autofocus
								/>
							</div>

							<div class="space-y-1.5">
								<Label for="recipe-unit">Unidad</Label>
								<select
									id="recipe-unit"
									name="unit"
									bind:value={selectedRecipeUnit}
									class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
								>
									{#each compatibleUnits as u}
										<option value={u}>{u}</option>
									{/each}
								</select>
							</div>
						</div>

						<div class="space-y-1.5">
							<Label for="recipe-notes">Nota (opcional)</Label>
							<Input
								id="recipe-notes"
								name="notes"
								class="h-9 text-xs"
								placeholder="Ej. Relleno, cobertura"
							/>
						</div>
					</div>

					<div class="flex items-center justify-end gap-2.5 border-t border-border bg-muted/20 px-5 py-3.5">
						<Button type="button" variant="outline" onclick={() => (showAddRecipeLineModal = false)}>
							Cancelar
						</Button>
						<Button type="submit">
							<Plus class="size-4" />
							<span>Añadir a Receta</span>
						</Button>
					</div>
				</form>
			</div>
		</div>
	{/if}
{/snippet}

{#snippet editRecipeItemModal()}
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
								<div class="space-y-2">
									<Label for="edit-yieldQuantity">
										Rendimiento ({selectedRoot.baseUnit})
									</Label>
									<Input
										id="edit-yieldQuantity"
										name="yieldQuantity"
										type="number"
										step="any"
										min="0.001"
										class="h-10 font-mono"
										value={selectedRoot.yieldQuantity}
										required
									/>
								</div>
								<div class="space-y-2">
									<Label for="edit-prepTimeMinutes">
										Tiempo Elaboración (min)
									</Label>
									<Input
										id="edit-prepTimeMinutes"
										name="prepTimeMinutes"
										type="number"
										step="1"
										min="0"
										class="h-10 font-mono"
										value={selectedRoot.prepTimeMinutes ?? 0}
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
{/snippet}

{#snippet newSalesProductModal()}
	<!-- ========================================================================
	     MODAL ONBOARDING: Alta de Producto de Venta (Paso a Paso)
	     ======================================================================== -->
	{#if showNewSalesProductModal}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
			role="dialog"
			aria-modal="true"
			aria-labelledby="new-sales-product-title"
		>
			<div class="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
				<!-- Header con Barra de Progreso y Paso -->
				<div class="border-b border-border p-5">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
								Paso {newSalesStep} de 2
							</span>
							<span class="text-xs font-mono text-muted-foreground">{nextSalesProductCode}</span>
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

					<h2 id="new-sales-product-title" class="mt-3 text-lg font-bold text-foreground">
						{#if newSalesStep === 1}
							¿Qué producto vas a vender?
						{:else}
							Precio y venta rápida
						{/if}
					</h2>

					<!-- Barra de progreso visual -->
					<div class="mt-3 flex gap-1.5">
						<div class="h-1 flex-1 rounded-full {newSalesStep >= 1 ? 'bg-primary' : 'bg-muted'}"></div>
						<div class="h-1 flex-1 rounded-full {newSalesStep >= 2 ? 'bg-primary' : 'bg-muted'}"></div>
					</div>
				</div>

				{#if linkableItems.length === 0}
					<div class="space-y-4 p-8 text-center">
						<CakeSlice class="mx-auto size-10 text-muted-foreground" />
						<p class="text-base font-semibold text-foreground">
							Sin ítems en el Inventario
						</p>
						<p class="mx-auto max-w-md text-sm text-muted-foreground">
							Necesitas al menos un ítem registrado para crear un producto de venta.
						</p>
						<div class="flex justify-center gap-3 pt-2">
							<Button variant="outline" onclick={() => (showNewSalesProductModal = false)}>
								Cancelar
							</Button>
							<Button
								type="button"
								onclick={() => {
									showNewSalesProductModal = false;
									openNewItemModal();
								}}
							>
								<Plus class="size-4" />
								<span>Crear Ítem</span>
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
						<input type="hidden" name="businessId" value={data.activeBusiness.id} />
						<input
							type="hidden"
							name="componentsJson"
							value={JSON.stringify(newSalesComponents)}
						/>
						<input type="hidden" name="name" value={newSalesName} />
						<input type="hidden" name="salePrice" value={newSalesPrice} />
						<input type="hidden" name="description" value={newSalesDescription} />
						{#if newSalesIsShortcut}
							<input type="hidden" name="isShortcut" value="true" />
						{/if}

						<div class="p-6">
							{#if newSalesStep === 1}
								<!-- PASO 1: Nombre y Componentes -->
								<div class="space-y-4">
									<div class="space-y-2">
										<Label for="sp-step-name">Nombre Comercial</Label>
										<Input
											id="sp-step-name"
											bind:value={newSalesName}
											placeholder="Ej. Torta Selva Negra o Combo Cumpleaños"
											class="h-11 text-base font-medium"
											required
											autofocus
										/>
									</div>

									<div class="space-y-2.5 rounded-xl border border-border bg-muted/20 p-3.5">
										<div class="flex items-center justify-between">
											<Label class="text-xs font-semibold text-foreground">
												Ítem de Inventario que Descuenta
											</Label>
											{#if !newSalesIsCombo}
												<button
													type="button"
													onclick={() => (newSalesIsCombo = true)}
													class="text-xs font-medium text-primary hover:underline"
												>
													+ Es un combo
												</button>
											{/if}
										</div>

										<div class="space-y-2">
											{#each newSalesComponents as comp, idx (idx)}
												{@const selectedItem = data.items.find((i) => i.id === comp.itemId)}
												<div class="flex items-center gap-2 rounded-lg border border-border bg-background p-2">
													<div class="min-w-0 flex-1">
														<select
															aria-label="Ítem {idx + 1}"
															bind:value={comp.itemId}
															onchange={() => {
																if (newSalesComponents.length === 1 && !newSalesName) {
																	const found = data.items.find((i) => i.id === comp.itemId);
																	if (found) newSalesName = found.name;
																}
															}}
															class="flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-2xs"
															required
														>
															{#each linkableItems as candidate (candidate.id)}
																<option value={candidate.id}>
																	[{candidate.code}] {candidate.name} ({ITEM_TYPE_LABELS[candidate.type]} · {candidate.currentStock} {candidate.baseUnit})
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
															class="h-9 w-18 text-right font-mono text-xs"
															required
														/>
														<span class="w-7 text-[11px] text-muted-foreground">
															{selectedItem?.baseUnit ?? 'u'}
														</span>
													</div>

													{#if newSalesComponents.length > 1}
														<Button
															type="button"
															size="icon"
															variant="ghost"
															class="size-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
															onclick={() => removeNewSalesComponentLine(idx)}
														>
															<Trash2 class="size-3.5" />
														</Button>
													{/if}
												</div>
											{/each}

											{#if newSalesIsCombo}
												<Button
													type="button"
													variant="outline"
													size="sm"
													class="w-full text-xs"
													onclick={addNewSalesComponentLine}
												>
													<Plus class="size-3.5" />
													<span>Agregar otro ítem al combo</span>
												</Button>
											{/if}
										</div>
									</div>
								</div>

							{:else}
								<!-- PASO 2: Precio y Atajos -->
								<div class="space-y-4">
									<div class="space-y-2">
										<Label for="sp-step-price">Precio de Venta ($)</Label>
										<Input
											id="sp-step-price"
											type="number"
											step="any"
											min="0"
											bind:value={newSalesPrice}
											class="h-11 font-mono text-xl font-bold"
											placeholder="0.00"
											required
											autofocus
										/>
									</div>

									<!-- Resumen de Costo y Margen -->
									<div class="rounded-xl border border-border bg-muted/30 p-3.5 text-xs space-y-1.5">
										<div class="flex items-center justify-between">
											<span class="text-muted-foreground">Costo estimado:</span>
											<span class="font-mono font-semibold text-foreground">
												{formatCurrency(estimatedCostForNewSalesProduct)}
											</span>
										</div>
										<div class="flex items-center justify-between">
											<span class="text-muted-foreground">Margen proyectado:</span>
											<span
												class="font-mono font-semibold {newSalesPrice - estimatedCostForNewSalesProduct >= 0
													? 'text-emerald-600'
													: 'text-destructive'}"
											>
												{formatCurrency(newSalesPrice - estimatedCostForNewSalesProduct)}
												{#if newSalesPrice > 0}
													({Math.round(((newSalesPrice - estimatedCostForNewSalesProduct) / newSalesPrice) * 100)}%)
												{/if}
											</span>
										</div>
									</div>

									<label class="flex items-center gap-2.5 rounded-xl border border-border bg-muted/20 p-3 cursor-pointer">
										<input
											type="checkbox"
											bind:checked={newSalesIsShortcut}
											class="size-4 rounded border-input text-amber-500 focus:ring-amber-500"
										/>
										<span class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
											<Star class="size-3.5 {newSalesIsShortcut ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'}" />
											Fijar como atajo rápido en la pantalla de ventas
										</span>
									</label>

									<div class="space-y-1.5">
										<Label for="sp-step-desc">Descripción (opcional)</Label>
										<Input
											id="sp-step-desc"
											bind:value={newSalesDescription}
											placeholder="Ej. Incluye vela y cartel"
											class="h-9 text-xs"
										/>
									</div>
								</div>
							{/if}
						</div>

						<!-- Footer del Wizard -->
						<div class="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-4">
							{#if newSalesStep === 1}
								<Button
									type="button"
									variant="outline"
									onclick={() => (showNewSalesProductModal = false)}
								>
									Cancelar
								</Button>
								<Button
									type="button"
									disabled={!newSalesName.trim()}
									onclick={() => (newSalesStep = 2)}
								>
									Siguiente →
								</Button>
							{:else}
								<Button
									type="button"
									variant="outline"
									onclick={() => (newSalesStep = 1)}
								>
									← Atrás
								</Button>
								<Button type="submit">
									<Check class="size-4" />
									<span>Guardar Producto</span>
								</Button>
							{/if}
						</div>
					</form>
				{/if}
			</div>
		</div>
	{/if}
{/snippet}

{#snippet editSalesProductModal()}
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

						<!-- Lista de Ítems asociados -->
						<div class="space-y-2.5 rounded-xl border border-border bg-muted/20 p-3.5">
							<div class="flex items-center justify-between gap-2">
								<span class="text-xs font-semibold text-foreground">
									Ítems que incluye ({editSalesComponents.length})
								</span>
								<Button
									type="button"
									variant="outline"
									size="sm"
									class="h-7 px-2 text-xs"
									onclick={addEditSalesComponentLine}
								>
									<Plus class="size-3.5" />
									<span>Agregar otro ítem</span>
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
{/snippet}

{#snippet deleteSalesProductModal()}
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
{/snippet}

{#snippet viewRecipeModal()}
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
{/snippet}

{#snippet deleteItemModal()}
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
{/snippet}

<AppShell
	user={data.user}
	activeBusiness={data.activeBusiness}
	businesses={data.businesses}
	currentSection="inventory"
	title="Inventario"
	description="Stock de insumos, recetas y productos de venta"
	{headerActions}
>
	{@render tabsBar()}

	{#if currentTab === 'stock'}
		{@render stockView()}
	{:else if currentTab === 'recipes'}
		{@render recipesView()}
	{:else if currentTab === 'products'}
		{@render productsView()}
	{/if}

	{@render newItemModal()}
	{@render addRecipeLineModal()}
	{@render editRecipeItemModal()}
	{@render newSalesProductModal()}
	{@render editSalesProductModal()}
	{@render deleteSalesProductModal()}
	{@render viewRecipeModal()}
	{@render deleteItemModal()}
</AppShell>
