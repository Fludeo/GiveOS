<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		generateNextItemCode,
		UNITS_OF_MEASURE,
		UNIT_LABELS,
		type ItemType,
		type UnitOfMeasure
	} from '#lib/features/items/domain/item.entity';
	import { Button } from '#lib/components/ui/button';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import X from '@lucide/svelte/icons/x';
	import Wheat from '@lucide/svelte/icons/wheat';
	import GraphHub from '@lucide/svelte/icons/graph-hub';
	import Clock from '@lucide/svelte/icons/clock';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import Check from '@lucide/svelte/icons/check';

	interface Props {
		open: boolean;
		businessId: string;
		existingCodes: string[];
		initialType?: ItemType;
		onClose: () => void;
		onSuccess?: (createdId?: string) => void;
	}

	let {
		open = $bindable(),
		businessId,
		existingCodes,
		initialType = 'raw_material',
		onClose,
		onSuccess
	}: Props = $props();

	let newItemStep = $state<1 | 2 | 3>(1);
	let newItemType = $state<ItemType>('raw_material');
	let newItemInitialType = $state<ItemType>('raw_material');
	let newItemName = $state('');
	let newItemBaseUnit = $state<UnitOfMeasure>('g');
	let newItemMinStock = $state<number | ''>('');
	let newItemPrepTime = $state<number | ''>(0);
	let newItemNotes = $state('');

	$effect(() => {
		if (open) {
			newItemInitialType = initialType;
			newItemType = initialType;
			newItemStep = initialType === 'prepared' ? 2 : 1;
			newItemName = '';
			newItemBaseUnit = initialType === 'raw_material' ? 'g' : 'unit';
			newItemMinStock = '';
			newItemPrepTime = 0;
			newItemNotes = '';
		}
	});

	function handleClose() {
		open = false;
		onClose();
	}

	const nextAutoCode = $derived(generateNextItemCode(newItemType, existingCodes));
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
		role="dialog"
		aria-modal="true"
		aria-labelledby="inv-new-item-title"
	>
		<div class="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
			<!-- Header con Barra de Progreso y Paso -->
			<div class="border-b border-border p-5">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="rounded-full {newItemStep === 1 ? 'bg-muted text-muted-foreground' : newItemType === 'prepared' ? 'bg-secondary/15 text-secondary' : 'bg-tertiary/25 text-yellow-900 dark:text-yellow-300'} px-2.5 py-0.5 text-xs font-bold">
							{#if newItemInitialType === 'prepared'}
								Paso {newItemStep === 2 ? 1 : 2} de 2 · Elaboración
							{:else if newItemStep === 1}
								Paso 1 de 3
							{:else}
								Paso {newItemStep} de 3 · {newItemType === 'prepared' ? 'Elaboración' : 'Insumo'}
							{/if}
						</span>
						{#if newItemStep > 1}
							<span class="rounded-md px-2 py-0.5 text-xs font-mono font-semibold {newItemType === 'prepared' ? 'bg-secondary/15 text-secondary border border-secondary/30' : 'bg-tertiary/20 text-yellow-900 dark:text-yellow-300 border border-tertiary/40'}">
								{nextAutoCode}
							</span>
						{/if}
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

				<h2 id="inv-new-item-title" class="mt-3 text-lg font-bold text-foreground">
					{#if newItemStep === 1}
						¿Qué tipo de ítem vas a registrar?
					{:else if newItemStep === 2}
						{newItemInitialType === 'prepared' ? 'Nueva Elaboración: Nombre y unidad' : 'Nombre y unidad de medida'}
					{:else}
						Alerta de stock y notas
					{/if}
				</h2>

				<!-- Barra de progreso visual -->
				<div class="mt-3 flex gap-1.5">
					{#if newItemInitialType === 'prepared'}
						<div class="h-1 flex-1 rounded-full {newItemStep >= 2 ? 'bg-secondary' : 'bg-muted'}"></div>
						<div class="h-1 flex-1 rounded-full {newItemStep >= 3 ? 'bg-secondary' : 'bg-muted'}"></div>
					{:else}
						<div class="h-1 flex-1 rounded-full {newItemStep >= 1 ? 'bg-primary' : 'bg-muted'}"></div>
						<div class="h-1 flex-1 rounded-full {newItemStep >= 2 ? 'bg-primary' : 'bg-muted'}"></div>
						<div class="h-1 flex-1 rounded-full {newItemStep >= 3 ? 'bg-primary' : 'bg-muted'}"></div>
					{/if}
				</div>
			</div>

			<form
				method="POST"
				action="?/createItem"
				use:enhance={() => {
					return async ({ result, update }) => {
						await update();
						if (result.type === 'success') {
							handleClose();
							const createdId = (result.data as { createdItemId?: string } | undefined)?.createdItemId;
							if (onSuccess) onSuccess(createdId);
						}
					};
				}}
			>
				<input type="hidden" name="businessId" value={businessId} />
				<input type="hidden" name="type" value={newItemType} />
				<input type="hidden" name="name" value={newItemName} />
				<input type="hidden" name="baseUnit" value={newItemBaseUnit} />
				<input type="hidden" name="currentStock" value="0" />
				<input type="hidden" name="minStock" value={newItemMinStock} />
				<input type="hidden" name="referenceCost" value="0" />
				<input type="hidden" name="purchaseQuantity" value="1" />
				<input type="hidden" name="yieldQuantity" value="1" />
				<input type="hidden" name="prepTimeMinutes" value={newItemPrepTime} />
				<input type="hidden" name="notes" value={newItemNotes} />

				<div class="p-6">
					{#if newItemStep === 1}
						<!-- PASO 1: Selección de Tipo de Ítem -->
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<button
								type="button"
								onclick={() => {
									newItemType = 'raw_material';
									newItemBaseUnit = 'g';
									newItemStep = 2;
								}}
								class="group flex flex-col items-center justify-center rounded-2xl border-2 border-tertiary/60 bg-card p-6 text-center transition-all cursor-pointer hover:border-tertiary hover:bg-tertiary/10 hover:shadow-xs"
							>
								<div
									class="mb-3 flex size-14 items-center justify-center rounded-full bg-tertiary/20 text-yellow-900 dark:text-yellow-300 transition-transform group-hover:scale-105"
								>
									<Wheat class="size-7" />
								</div>
								<div class="flex items-center gap-1.5">
									<span class="text-base font-bold text-foreground">Insumo</span>
									<span class="rounded-md border border-tertiary/40 bg-tertiary/20 px-1.5 py-0.2 font-mono text-[10px] font-bold text-yellow-900 dark:text-yellow-300">INS</span>
								</div>
								<span class="mt-1 text-xs text-muted-foreground">Materia prima que compras (harina, huevos, azúcar...)</span>
							</button>

							<button
								type="button"
								onclick={() => {
									newItemType = 'prepared';
									newItemBaseUnit = 'unit';
									newItemStep = 2;
								}}
								class="group flex flex-col items-center justify-center rounded-2xl border-2 border-secondary/60 bg-card p-6 text-center transition-all cursor-pointer hover:border-secondary hover:bg-secondary/10 hover:shadow-xs"
							>
								<div
									class="mb-3 flex size-14 items-center justify-center rounded-full bg-secondary/15 text-secondary transition-transform group-hover:scale-105"
								>
									<GraphHub class="size-7" />
								</div>
								<div class="flex items-center gap-1.5">
									<span class="text-base font-bold text-foreground">Elaboración</span>
									<span class="rounded-md border border-secondary/30 bg-secondary/15 px-1.5 py-0.2 font-mono text-[10px] font-bold text-secondary">ELB</span>
								</div>
								<span class="mt-1 text-xs text-muted-foreground">Insumo o producto elaborado con insumos u otras elaboraciones.</span>
							</button>
						</div>
					{:else if newItemStep === 2}
						<!-- PASO 2: Nombre y Unidad -->
						<div class="space-y-4">
							<div class="space-y-2">
								<Label for="inv-step-name">Nombre del Ítem</Label>
								<Input
									id="inv-step-name"
									bind:value={newItemName}
									placeholder={newItemType === 'raw_material'
										? 'Ej. Harina 0000'
										: 'Ej. Bizcochuelo de Vainilla o Torta Selva Negra'}
									class="h-11 text-base font-medium"
									required
									autofocus
								/>
							</div>

							<div class="space-y-2">
								<Label for="inv-step-unit">Unidad de Medida</Label>
								<select
									id="inv-step-unit"
									bind:value={newItemBaseUnit}
									class="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
								>
									{#each UNITS_OF_MEASURE as u}
										<option value={u}>{UNIT_LABELS[u]}</option>
									{/each}
								</select>
							</div>

							{#if newItemType === 'prepared'}
								<div class="space-y-2">
									<Label for="inv-step-preptime">Tiempo Estimado de Elaboración (minutos)</Label>
									<div class="relative flex items-center">
										<Clock class="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
										<Input
											id="inv-step-preptime"
											type="number"
											min="0"
											step="1"
											bind:value={newItemPrepTime}
											class="h-11 pl-9 font-mono"
											placeholder="0 (ej. 60)"
										/>
									</div>
								</div>
							{/if}
						</div>
					{:else}
						<!-- PASO 3: Alerta y Notas -->
						<div class="space-y-4">
							<div class="space-y-1.5">
								<Label for="inv-step-min" class="flex items-center gap-1.5 font-semibold text-foreground">
									<AlertTriangle class="size-3.5 text-destructive" />
									<span>Aviso de Stock Mínimo (opcional)</span>
								</Label>
								<Input
									id="inv-step-min"
									type="number"
									step="any"
									min="0"
									bind:value={newItemMinStock}
									class="h-11 font-mono text-base"
									placeholder="0 (alerta al bajar de esta cantidad)"
								/>
								<p class="text-[11px] text-muted-foreground">
									{#if newItemType === 'raw_material'}
										Recibirás una alerta cuando las existencias desciendan por debajo de este valor. Podrás cargar stock y su costo en cualquier momento con el botón "Cargar Stock".
									{:else}
										El stock de esta elaboración aumentará automáticamente al cocinar lotes de su receta.
									{/if}
								</p>
							</div>

							<div class="space-y-1.5">
								<Label for="inv-step-notes">Notas (opcional)</Label>
								<Input
									id="inv-step-notes"
									bind:value={newItemNotes}
									placeholder="Proveedor, marca o detalle"
									class="h-9 text-xs"
								/>
							</div>
						</div>
					{/if}
				</div>

				<!-- Footer del Wizard -->
				<div class="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-4">
					{#if newItemStep === 1}
						<Button type="button" variant="outline" onclick={handleClose}>
							Cancelar
						</Button>
						<Button type="button" onclick={() => (newItemStep = 2)}>
							Siguiente →
						</Button>
					{:else if newItemStep === 2}
						<Button
							type="button"
							variant="outline"
							onclick={() => {
								if (newItemInitialType === 'prepared') {
									handleClose();
								} else {
									newItemStep = 1;
								}
							}}
						>
							{newItemInitialType === 'prepared' ? 'Cancelar' : '← Atrás'}
						</Button>
						<Button
							type="button"
							disabled={!newItemName.trim()}
							onclick={() => (newItemStep = 3)}
							variant={newItemType === 'prepared' ? 'secondary' : 'default'}
						>
							Siguiente →
						</Button>
					{:else}
						<Button type="button" variant="outline" onclick={() => (newItemStep = 2)}>
							← Atrás
						</Button>
						<Button
							type="submit"
							variant={newItemType === 'prepared' ? 'secondary' : 'default'}
						>
							<Check class="size-4" />
							<span>{newItemType === 'prepared' ? 'Guardar Elaboración' : 'Guardar Ítem'}</span>
						</Button>
					{/if}
				</div>
			</form>
		</div>
	</div>
{/if}
