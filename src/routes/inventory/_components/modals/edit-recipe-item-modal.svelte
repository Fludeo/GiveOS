<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import type { SuperValidated, Infer } from 'sveltekit-superforms';
	import type { UpdateItemSchema } from '#lib/schemas/item.schema';
	import type { Item } from '#lib/features/items/domain/item.entity';
	import ItemTypeBadge from '#lib/features/items/ui/item-type-badge.svelte';
	import { Button } from '#lib/components/ui/button';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import X from '@lucide/svelte/icons/x';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import CirclePile from '@lucide/svelte/icons/circle-pile';
	import Check from '@lucide/svelte/icons/check';

	interface Props {
		open: boolean;
		formData: SuperValidated<Infer<UpdateItemSchema>>;
		item: Item | null;
		businessId: string;
		onClose: () => void;
		onRequestDelete: (item: Item) => void;
	}

	let { open = $bindable(), formData, item, businessId, onClose, onRequestDelete }: Props = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, submitting, reset } = superForm(formData, {
		onResult({ result }) {
			if (result.type === 'success') {
				handleClose();
			}
		}
	});

	$effect(() => {
		if (open && item) {
			reset();
			$form.id = item.id;
			$form.businessId = businessId;
			$form.type = item.type;
			$form.baseUnit = item.baseUnit;
			$form.referenceCost = item.referenceCost;
			$form.purchaseQuantity = item.purchaseQuantity;
			$form.minStock = item.minStock;
			$form.name = item.name;
			$form.yieldQuantity = item.yieldQuantity > 0 ? item.yieldQuantity : 1;
			$form.isMakeToOrder = Boolean(item.recipeConfig?.isMakeToOrder);
			$form.notes = item.notes ?? '';
			$form.prepTimeMinutes = item.prepTimeMinutes ?? 0;
			$form.passiveTimeMinutes = item.passiveTimeMinutes ?? 0;
			$form.isPrepTimeScalable = item.isPrepTimeScalable ?? false;
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
				use:enhance
			>
				<input type="hidden" name="businessId" value={$form.businessId} />
				<input type="hidden" name="id" value={$form.id} />
				<input type="hidden" name="type" value={$form.type} />
				<input type="hidden" name="baseUnit" value={$form.baseUnit} />
				<input type="hidden" name="referenceCost" value={$form.referenceCost} />
				<input type="hidden" name="purchaseQuantity" value={$form.purchaseQuantity} />
				<input type="hidden" name="minStock" value={$form.minStock} />
				<input type="hidden" name="prepTimeMinutes" value={$form.prepTimeMinutes} />
				<input type="hidden" name="passiveTimeMinutes" value={$form.passiveTimeMinutes} />
				<input type="hidden" name="isPrepTimeScalable" value={$form.isPrepTimeScalable ? 'true' : ''} />

				<!-- Nombre -->
				<div class="space-y-1.5">
					<Label for="edit-name" class="font-semibold text-foreground">Nombre de la Elaboración</Label>
					<Input
						id="edit-name"
						name="name"
						bind:value={$form.name}
						placeholder="Ej. Plancha de Bizcochuelo"
						class="h-10 text-sm font-medium"
						required
					/>
					{#if $errors.name}
						<p class="text-xs text-destructive">{$errors.name}</p>
					{/if}
				</div>

				<!-- Parámetros de Receta: Rendimiento y Modalidad -->
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
						bind:value={$form.yieldQuantity}
						class="h-10 font-mono text-sm"
						required
					/>
					{#if $errors.yieldQuantity}
						<p class="text-xs text-destructive">{$errors.yieldQuantity}</p>
					{/if}
					<p class="text-[11px] text-muted-foreground">
						Cantidad producida por cada tanda completa de la fórmula.
					</p>
				</div>

				<!-- Modalidad de Lote: Tanda Fija vs Divisible por Unidad -->
				<div class="space-y-1.5">
					<Label class="font-semibold text-foreground text-xs">
						Modalidad de Producción del Lote
					</Label>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
						<button
							type="button"
							onclick={() => ($form.isPrepTimeScalable = false)}
							class="rounded-xl border p-3 text-left transition-all cursor-pointer {!$form.isPrepTimeScalable
								? 'border-secondary bg-secondary/10 ring-1 ring-secondary/30'
								: 'border-border bg-card hover:bg-muted/40'}"
						>
							<div class="text-xs font-bold text-foreground">
								Por Tanda Fija ({$form.yieldQuantity || 1} {item.baseUnit === 'unit' ? 'un' : item.baseUnit})
							</div>
							<p class="mt-0.5 text-[11px] text-muted-foreground leading-snug">
								Siempre llena el horno/batidora con el lote entero. Si otra receta pide menos, fabrica la tanda completa y guarda el sobrante en stock.
							</p>
						</button>

						<button
							type="button"
							onclick={() => ($form.isPrepTimeScalable = true)}
							class="rounded-xl border p-3 text-left transition-all cursor-pointer {$form.isPrepTimeScalable
								? 'border-secondary bg-secondary/10 ring-1 ring-secondary/30'
								: 'border-border bg-card hover:bg-muted/40'}"
						>
							<div class="text-xs font-bold text-foreground">
								Divisible por Unidad (1 a 1)
							</div>
							<p class="mt-0.5 text-[11px] text-muted-foreground leading-snug">
								Aunque la fórmula rinda {$form.yieldQuantity || 1}, permite fabricar de a 1 unidad suelta descontando la fracción proporcional.
							</p>
						</button>
					</div>
				</div>

				<!-- Elaboración a Demanda (Make-to-Order / JIT) -->
				<div class="rounded-xl border border-secondary/20 bg-secondary/5 p-3.5 space-y-2">
					<label class="flex items-start gap-2.5 cursor-pointer">
						<input
							type="checkbox"
							name="isMakeToOrder"
							bind:checked={$form.isMakeToOrder}
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
						bind:value={$form.notes}
						placeholder="Ej. Hornear a 180°C durante 40 min, usar molde redondo 24cm"
						class="h-10 text-sm"
					/>
				</div>
			</form>

			<!-- Footer -->
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
						disabled={$submitting}
					>
						Cancelar
					</Button>
					<Button
						type="submit"
						form="edit-recipe-item-form"
						size="sm"
						disabled={$submitting || !$form.name.trim() || Number($form.yieldQuantity) <= 0}
					>
						<Check class="size-3.5 mr-1" />
						<span>{$submitting ? 'Guardando...' : 'Guardar Cambios'}</span>
					</Button>
				</div>
			</div>
		</div>
	</div>
{/if}
