<script lang="ts">
	import type { Item } from '#lib/features/items/domain/item.entity';
	import type { RecipeTreeNode } from '#lib/features/recipes/domain/recipe.entity';
	import RecipeTreeRow from '#lib/features/recipes/ui/recipe-tree-row.svelte';
	import TablePagination from '#lib/components/ui/pagination/table-pagination.svelte';
	import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '#lib/components/ui/card';
	import { Button } from '#lib/components/ui/button';
	import { Input } from '#lib/components/ui/input';
	import { Badge } from '#lib/components/ui/badge';
	import GraphHub from '@lucide/svelte/icons/graph-hub';
	import Search from '@lucide/svelte/icons/search';
	import Clock from '@lucide/svelte/icons/clock';
	import CirclePile from '@lucide/svelte/icons/circle-pile';
	import Layers from '@lucide/svelte/icons/layers';
	import Calculator from '@lucide/svelte/icons/calculator';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import { formatCurrency } from '../utils';

	interface Props {
		items: Item[];
		recipeSummaries: Record<
			string,
			{
				directComponentsCount: number;
				estimatedTotalCost: number;
				estimatedUnitCost: number;
				nodes: RecipeTreeNode[];
			}
		>;
		businessId: string;
		selectedItemId?: string | null;
		onEditItem: () => void;
		onAddLine: () => void;
	}

	let {
		items,
		recipeSummaries,
		businessId,
		selectedItemId = $bindable(null),
		onEditItem,
		onAddLine
	}: Props = $props();

	let recipeSearchQuery = $state('');
	let catalogPage = $state(1);
	let catalogPageSize = $state(8);
	let recipeTablePage = $state(1);
	let recipeTablePageSize = $state(8);

	const filteredRecipeCatalog = $derived(
		items
			.filter((item) => item.type === 'prepared')
			.filter((item) => {
				if (recipeSearchQuery.trim()) {
					const q = recipeSearchQuery.toLowerCase().trim();
					return item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q);
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
		(selectedItemId ? items.find((i) => i.id === selectedItemId && i.type === 'prepared') : null) ??
			filteredRecipeCatalog[0] ??
			null
	);

	const selectedTree = $derived.by(() => {
		if (!selectedRoot) return null;
		const summary = recipeSummaries[selectedRoot.id];
		return {
			rootItem: selectedRoot,
			nodes: summary?.nodes ?? [],
			estimatedTotalCost: summary?.estimatedTotalCost ?? selectedRoot.referenceCost,
			estimatedUnitCost: summary?.estimatedUnitCost ?? 0
		};
	});

	$effect(() => {
		void selectedRoot?.id;
		recipeTablePage = 1;
	});

	const availableComponentsForSelected = $derived(
		items.filter((item) => item.id !== selectedRoot?.id)
	);

	function selectCatalogItem(itemId: string) {
		selectedItemId = itemId;
		const idx = filteredRecipeCatalog.findIndex((i) => i.id === itemId);
		if (idx !== -1) {
			catalogPage = Math.floor(idx / catalogPageSize) + 1;
		}
	}
</script>

<div class="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
	<!-- COLUMNA IZQUIERDA: CATÁLOGO DE ELABORACIONES -->
	<div class="space-y-4 lg:col-span-3">
		<Card class="border-border shadow-xs">
			<CardHeader class="p-3.5 sm:p-4 pb-2.5">
				<div class="flex items-center justify-between gap-1.5">
					<div class="flex items-center gap-1.5 min-w-0">
						<GraphHub class="size-4 text-secondary shrink-0" />
						<CardTitle class="text-sm font-bold truncate">Elaboraciones</CardTitle>
						<Badge variant="secondary" class="px-1.5 py-0.2 text-[10px] font-semibold shrink-0">
							{filteredRecipeCatalog.length}
						</Badge>
					</div>
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
							{@const summary = recipeSummaries[item.id]}
							{@const isSelected = selectedRoot?.id === item.id}
							<button
								type="button"
								onclick={() => selectCatalogItem(item.id)}
								class="w-full text-left rounded-xl border p-2.5 sm:p-3 transition-all cursor-pointer shadow-2xs {isSelected
									? 'border-secondary bg-secondary/10 ring-2 ring-secondary/30'
									: 'border-border bg-card hover:border-secondary/40 hover:bg-muted/30'}"
							>
								<div class="flex items-center justify-between gap-1">
									<span class="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] font-bold text-muted-foreground">
										{item.code}
									</span>
									<div class="flex items-center gap-2">
										<span class="inline-flex items-center gap-1 font-semibold text-[11px] text-secondary">
											<Layers class="size-3" />
											{summary?.directComponentsCount ?? 0}
										</span>
										{#if item.prepTimeMinutes > 0}
											<span class="inline-flex items-center gap-1 font-semibold text-[11px] text-secondary">
												<Clock class="size-3" />
												{item.prepTimeMinutes} min
											</span>
										{/if}
									</div>
								</div>

								<h4 class="mt-1.5 text-xs sm:text-sm font-bold text-foreground line-clamp-1">
									{item.name}
								</h4>

								<div class="mt-2 pt-1.5 border-t border-border/50 flex items-center justify-between text-[11px]">
									<span class="text-muted-foreground truncate mr-1 inline-flex items-center gap-1" title="Rendimiento del lote">
										<CirclePile class="size-3 text-secondary shrink-0" />
										<strong class="font-mono text-foreground font-semibold">{item.yieldQuantity} {item.baseUnit}</strong>
									</span>
									<div class="flex items-center gap-1.5 shrink-0">
										<span class="font-mono font-bold text-foreground">
											{formatCurrency(summary?.estimatedTotalCost ?? 0)}
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
						<GraphHub class="mx-auto size-7 text-muted-foreground/50" />
						<p class="mt-1.5 text-xs font-semibold text-foreground">
							No hay elaboraciones
						</p>
						<p class="mt-0.5 text-[11px] text-muted-foreground">
							Puedes registrar elaboraciones desde la pestaña Inventario.
						</p>
					</div>
				{/if}
			</CardContent>
		</Card>
	</div>

	<!-- COLUMNA DERECHA: RECETA Y DETALLES DE LA ELABORACIÓN SELECCIONADA -->
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
								<span class="rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-bold text-muted-foreground">
									{selectedRoot.code}
								</span>
								<Button
									variant="ghost"
									size="icon"
									class="size-7 rounded-lg text-muted-foreground hover:bg-secondary/15 hover:text-secondary cursor-pointer"
									onclick={onEditItem}
									title="Editar elaboración (ficha técnica, rendimiento y tiempo)"
								>
									<Pencil class="size-3.5" />
								</Button>
							</div>
							<CardTitle class="text-2xl leading-tight font-bold">{selectedRoot.name}</CardTitle>
							{#if selectedRoot.notes}
								<CardDescription class="text-xs">{selectedRoot.notes}</CardDescription>
							{/if}
						</div>
					</div>

					<!-- TARJETAS RENDIMIENTO, TIEMPO Y COSTO SEGÚN /ui-design -->
					<div class="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
						<!-- Tarjeta 1: Rendimiento (Secondary) -->
						<div class="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-2">
							<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
								Rendimiento
							</span>
							<div class="flex items-center gap-3 pt-0.5">
								<div class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary/15 text-secondary">
									<CirclePile class="size-6" />
								</div>
								<div class="flex items-baseline gap-1.5 font-mono">
									<span class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
										{selectedRoot.yieldQuantity}
									</span>
									<span class="text-sm font-semibold text-muted-foreground uppercase">
										{selectedRoot.baseUnit}
									</span>
								</div>
							</div>
							<p class="text-xs text-muted-foreground">
								Tamaño del lote producido por tanda
							</p>
						</div>

						<!-- Tarjeta 2: Tiempo de Elaboración (Amber / Tertiary) -->
						<div class="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-2">
							<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
								Tiempo Estimado
							</span>
							<div class="flex items-center gap-3 pt-0.5">
								<div class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
									<Clock class="size-6" />
								</div>
								<div class="flex items-baseline gap-1.5 font-mono">
									<span class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
										{selectedRoot.prepTimeMinutes ? selectedRoot.prepTimeMinutes : 0}
									</span>
									<span class="text-sm font-semibold text-muted-foreground">
										minutos
									</span>
								</div>
							</div>
							<p class="text-xs text-muted-foreground">
								Preparación y producción
							</p>
						</div>

						<!-- Tarjeta 3: Costo Estimado (Primary) -->
						<div class="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-2">
							<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
								Costo Estimado
							</span>
							<div class="flex items-center gap-3 pt-0.5">
								<div class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
									<Calculator class="size-6" />
								</div>
								<div class="flex items-baseline gap-1.5 font-mono">
									<span class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
										{formatCurrency(tree.estimatedUnitCost)}
									</span>
									<span class="text-xs font-semibold text-muted-foreground">
										/ {selectedRoot.baseUnit}
									</span>
								</div>
							</div>
							<p class="text-xs font-mono text-muted-foreground">
								Costo por tanda: {formatCurrency(tree.estimatedTotalCost)} ({selectedRoot.yieldQuantity} {selectedRoot.baseUnit})
							</p>
						</div>
					</div>
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
							onclick={onAddLine}
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
												{businessId}
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
									onclick={onAddLine}
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
					<GraphHub class="mx-auto size-12 text-muted-foreground/40" />
					<h3 class="mt-4 text-lg font-bold text-foreground">Selecciona una Elaboración</h3>
					<p class="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
						Elige una elaboración de la columna izquierda para ver su receta, modificar sus rendimientos o agregar ingredientes.
					</p>
				</CardContent>
			</Card>
		{/if}
	</div>
</div>
