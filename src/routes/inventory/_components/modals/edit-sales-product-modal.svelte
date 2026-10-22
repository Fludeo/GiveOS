<script lang="ts">
	import { enhance } from '$app/forms';
	import { ITEM_TYPE_LABELS, type Item } from '#lib/features/items/domain/item.entity';
	import type { SalesProductWithItems } from '#lib/features/orders/domain/order.entity';
	import { Button } from '#lib/components/ui/button';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import { Badge } from '#lib/components/ui/badge';
	import X from '@lucide/svelte/icons/x';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { formatCurrency, calculateComponentsRecipeCost } from '../utils';

	interface Props {
		open: boolean;
		product: SalesProductWithItems | null;
		businessId: string;
		linkableItems: Item[];
		recipeSummaries: Record<string, { estimatedUnitCost: number }>;
		onClose: () => void;
	}

	let {
		open = $bindable(),
		product,
		businessId,
		linkableItems,
		recipeSummaries,
		onClose
	}: Props = $props();

	let editSalesComponents = $state<{ itemId: string; quantity: number }[]>([]);
	let editSalesPrice = $state(0);

	$effect(() => {
		if (open && product) {
			editSalesPrice = product.salePrice;
			if (product.components.length > 0) {
				editSalesComponents = product.components.map((c) => ({
					itemId: c.itemId,
					quantity: c.quantity
				}));
			} else if (linkableItems.length > 0) {
				editSalesComponents = [{ itemId: linkableItems[0].id, quantity: 1 }];
			} else {
				editSalesComponents = [];
			}
		}
	});

	function handleClose() {
		open = false;
		onClose();
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

	const estimatedCost = $derived(
		calculateComponentsRecipeCost(editSalesComponents, linkableItems, recipeSummaries)
	);
</script>

{#if open && product}
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
							{product.code}
						</Badge>
						{#if editSalesComponents.length > 1}
							<Badge variant="outline" class="text-xs">Combo</Badge>
						{/if}
					</div>
					<h2 class="text-lg font-bold text-foreground">
						Editar Producto de Venta "{product.name}"
					</h2>
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

			<form
				method="POST"
				action="?/updateSalesProduct"
				use:enhance={() => {
					return async ({ result, update }) => {
						await update();
						if (result.type === 'success') {
							handleClose();
						}
					};
				}}
			>
				<div class="max-h-[70vh] space-y-4 overflow-y-auto p-6">
					<input type="hidden" name="businessId" value={businessId} />
					<input type="hidden" name="id" value={product.id} />
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
							value={product.name}
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
								{@const selectedItem = linkableItems.find((i) => i.id === comp.itemId)}
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
											{selectedItem?.baseUnit === 'unit' ? 'un.' : (selectedItem?.baseUnit ?? 'un.')}
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
								value={product.isActive ? 'true' : 'false'}
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
							value={product.description ?? ''}
							class="h-10"
						/>
					</div>

					<div class="flex items-center gap-2 pt-1">
						<input
							id="edit-sp-shortcut"
							name="isShortcut"
							type="checkbox"
							value="true"
							checked={product.isShortcut}
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
								{formatCurrency(estimatedCost)}
							</span>
						</div>
						<div class="mt-1 flex items-center justify-between">
							<span class="text-muted-foreground">Margen bruto proyectado:</span>
							<span
								class="font-mono font-semibold {editSalesPrice - estimatedCost >= 0
									? 'text-emerald-600'
									: 'text-destructive'}"
							>
								{formatCurrency(editSalesPrice - estimatedCost)}
							</span>
						</div>
					</div>
				</div>

				<div class="flex items-center justify-end gap-3 border-t border-border bg-muted/20 px-6 py-4">
					<Button type="button" variant="outline" onclick={handleClose}>
						Cancelar
					</Button>
					<Button type="submit">Guardar Cambios</Button>
				</div>
			</form>
		</div>
	</div>
{/if}
