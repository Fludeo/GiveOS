<script lang="ts">
	import { enhance } from '$app/forms';
	import { ITEM_TYPE_LABELS, type Item } from '#lib/features/items/domain/item.entity';
	import { Button } from '#lib/components/ui/button';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import X from '@lucide/svelte/icons/x';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Star from '@lucide/svelte/icons/star';
	import Check from '@lucide/svelte/icons/check';
	import CakeSlice from '@lucide/svelte/icons/cake-slice';
	import { formatCurrency, calculateComponentsRecipeCost } from '../utils';

	interface Props {
		open: boolean;
		businessId: string;
		linkableItems: Item[];
		recipeSummaries: Record<string, { estimatedUnitCost: number }>;
		nextCode: string;
		onClose: () => void;
		onOpenNewItem?: () => void;
	}

	let {
		open = $bindable(),
		businessId,
		linkableItems,
		recipeSummaries,
		nextCode,
		onClose,
		onOpenNewItem
	}: Props = $props();

	let newSalesStep = $state<1 | 2>(1);
	let newSalesName = $state('');
	let newSalesPrice = $state(0);
	let newSalesDescription = $state('');
	let newSalesIsCombo = $state(false);
	let newSalesIsShortcut = $state(false);
	let newSalesComponents = $state<{ itemId: string; quantity: number }[]>([]);

	$effect(() => {
		if (open) {
			newSalesStep = 1;
			newSalesPrice = 0;
			newSalesDescription = '';
			newSalesIsShortcut = false;
			newSalesIsCombo = false;
			if (linkableItems.length > 0) {
				const first = linkableItems[0];
				newSalesComponents = [{ itemId: first.id, quantity: 1 }];
				newSalesName = first.name;
			} else {
				newSalesComponents = [];
				newSalesName = '';
			}
		}
	});

	function handleClose() {
		open = false;
		onClose();
	}

	function addNewSalesComponentLine() {
		if (linkableItems.length === 0) return;
		const unused =
			linkableItems.find((cand) => !newSalesComponents.some((c) => c.itemId === cand.id)) ??
			linkableItems[0];
		newSalesComponents = [...newSalesComponents, { itemId: unused.id, quantity: 1 }];
	}

	function removeNewSalesComponentLine(index: number) {
		if (newSalesComponents.length <= 1) return;
		newSalesComponents = newSalesComponents.filter((_, i) => i !== index);
	}

	const estimatedCost = $derived(
		calculateComponentsRecipeCost(newSalesComponents, linkableItems, recipeSummaries)
	);
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
		role="dialog"
		aria-modal="true"
		aria-labelledby="new-sales-product-title"
	>
		<div class="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
			<!-- Header con Barra de Progreso y Paso -->
			<div class="border-b border-border p-5">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
							Paso {newSalesStep} de 2
						</span>
						<span class="text-xs font-mono text-muted-foreground">{nextCode}</span>
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

				<h2 id="new-sales-product-title" class="mt-3 text-lg font-bold text-foreground">
					{#if newSalesStep === 1}
						¿Qué producto vas a vender?
					{:else}
						Precio y venta rápida
					{/if}
				</h2>

				<!-- Barra de progreso visual -->
				<div class="mt-3 flex gap-1.5">
					<div class="h-1 flex-1 rounded-full {newSalesStep >= 1 ? 'bg-primary' : 'bg-muted'}"></div>
					<div class="h-1 flex-1 rounded-full {newSalesStep >= 2 ? 'bg-primary' : 'bg-muted'}"></div>
				</div>
			</div>

			{#if linkableItems.length === 0}
				<div class="space-y-4 p-8 text-center">
					<CakeSlice class="mx-auto size-10 text-muted-foreground" />
					<p class="text-base font-semibold text-foreground">
						Sin ítems en el Inventario
					</p>
					<p class="mx-auto max-w-md text-sm text-muted-foreground">
						Necesitas al menos un ítem registrado para crear un producto de venta.
					</p>
					<div class="flex justify-center gap-3 pt-2">
						<Button variant="outline" onclick={handleClose}>
							Cancelar
						</Button>
						<Button
							type="button"
							onclick={() => {
								handleClose();
								if (onOpenNewItem) onOpenNewItem();
							}}
						>
							<Plus class="size-4" />
							<span>Crear Ítem</span>
						</Button>
					</div>
				</div>
			{:else}
				<form
					method="POST"
					action="?/createSalesProduct"
					use:enhance={() => {
						return async ({ result, update }) => {
							await update();
							if (result.type === 'success') {
								handleClose();
							}
						};
					}}
				>
					<input type="hidden" name="businessId" value={businessId} />
					<input
						type="hidden"
						name="componentsJson"
						value={JSON.stringify(newSalesComponents)}
					/>
					<input type="hidden" name="name" value={newSalesName} />
					<input type="hidden" name="salePrice" value={newSalesPrice} />
					<input type="hidden" name="description" value={newSalesDescription} />
					{#if newSalesIsShortcut}
						<input type="hidden" name="isShortcut" value="true" />
					{/if}

					<div class="p-6">
						{#if newSalesStep === 1}
							<!-- PASO 1: Nombre y Componentes -->
							<div class="space-y-4">
								<div class="space-y-2">
									<Label for="sp-step-name">Nombre Comercial</Label>
									<Input
										id="sp-step-name"
										bind:value={newSalesName}
										placeholder="Ej. Torta Selva Negra o Combo Cumpleaños"
										class="h-11 text-base font-medium"
										required
										autofocus
									/>
								</div>

								<div class="space-y-2.5 rounded-xl border border-border bg-muted/20 p-3.5">
									<div class="flex items-center justify-between">
										<Label class="text-xs font-semibold text-foreground">
											Ítem de Inventario que Descuenta
										</Label>
										{#if !newSalesIsCombo}
											<button
												type="button"
												onclick={() => (newSalesIsCombo = true)}
												class="text-xs font-medium text-primary hover:underline"
											>
												+ Es un combo
											</button>
										{/if}
									</div>

									<div class="space-y-2">
										{#each newSalesComponents as comp, idx (idx)}
											{@const selectedItem = linkableItems.find((i) => i.id === comp.itemId)}
											<div class="flex items-center gap-2 rounded-lg border border-border bg-background p-2">
												<div class="min-w-0 flex-1">
													<select
														aria-label="Ítem {idx + 1}"
														bind:value={comp.itemId}
														onchange={() => {
															if (newSalesComponents.length === 1 && !newSalesName) {
																const found = linkableItems.find((i) => i.id === comp.itemId);
																if (found) newSalesName = found.name;
															}
														}}
														class="flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-2xs"
														required
													>
														{#each linkableItems as candidate (candidate.id)}
															<option value={candidate.id}>
																[{candidate.code}] {candidate.name} ({ITEM_TYPE_LABELS[candidate.type]} · {candidate.currentStock} {candidate.baseUnit})
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
														class="h-9 w-18 text-right font-mono text-xs"
														required
													/>
													<span class="w-7 text-[11px] text-muted-foreground">
														{selectedItem?.baseUnit ?? 'u'}
													</span>
												</div>

												{#if newSalesComponents.length > 1}
													<Button
														type="button"
														size="icon"
														variant="ghost"
														class="size-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
														onclick={() => removeNewSalesComponentLine(idx)}
													>
														<Trash2 class="size-3.5" />
													</Button>
												{/if}
											</div>
										{/each}

										{#if newSalesIsCombo}
											<Button
												type="button"
												variant="outline"
												size="sm"
												class="w-full text-xs"
												onclick={addNewSalesComponentLine}
											>
												<Plus class="size-3.5" />
												<span>Agregar otro ítem al combo</span>
											</Button>
										{/if}
									</div>
								</div>
							</div>
						{:else}
							<!-- PASO 2: Precio y Atajos -->
							<div class="space-y-4">
								<div class="space-y-2">
									<Label for="sp-step-price">Precio de Venta ($)</Label>
									<Input
										id="sp-step-price"
										type="number"
										step="any"
										min="0"
										bind:value={newSalesPrice}
										class="h-11 font-mono text-xl font-bold"
										placeholder="0.00"
										required
										autofocus
									/>
								</div>

								<!-- Resumen de Costo y Margen -->
								<div class="rounded-xl border border-border bg-muted/30 p-3.5 text-xs space-y-1.5">
									<div class="flex items-center justify-between">
										<span class="text-muted-foreground">Costo estimado:</span>
										<span class="font-mono font-semibold text-foreground">
											{formatCurrency(estimatedCost)}
										</span>
									</div>
									<div class="flex items-center justify-between">
										<span class="text-muted-foreground">Margen proyectado:</span>
										<span
											class="font-mono font-semibold {newSalesPrice - estimatedCost >= 0
												? 'text-emerald-600'
												: 'text-destructive'}"
										>
											{formatCurrency(newSalesPrice - estimatedCost)}
											{#if newSalesPrice > 0}
												({Math.round(((newSalesPrice - estimatedCost) / newSalesPrice) * 100)}%)
											{/if}
										</span>
									</div>
								</div>

								<label class="flex items-center gap-2.5 rounded-xl border border-border bg-muted/20 p-3 cursor-pointer">
									<input
										type="checkbox"
										bind:checked={newSalesIsShortcut}
										class="size-4 rounded border-input text-amber-500 focus:ring-amber-500"
									/>
									<span class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
										<Star class="size-3.5 {newSalesIsShortcut ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'}" />
										Fijar como atajo rápido en la pantalla de ventas
									</span>
								</label>

								<div class="space-y-1.5">
									<Label for="sp-step-desc">Descripción (opcional)</Label>
									<Input
										id="sp-step-desc"
										bind:value={newSalesDescription}
										placeholder="Ej. Incluye vela y cartel"
										class="h-9 text-xs"
									/>
								</div>
							</div>
						{/if}
					</div>

					<!-- Footer del Wizard -->
					<div class="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-4">
						{#if newSalesStep === 1}
							<Button
								type="button"
								variant="outline"
								onclick={handleClose}
							>
								Cancelar
							</Button>
							<Button
								type="button"
								disabled={!newSalesName.trim()}
								onclick={() => (newSalesStep = 2)}
							>
								Siguiente →
							</Button>
						{:else}
							<Button
								type="button"
								variant="outline"
								onclick={() => (newSalesStep = 1)}
							>
								← Atrás
							</Button>
							<Button type="submit">
								<Check class="size-4" />
								<span>Guardar Producto</span>
							</Button>
						{/if}
					</div>
				</form>
			{/if}
		</div>
	</div>
{/if}
