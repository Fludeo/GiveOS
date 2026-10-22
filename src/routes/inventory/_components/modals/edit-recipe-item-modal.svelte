<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		ITEM_TYPES,
		ITEM_TYPE_LABELS,
		UNITS_OF_MEASURE,
		UNIT_LABELS,
		type Item
	} from '#lib/features/items/domain/item.entity';
	import ItemTypeBadge from '#lib/features/items/ui/item-type-badge.svelte';
	import { Button } from '#lib/components/ui/button';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import X from '@lucide/svelte/icons/x';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import CirclePile from '@lucide/svelte/icons/circle-pile';
	import { getUnitPriceLabel } from '../utils';

	interface Props {
		open: boolean;
		item: Item | null;
		businessId: string;
		onClose: () => void;
		onRequestDelete: (item: Item) => void;
	}

	let { open = $bindable(), item, businessId, onClose, onRequestDelete }: Props = $props();

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
		<div class="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
			<div class="flex items-start justify-between gap-4 border-b border-border p-6">
				<div class="space-y-1">
					<div class="flex items-center gap-2">
						<span class="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold">
							{item.code}
						</span>
						<ItemTypeBadge type={item.type} short={true} />
					</div>
					<h2 id="edit-item-modal-title" class="text-lg font-bold text-foreground">
						Editar "{item.name}"
					</h2>
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
				action="?/updateItem"
				use:enhance={() => {
					return async ({ result, update }) => {
						await update();
						if (result.type === 'success') {
							handleClose();
						}
					};
				}}
			>
				<div class="space-y-4 p-6">
					<input type="hidden" name="businessId" value={businessId} />
					<input type="hidden" name="id" value={item.id} />

					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div class="space-y-2 sm:col-span-2">
							<Label for="edit-name">Nombre</Label>
							<Input id="edit-name" name="name" class="h-10" value={item.name} required />
						</div>

						<div class="space-y-2">
							<Label for="edit-type">Tipo</Label>
							<select
								id="edit-type"
								name="type"
								value={item.type}
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
								value={item.baseUnit}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
							>
								{#each UNITS_OF_MEASURE as u}
									<option value={u}>{UNIT_LABELS[u]}</option>
								{/each}
							</select>
						</div>

						{#if item.type === 'raw_material'}
							<input type="hidden" name="purchaseQuantity" value="1" />
							<div class="space-y-2 sm:col-span-2">
								<Label for="edit-referenceCost">{getUnitPriceLabel(item.baseUnit)}</Label>
								<div class="relative flex items-center">
									<span class="pointer-events-none absolute left-3 font-semibold text-muted-foreground">$</span>
									<Input
										id="edit-referenceCost"
										name="referenceCost"
										type="number"
										step="any"
										min="0"
										class="h-10 pl-8 font-mono"
										value={item.referenceCost}
										required
									/>
								</div>
							</div>
							<input type="hidden" name="yieldQuantity" value={item.yieldQuantity} />
						{:else}
							<div class="space-y-2">
								<Label for="edit-yieldQuantity" class="flex items-center gap-1.5">
									<CirclePile class="size-3.5 text-secondary" />
									<span>Rendimiento ({item.baseUnit})</span>
								</Label>
								<Input
									id="edit-yieldQuantity"
									name="yieldQuantity"
									type="number"
									step="any"
									min="0.001"
									class="h-10 font-mono"
									value={item.yieldQuantity}
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
									value={item.prepTimeMinutes ?? 0}
								/>
							</div>
							<input type="hidden" name="purchaseQuantity" value={item.purchaseQuantity} />
							<input type="hidden" name="referenceCost" value={item.referenceCost} />
						{/if}

						<div class="space-y-2 sm:col-span-2">
							<Label for="edit-notes">Notas</Label>
							<Input id="edit-notes" name="notes" class="h-10" value={item.notes ?? ''} />
						</div>
					</div>
				</div>

				<div class="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-4">
					<Button
						type="button"
						variant="destructive"
						size="sm"
						onclick={() => {
							const currentItem = item;
							handleClose();
							if (currentItem) onRequestDelete(currentItem);
						}}
					>
						<Trash2 class="size-4" />
						<span>Eliminar Ítem</span>
					</Button>
					<div class="flex gap-2.5">
						<Button type="button" variant="outline" size="sm" onclick={handleClose}>
							Cancelar
						</Button>
						<Button type="submit" size="sm">Guardar Cambios</Button>
					</div>
				</div>
			</form>
		</div>
	</div>
{/if}
