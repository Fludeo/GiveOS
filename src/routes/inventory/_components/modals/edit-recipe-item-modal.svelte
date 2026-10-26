<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Item } from '#lib/features/items/domain/item.entity';
	import ItemTypeBadge from '#lib/features/items/ui/item-type-badge.svelte';
	import { Button } from '#lib/components/ui/button';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import X from '@lucide/svelte/icons/x';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import CirclePile from '@lucide/svelte/icons/circle-pile';
	import Clock from '@lucide/svelte/icons/clock';
	import ClockFading from '@lucide/svelte/icons/clock-fading';
	import Check from '@lucide/svelte/icons/check';

	interface Props {
		open: boolean;
		item: Item | null;
		businessId: string;
		onClose: () => void;
		onRequestDelete: (item: Item) => void;
	}

	let { open = $bindable(), item, businessId, onClose, onRequestDelete }: Props = $props();

	let editName = $state('');
	let editYieldQuantity = $state<number | ''>(1);
	let editIsMakeToOrder = $state(false);
	let editNotes = $state('');
	let isSubmitting = $state(false);

	$effect(() => {
		if (open && item) {
			editName = item.name;
			editYieldQuantity = item.yieldQuantity > 0 ? item.yieldQuantity : 1;
			editIsMakeToOrder = Boolean(item.recipeConfig?.isMakeToOrder);
			editNotes = item.notes ?? '';
			isSubmitting = false;
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
		aria-labelledby="edit-item-modal-title"
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
					<h2 id="edit-item-modal-title" class="text-xl font-bold text-foreground">
						Editar Receta: {item.name}
					</h2>
					<p class="text-xs text-muted-foreground">
						Ajusta los parámetros de producción (rendimiento y tiempo) de esta elaboración.
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
				id="edit-recipe-item-form"
				method="POST"
				action="?/updateItem"
				class="flex-1 space-y-4 overflow-y-auto p-6"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ result, update }) => {
						await update();
						isSubmitting = false;
						if (result.type === 'success') {
							handleClose();
						}
					};
				}}
			>
				<input type="hidden" name="businessId" value={businessId} />
				<input type="hidden" name="id" value={item.id} />
				<input type="hidden" name="type" value={item.type} />
				<input type="hidden" name="baseUnit" value={item.baseUnit} />
				<input type="hidden" name="referenceCost" value={item.referenceCost} />
				<input type="hidden" name="purchaseQuantity" value={item.purchaseQuantity} />
				<input type="hidden" name="minStock" value={item.minStock} />

				<!-- Nombre -->
				<div class="space-y-1.5">
					<Label for="edit-name" class="font-semibold text-foreground">Nombre de la Elaboración</Label>
					<Input
						id="edit-name"
						name="name"
						bind:value={editName}
						placeholder="Ej. Plancha de Bizcochuelo"
						class="h-10 text-sm font-medium"
						required
					/>
				</div>

				<!-- Parámetros de Receta: Rendimiento y Modalidad Make-to-Order -->
				<div class="space-y-1.5">
					<Label for="edit-yieldQuantity" class="flex items-center gap-1.5 font-semibold text-foreground">
						<CirclePile class="size-3.5 text-secondary" />
						<span>Rendimiento Base ({item.baseUnit === 'unit' ? 'un' : item.baseUnit})</span>
					</Label>
					<Input
						id="edit-yieldQuantity"
						name="yieldQuantity"
						type="number"
						step="any"
						min="0.001"
						bind:value={editYieldQuantity}
						class="h-10 font-mono text-sm"
						required
					/>
					<p class="text-[11px] text-muted-foreground">
						Cantidad producida por cada tanda completa.
					</p>
				</div>

				<!-- Elaboración a Demanda (Make-to-Order / JIT) -->
				<div class="rounded-xl border border-secondary/20 bg-secondary/5 p-3.5 space-y-2">
					<label class="flex items-start gap-2.5 cursor-pointer">
						<input
							type="checkbox"
							name="isMakeToOrder"
							value="true"
							bind:checked={editIsMakeToOrder}
							class="size-4 mt-0.5 rounded border-border text-secondary focus:ring-secondary/30 accent-secondary"
						/>
						<div class="space-y-0.5 select-none">
							<span class="text-xs font-bold text-foreground block">
								Elaboración a Demanda (Make-to-Order / Sin Stock Físico)
							</span>
							<span class="text-[11px] text-muted-foreground block leading-relaxed">
								Para preparados perecederos o inmediatos (ej. merengue italiano, crema chantilly fresca).
								No exige stock en almacén y calcula automáticamente sus materias primas y mano de obra en cada pedido.
							</span>
						</div>
					</label>
				</div>

										<!-- Notas -->
				<div class="space-y-1.5">
					<Label for="edit-notes" class="font-semibold text-foreground">Notas de la Elaboración (opcional)</Label>
					<Input
						id="edit-notes"
						name="notes"
						bind:value={editNotes}
						placeholder="Ej. Hornear a 180°C durante 40 min, usar molde redondo 24cm"
						class="h-10 text-sm"
					/>
				</div>
			</form>

			<!-- Footer con estilo consistente -->
			<div class="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-4">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					class="text-destructive hover:bg-destructive/10 text-xs gap-1.5 cursor-pointer"
					onclick={() => {
						const currentItem = item;
						handleClose();
						if (currentItem) onRequestDelete(currentItem);
					}}
				>
					<Trash2 class="size-3.5" />
					<span>Eliminar Elaboración</span>
				</Button>

				<div class="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onclick={handleClose}
						disabled={isSubmitting}
					>
						Cancelar
					</Button>
					<Button
						type="submit"
						form="edit-recipe-item-form"
						size="sm"
						disabled={isSubmitting || !editName.trim() || Number(editYieldQuantity) <= 0}
					>
						<Check class="size-3.5 mr-1" />
						<span>{isSubmitting ? 'Guardando...' : 'Guardar Cambios'}</span>
					</Button>
				</div>
			</div>
		</div>
	</div>
{/if}
