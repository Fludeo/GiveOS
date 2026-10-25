<script lang="ts">
	import { replaceState } from '$app/navigation';
	import type { PageData } from './$types';
	import type { Item, ItemType } from '#lib/features/items/domain/item.entity';
	import {
		generateNextSalesProductCode,
		type SalesProductWithItems
	} from '#lib/features/orders/domain/order.entity';
	import AppShell from '#lib/components/layout/app-shell.svelte';
	import Package from '@lucide/svelte/icons/package';
	import GraphHub from '@lucide/svelte/icons/graph-hub';
	import Tag from '@lucide/svelte/icons/tag';

	// Componentes Modulares por Sección
	import StockSection from './_components/sections/stock-section.svelte';
	import RecipesSection from './_components/sections/recipes-section.svelte';
	import ProductsSection from './_components/sections/products-section.svelte';

	// Modales Modulares
	import AddStockModal from './_components/modals/add-stock-modal.svelte';
	import AdjustItemModal from './_components/modals/adjust-item-modal.svelte';
	import DeleteItemModal from './_components/modals/delete-item-modal.svelte';
	import NewItemModal from './_components/modals/new-item-modal.svelte';
	import AddRecipeLineModal from './_components/modals/add-recipe-line-modal.svelte';
	import EditRecipeItemModal from './_components/modals/edit-recipe-item-modal.svelte';
	import EditRecipeCostsModal from './_components/modals/edit-recipe-costs-modal.svelte';
	import ViewRecipeModal from './_components/modals/view-recipe-modal.svelte';
	import NewSalesProductModal from './_components/modals/new-sales-product-modal.svelte';
	import EditSalesProductModal from './_components/modals/edit-sales-product-modal.svelte';
	import DeleteSalesProductModal from './_components/modals/delete-sales-product-modal.svelte';

	let { data }: { data: PageData } = $props();

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
	// ESTADO Y CONTROLADORES DE MODALES
	// =========================================================================

	// 1. Alta de nuevo ítem
	let showNewItemModal = $state(false);
	let newItemInitialType = $state<ItemType>('raw_material');

	function openNewItemModal(type: ItemType = 'raw_material') {
		newItemInitialType = type;
		showNewItemModal = true;
	}

	// 2. Cargar stock
	let showAddStockModal = $state(false);
	let selectedStockItemId = $state<string | null>(null);
	const selectedStockItem = $derived(
		selectedStockItemId ? (data.items.find((i) => i.id === selectedStockItemId) ?? null) : null
	);

	function openAddStockModal(item: Item) {
		selectedStockItemId = item.id;
		showAddStockModal = true;
	}

	// 3. Ajustar ítem
	let showAdjustItemModal = $state(false);
	let adjustItemId = $state<string | null>(null);
	const adjustingItem = $derived(
		adjustItemId ? (data.items.find((i) => i.id === adjustItemId) ?? null) : null
	);

	function openAdjustModal(item: Item) {
		adjustItemId = item.id;
		showAdjustItemModal = true;
	}

	// 4. Eliminar ítem
	let showDeleteItemModal = $state(false);
	let deletingItemId = $state<string | null>(null);
	const deletingItem = $derived(
		deletingItemId ? (data.items.find((i) => i.id === deletingItemId) ?? null) : null
	);

	// 5. Ver receta rápida desde la vista de stock
	let showViewRecipeModal = $state(false);
	let viewingRecipeItemId = $state<string | null>(null);
	const viewingRecipeItem = $derived(
		viewingRecipeItemId ? (data.items.find((i) => i.id === viewingRecipeItemId) ?? null) : null
	);

	function openViewRecipeModal(itemId: string) {
		viewingRecipeItemId = itemId;
		showViewRecipeModal = true;
	}

	// 6. Recetas: agregar línea y editar ficha
	let showAddRecipeLineModal = $state(false);
	let showEditRecipeItemModal = $state(false);
	let showEditRecipeCostsModal = $state(false);
	let selectedItemId = $state<string | null>(null);

	const selectedRoot = $derived(
		(selectedItemId ? data.items.find((i) => i.id === selectedItemId && i.type === 'prepared') : null) ??
			(data.selectedRecipeTree?.rootItem?.type === 'prepared' ? data.selectedRecipeTree.rootItem : null) ??
			data.items.find((i) => i.type === 'prepared') ??
			null
	);

	const availableComponentsForSelected = $derived(
		data.items.filter((item) => item.id !== selectedRoot?.id)
	);

	function selectCatalogItem(itemId: string) {
		selectedItemId = itemId;
		activeTab = 'recipes';
		if (typeof window !== 'undefined') {
			const url = new URL(window.location.href);
			url.searchParams.set('tab', 'recipes');
			url.searchParams.set('item', itemId);
			replaceState(url, {});
		}
	}

	// 7. Productos para la venta
	let showNewSalesProductModal = $state(false);
	let showEditSalesProductModal = $state(false);
	let editingSalesProduct = $state<SalesProductWithItems | null>(null);
	let showDeleteSalesProductModal = $state(false);
	let deletingSalesProduct = $state<SalesProductWithItems | null>(null);

	function openEditSalesProduct(product: SalesProductWithItems) {
		editingSalesProduct = product;
		showEditSalesProductModal = true;
	}

	function openDeleteSalesProduct(product: SalesProductWithItems) {
		deletingSalesProduct = product;
		showDeleteSalesProductModal = true;
	}

	const linkableItems = $derived(data.items);
	const existingItemCodes = $derived(data.items.map((i) => i.code));
	const nextSalesProductCode = $derived(
		generateNextSalesProductCode(data.salesProducts.map((p) => p.code))
	);
</script>

<svelte:head>
	<title>Inventario, Recetas y Productos — {data.activeBusiness.name}</title>
</svelte:head>

<AppShell
	user={data.user}
	activeBusiness={data.activeBusiness}
	businesses={data.businesses}
	currentSection="inventory"
	title="Inventario"
	description="Stock de insumos, recetas y productos de venta"
>
	<!-- Barra de Pestañas Unificada (Segmented Control 3 columnas en mobile) -->
	<div class="sticky top-2 z-20 grid grid-cols-3 gap-1 rounded-2xl border border-border bg-card/95 p-1.5 shadow-xs backdrop-blur-md sm:inline-flex sm:w-auto sm:gap-1.5">
		<button
			type="button"
			onclick={() => switchTab('stock')}
			class="inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs sm:px-3.5 sm:text-sm font-medium transition-colors cursor-pointer {currentTab ===
			'stock'
				? 'bg-primary text-primary-foreground shadow-xs font-semibold'
				: 'text-muted-foreground hover:text-foreground'}"
		>
			<Package class="size-3.5 sm:size-4 shrink-0" />
			<span class="truncate sm:hidden">Stock</span>
			<span class="hidden sm:inline">Inventario</span>
		</button>

		<button
			type="button"
			onclick={() => switchTab('recipes')}
			class="inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs sm:px-3.5 sm:text-sm font-medium transition-colors cursor-pointer {currentTab ===
			'recipes'
				? 'bg-primary text-primary-foreground shadow-xs font-semibold'
				: 'text-muted-foreground hover:text-foreground'}"
		>
			<GraphHub class="size-3.5 sm:size-4 shrink-0" />
			<span class="truncate">Recetas</span>
		</button>

		<button
			type="button"
			onclick={() => switchTab('products')}
			class="inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs sm:px-3.5 sm:text-sm font-medium transition-colors cursor-pointer {currentTab ===
			'products'
				? 'bg-primary text-primary-foreground shadow-xs font-semibold'
				: 'text-muted-foreground hover:text-foreground'}"
		>
			<Tag class="size-3.5 sm:size-4 shrink-0" />
			<span class="truncate sm:hidden">Productos</span>
			<span class="hidden sm:inline">Productos de Venta</span>
		</button>
	</div>

	<!-- Vistas Principales por Sección -->
	{#if currentTab === 'stock'}
		<StockSection
			items={data.items}
			recipeSummaries={data.recipeSummaries}
			restockItemId={data.restockItemId}
			onOpenNewItem={() => openNewItemModal('raw_material')}
			onOpenAddStock={openAddStockModal}
			onOpenAdjust={openAdjustModal}
			onSelectCatalogItem={selectCatalogItem}
			onViewRecipe={openViewRecipeModal}
		/>
	{:else if currentTab === 'recipes'}
		<RecipesSection
			items={data.items}
			recipeSummaries={data.recipeSummaries}
			businessId={data.activeBusiness.id}
			bind:selectedItemId
			onEditItem={() => (showEditRecipeItemModal = true)}
			onEditCosts={() => (showEditRecipeCostsModal = true)}
			onAddLine={() => (showAddRecipeLineModal = true)}
		/>
	{:else if currentTab === 'products'}
		<ProductsSection
			salesProducts={data.salesProducts}
			items={data.items}
			businessId={data.activeBusiness.id}
			onOpenNewProduct={() => (showNewSalesProductModal = true)}
			onOpenEditProduct={openEditSalesProduct}
			onOpenDeleteProduct={openDeleteSalesProduct}
			onSelectCatalogItem={selectCatalogItem}
		/>
	{/if}

	<!-- Modales de Stock e Inventario -->
	<NewItemModal
		bind:open={showNewItemModal}
		businessId={data.activeBusiness.id}
		existingCodes={existingItemCodes}
		initialType={newItemInitialType}
		onClose={() => {}}
		onSuccess={(createdId) => {
			if (createdId && currentTab === 'recipes') {
				selectCatalogItem(createdId);
			}
		}}
	/>

	<AddStockModal
		bind:open={showAddStockModal}
		item={selectedStockItem}
		businessId={data.activeBusiness.id}
		allItems={data.items}
		recipeSummary={selectedStockItem ? data.recipeSummaries[selectedStockItem.id] : undefined}
		recipeSummaries={data.recipeSummaries}
		estimatedUnitCost={selectedStockItem
			? (data.recipeSummaries[selectedStockItem.id]?.estimatedUnitCost ?? 0)
			: 0}
		onClose={() => {
			selectedStockItemId = null;
		}}
		onOpenRecipeStructure={selectCatalogItem}
	/>

	<AdjustItemModal
		bind:open={showAdjustItemModal}
		item={adjustingItem}
		businessId={data.activeBusiness.id}
		onClose={() => {
			adjustItemId = null;
		}}
		onRequestDelete={(item) => {
			deletingItemId = item.id;
			showDeleteItemModal = true;
		}}
	/>

	<DeleteItemModal
		bind:open={showDeleteItemModal}
		item={deletingItem}
		businessId={data.activeBusiness.id}
		onClose={() => {
			deletingItemId = null;
		}}
	/>

	<ViewRecipeModal
		bind:open={showViewRecipeModal}
		item={viewingRecipeItem}
		recipeSummary={viewingRecipeItem ? data.recipeSummaries[viewingRecipeItem.id] : undefined}
		onClose={() => {
			viewingRecipeItemId = null;
		}}
		onOpenRecipeStructure={selectCatalogItem}
	/>

	<!-- Modales de Recetas -->
	<AddRecipeLineModal
		bind:open={showAddRecipeLineModal}
		parentItem={selectedRoot}
		businessId={data.activeBusiness.id}
		availableComponents={availableComponentsForSelected}
		onClose={() => {}}
	/>

	<EditRecipeItemModal
		bind:open={showEditRecipeItemModal}
		item={selectedRoot}
		businessId={data.activeBusiness.id}
		onClose={() => {}}
		onRequestDelete={(item) => {
			deletingItemId = item.id;
			showDeleteItemModal = true;
		}}
	/>

	<EditRecipeCostsModal
		bind:open={showEditRecipeCostsModal}
		item={selectedRoot}
		businessSettings={data.activeBusiness.settings}
		businessId={data.activeBusiness.id}
		onClose={() => {}}
	/>

	<!-- Modales de Productos de Venta -->
	<NewSalesProductModal
		bind:open={showNewSalesProductModal}
		businessId={data.activeBusiness.id}
		linkableItems={linkableItems}
		recipeSummaries={data.recipeSummaries}
		nextCode={nextSalesProductCode}
		onClose={() => {}}
		onOpenNewItem={() => openNewItemModal('raw_material')}
	/>

	<EditSalesProductModal
		bind:open={showEditSalesProductModal}
		product={editingSalesProduct}
		businessId={data.activeBusiness.id}
		linkableItems={linkableItems}
		recipeSummaries={data.recipeSummaries}
		onClose={() => {
			editingSalesProduct = null;
		}}
	/>

	<DeleteSalesProductModal
		bind:open={showDeleteSalesProductModal}
		product={deletingSalesProduct}
		businessId={data.activeBusiness.id}
		onClose={() => {
			deletingSalesProduct = null;
		}}
	/>
</AppShell>
