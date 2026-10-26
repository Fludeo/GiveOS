<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		UNITS_OF_MEASURE,
		UNIT_LABELS,
		type Item,
		type UnitOfMeasure
	} from '#lib/features/items/domain/item.entity';
	import ItemTypeBadge from '#lib/features/items/ui/item-type-badge.svelte';
	import { Button } from '#lib/components/ui/button';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import X from '@lucide/svelte/icons/x';
	import Check from '@lucide/svelte/icons/check';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';

	interface Props {
		open: boolean;
		item: Item | null;
		businessId: string;
		onClose: () => void;
		onRequestDelete: (item: Item) => void;
	}

	let { open = $bindable(), item, businessId, onClose, onRequestDelete }: Props = $props();

	let adjustItemName = $state('');
	let adjustItemBaseUnit = $state<UnitOfMeasure>('g');
	let adjustItemMinStock = $state<number>(0);
	let isSubmittingAdjust = $state(false);

	$effect(() => {
		if (open && item) {
			adjustItemName = item.name;
			adjustItemBaseUnit = item.baseUnit;
			adjustItemMinStock = item.minStock;
			isSubmittingAdjust = false;
		}
	});

	function handleClose() {
		open = false;
		onClose();
	}
</script>

{#if open && item}
	<div
		class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 p-0 sm:p-4 backdrop-blur-[1px]"
		role="dialog"
		aria-modal="true"
	>
		<div class="flex max-h-[92vh] sm:max-h-[90vh] w-full max-w-full sm:max-w-lg flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border-t sm:border border-border bg-card shadow-2xl">
			<!-- Header -->
			<div class="flex items-start justify-between gap-4 border-b border-border p-6 pb-4">
				<div class="space-y-1">
					<div class="flex items-center gap-2">
						<span class="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-tight bg-muted text-muted-foreground">
							{item.code}
						</span>
						<ItemTypeBadge type={item.type} short={true} />
					</div>
					<h2 class="text-xl font-bold text-foreground">
						Ajustar Ítem: {item.name}
					</h2>
					<p class="text-xs text-muted-foreground">
						Modifica el nombre, la unidad de medida base o el punto de alerta de stock.
					</p>
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

			<!-- Form Body -->
			<form
				id="adjust-item-form"
				method="POST"
				action="?/updateItem"
				class="flex-1 space-y-4 overflow-y-auto p-6"
				use:enhance={() => {
					isSubmittingAdjust = true;
					return async ({ result, update }) => {
						await update();
						isSubmittingAdjust = false;
						if (result.type === 'success') {
							handleClose();
						}
					};
				}}
			>
				<input type="hidden" name="businessId" value={businessId} />
				<input type="hidden" name="id" value={item.id} />
				<input type="hidden" name="type" value={item.type} />
				<input type="hidden" name="referenceCost" value={item.referenceCost} />
				<input type="hidden" name="purchaseQuantity" value={item.purchaseQuantity} />
				<input type="hidden" name="yieldQuantity" value={item.yieldQuantity} />
				<input type="hidden" name="prepTimeMinutes" value={item.prepTimeMinutes} />

				<!-- Nombre -->
				<div class="space-y-1.5">
					<Label for="adjust-item-name" class="font-semibold text-foreground">Nombre del Ítem</Label>
					<Input
						id="adjust-item-name"
						name="name"
						bind:value={adjustItemName}
						placeholder="Nombre del ítem"
						class="h-10 text-sm font-medium"
						required
					/>
				</div>

				<!-- Unidad de Medida -->
				<div class="space-y-1.5">
					<Label for="adjust-item-unit" class="font-semibold text-foreground">Unidad de Medida Base</Label>
					<select
						id="adjust-item-unit"
						name="baseUnit"
						bind:value={adjustItemBaseUnit}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
					>
						{#each UNITS_OF_MEASURE as u}
							<option value={u}>{UNIT_LABELS[u]}</option>
						{/each}
					</select>

					<!-- Alerta de cambio de unidad solicitada por el usuario -->
					{#if adjustItemBaseUnit !== item.baseUnit}
						<div class="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-950 dark:text-amber-200 space-y-1.5 mt-2">
							<div class="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
								<AlertTriangle class="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
								<span>¡Atención al modificar la unidad!</span>
							</div>
							<p class="leading-relaxed">
								Si se ajusta la unidad, se tienen que volver a ajustar todas las elaboraciones que usen este insumo y se tiene que hacer el re-stock para recalcular los costos y proporciones correspondientes.
							</p>
						</div>
					{/if}
				</div>

				<!-- Alerta de Stock Mínimo -->
				<div class="space-y-1.5">
					<Label for="adjust-item-min-stock" class="flex items-center gap-1.5 font-semibold text-foreground">
						<AlertTriangle class="size-3.5 text-destructive" />
						<span>Alerta de Stock Mínimo ({adjustItemBaseUnit})</span>
					</Label>
					<Input
						id="adjust-item-min-stock"
						name="minStock"
						type="number"
						step="any"
						min="0"
						bind:value={adjustItemMinStock}
						placeholder="0 (alerta al bajar de este valor)"
						class="h-10 font-mono text-sm"
					/>
					<p class="text-[11px] text-muted-foreground">
						El ítem se marcará con alerta visual cuando las existencias desciendan a este número o menos.
					</p>
				</div>
			</form>

			<!-- Footer -->
			<div class="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-4">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					class="text-destructive hover:bg-destructive/10 text-xs gap-1.5"
					onclick={() => {
						const currentItem = item;
						handleClose();
						if (currentItem) onRequestDelete(currentItem);
					}}
				>
					<Trash2 class="size-3.5" />
					<span>Eliminar Ítem</span>
				</Button>

				<div class="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onclick={handleClose}
						disabled={isSubmittingAdjust}
					>
						Cancelar
					</Button>
					<Button
						type="submit"
						form="adjust-item-form"
						size="sm"
						disabled={isSubmittingAdjust || !adjustItemName.trim()}
					>
						<Check class="size-3.5 mr-1" />
						<span>{isSubmittingAdjust ? 'Guardando...' : 'Guardar Ajustes'}</span>
					</Button>
				</div>
			</div>
		</div>
	</div>
{/if}
