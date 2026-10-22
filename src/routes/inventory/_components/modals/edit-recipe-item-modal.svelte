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
	let editPrepTimeMinutes = $state<number | ''>(0);
	let editNotes = $state('');
	let editIsPrepTimeScalable = $state(false);
	let isSubmitting = $state(false);

	$effect(() => {
		if (open && item) {
			editName = item.name;
			editYieldQuantity = item.yieldQuantity > 0 ? item.yieldQuantity : 1;
			editPrepTimeMinutes = item.prepTimeMinutes ?? 0;
			editIsPrepTimeScalable = Boolean(item.isPrepTimeScalable);
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
		class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
		role="dialog"
		aria-modal="true"
		aria-labelledby="edit-item-modal-title"
	>
		<div class="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
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

				<!-- Parámetros de Receta: Rendimiento y Tiempo -->
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

										<div class="space-y-1.5">
						<Label for="edit-prepTimeMinutes" class="flex items-center gap-1.5 font-semibold text-foreground">
							{#if editIsPrepTimeScalable}
								<ClockFading class="size-3.5 text-secondary" />
								<span>Tiempo por Unidad (min / un)</span>
							{:else}
								<Clock class="size-3.5 text-secondary" />
								<span>Tiempo por Tanda (min / lote)</span>
							{/if}
						</Label>
						<Input
							id="edit-prepTimeMinutes"
							name="prepTimeMinutes"
							type="number"
							step="1"
							min="0"
							bind:value={editPrepTimeMinutes}
							class="h-10 font-mono text-sm"
						/>
						<p class="text-[11px] text-muted-foreground">
							{#if editIsPrepTimeScalable}
								Minutos de elaboración requeridos por cada 1 {item.baseUnit === 'unit' ? 'un' : item.baseUnit}.
							{:else}
								Duración fija de horneado o preparación para la tanda completa.
							{/if}
						</p>
					</div>
				</div>

				<!-- Modo de Tiempo: Fijo por lote vs Fraccional por unidad -->
				<div class="rounded-xl border {editIsPrepTimeScalable ? 'border-secondary/40 bg-secondary/5' : 'border-border/70 bg-muted/15'} p-3.5 space-y-2 transition-colors">
					<div class="flex items-center justify-between gap-2">
						<Label for="edit-isPrepTimeScalable" class="text-xs font-semibold text-foreground cursor-pointer flex items-center gap-1.5">
							<ClockFading class="size-3.5 text-secondary" />
							<span>Tiempo fraccionable por unidad</span>
						</Label>
						<input
							id="edit-isPrepTimeScalable"
							type="checkbox"
							name="isPrepTimeScalable"
							value="true"
							bind:checked={editIsPrepTimeScalable}
							class="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
						/>
					</div>
					<p class="text-[11px] leading-relaxed text-muted-foreground">
						{#if editIsPrepTimeScalable}
							<strong class="text-secondary">Modo por unidad activo:</strong> El tiempo ingresado arriba corresponde a 1 {item.baseUnit === 'unit' ? 'un' : item.baseUnit}. Al fabricar stock, el tiempo estimado total aumentará linealmente según la cantidad producida (ej. {editPrepTimeMinutes || 0} min × unidades fabricadas).
						{:else}
							<strong>Modo lote completo:</strong> El tiempo ingresado arriba es fijo para toda la tanda u horneada completa de {editYieldQuantity || 1} {item.baseUnit === 'unit' ? 'un' : item.baseUnit}.
						{/if}
					</p>
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
