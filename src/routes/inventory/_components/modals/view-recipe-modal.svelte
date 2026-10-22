<script lang="ts">
	import type { Item } from '#lib/features/items/domain/item.entity';
	import type { RecipeTreeNode } from '#lib/features/recipes/domain/recipe.entity';
	import ItemTypeBadge from '#lib/features/items/ui/item-type-badge.svelte';
	import TablePagination from '#lib/components/ui/pagination/table-pagination.svelte';
	import { Button } from '#lib/components/ui/button';
	import X from '@lucide/svelte/icons/x';
	import Layers from '@lucide/svelte/icons/layers';
	import CirclePile from '@lucide/svelte/icons/circle-pile';
	import Clock from '@lucide/svelte/icons/clock';
	import ClockFading from '@lucide/svelte/icons/clock-fading';
	import { formatCurrency } from '../utils';

	interface Props {
		open: boolean;
		item: Item | null;
		recipeSummary?: { nodes: RecipeTreeNode[] };
		onClose: () => void;
		onOpenRecipeStructure?: (itemId: string) => void;
	}

	let { open = $bindable(), item, recipeSummary, onClose, onOpenRecipeStructure }: Props = $props();

	let recipeModalPage = $state(1);
	let recipeModalPageSize = $state(5);

	const allRecipeNodes = $derived(recipeSummary?.nodes ?? []);
	const paginatedRecipeNodes = $derived(
		allRecipeNodes.slice((recipeModalPage - 1) * recipeModalPageSize, recipeModalPage * recipeModalPageSize)
	);

	function handleClose() {
		open = false;
		onClose();
	}
</script>

{#if open && item}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
		role="dialog"
		aria-modal="true"
	>
		<div class="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
			<div class="flex items-start justify-between gap-4 border-b border-border p-6">
				<div class="space-y-1">
					<div class="flex items-center gap-2">
						<span class="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-tight bg-muted text-muted-foreground">
							{item.code}
						</span>
						<ItemTypeBadge type={item.type} short={true} />
					</div>
					<h2 class="text-xl font-bold text-foreground">
						Receta de {item.name}
					</h2>
					<div class="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-0.5">
						<span class="inline-flex items-center gap-1 font-medium text-foreground">
							<CirclePile class="size-3.5 text-secondary shrink-0" />
							<span>Rendimiento: <strong>{item.yieldQuantity} {item.baseUnit === 'unit' ? 'un' : item.baseUnit}</strong></span>
						</span>
						<span class="text-muted-foreground/40">•</span>
						<span class="inline-flex items-center gap-1 font-medium text-foreground">
							<Layers class="size-3.5 text-secondary shrink-0" />
							<span>Componentes: <strong>{allRecipeNodes.length}</strong></span>
						</span>
						{#if item.prepTimeMinutes && item.prepTimeMinutes > 0}
							<span class="text-muted-foreground/40">•</span>
							<span class="inline-flex items-center gap-1 font-medium text-foreground">
								{#if item.isPrepTimeScalable}
									<ClockFading class="size-3.5 text-secondary shrink-0" />
									<span>Tiempo: <strong>{item.prepTimeMinutes} min / un</strong></span>
								{:else}
									<Clock class="size-3.5 text-secondary shrink-0" />
									<span>Tiempo: <strong>{item.prepTimeMinutes} min / lote</strong></span>
								{/if}
							</span>
						{/if}
					</div>
				</div>
				<Button
					type="button"
					size="icon"
					variant="ghost"
					class="size-8"
					onclick={handleClose}
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
						const currentId = item.id;
						handleClose();
						if (onOpenRecipeStructure) onOpenRecipeStructure(currentId);
					}}
				>
					<Layers class="size-3.5" />
					<span>Abrir en Pestaña Estructura de Recetas</span>
				</Button>
				<Button type="button" size="sm" onclick={handleClose}>
					Cerrar
				</Button>
			</div>
		</div>
	</div>
{/if}
