<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		areUnitsCompatible,
		ITEM_TYPE_LABELS,
		UNITS_OF_MEASURE,
		type Item,
		type UnitOfMeasure
	} from '#lib/features/items/domain/item.entity';
	import ItemTypeBadge from '#lib/features/items/ui/item-type-badge.svelte';
	import { Button } from '#lib/components/ui/button';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import X from '@lucide/svelte/icons/x';
	import Plus from '@lucide/svelte/icons/plus';
	import CirclePile from '@lucide/svelte/icons/circle-pile';

	interface Props {
		open: boolean;
		parentItem: Item | null;
		businessId: string;
		availableComponents: Item[];
		onClose: () => void;
	}

	let { open = $bindable(), parentItem, businessId, availableComponents, onClose }: Props = $props();

	let selectedComponentId = $state('');
	let selectedRecipeUnit = $state<UnitOfMeasure>('g');

	const selectedComponent = $derived(
		availableComponents.find((i) => i.id === selectedComponentId) ?? null
	);

	const compatibleUnits = $derived<UnitOfMeasure[]>(
		selectedComponent
			? UNITS_OF_MEASURE.filter((u) => areUnitsCompatible(u, selectedComponent.baseUnit))
			: [...UNITS_OF_MEASURE]
	);

	$effect(() => {
		if (open && availableComponents.length > 0) {
			if (!selectedComponentId || !availableComponents.some((c) => c.id === selectedComponentId)) {
				selectedComponentId = availableComponents[0].id;
				selectedRecipeUnit = availableComponents[0].baseUnit;
			}
		}
	});

	$effect(() => {
		if (selectedComponent && !areUnitsCompatible(selectedRecipeUnit, selectedComponent.baseUnit)) {
			selectedRecipeUnit = selectedComponent.baseUnit;
		}
	});

	function handleClose() {
		open = false;
		onClose();
	}
</script>

{#if open && parentItem}
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
							{parentItem.code}
						</span>
						<ItemTypeBadge type={parentItem.type} short={true} />
					</div>
					<h2 id="add-recipe-modal-title" class="text-lg font-bold text-foreground">
						Añadir a {parentItem.name}
					</h2>
					<p class="text-xs text-muted-foreground flex items-center gap-1">
						<CirclePile class="size-3 text-secondary shrink-0" />
						<span>Rinde {parentItem.yieldQuantity} {parentItem.baseUnit === 'unit' ? 'un' : parentItem.baseUnit}</span>
					</p>
				</div>
				<Button
					type="button"
					size="icon"
					variant="ghost"
					class="size-8 text-muted-foreground hover:text-foreground"
					onclick={handleClose}
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
							handleClose();
						}
					};
				}}
			>
				<div class="space-y-4 p-5">
					<input type="hidden" name="businessId" value={businessId} />
					<input type="hidden" name="parentItemId" value={parentItem.id} />

					<div class="space-y-1.5">
						<Label for="recipe-componentItemId">Ingrediente</Label>
						<select
							id="recipe-componentItemId"
							name="componentItemId"
							bind:value={selectedComponentId}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
							required
						>
							{#each availableComponents as candidate (candidate.id)}
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
									<option value={u}>{u === 'unit' ? 'un' : u}</option>
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
					<Button type="button" variant="outline" onclick={handleClose}>
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
