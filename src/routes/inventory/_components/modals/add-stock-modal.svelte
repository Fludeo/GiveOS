<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Item } from '#lib/features/items/domain/item.entity';
	import { getDirectUnitCost } from '#lib/features/items/domain/item.entity';
	import { Button } from '#lib/components/ui/button';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import X from '@lucide/svelte/icons/x';
	import PackagePlus from '@lucide/svelte/icons/package-plus';
	import History from '@lucide/svelte/icons/history';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { formatCurrency, formatDate, getDaysAgo } from '../utils';

	interface Props {
		open: boolean;
		item: Item | null;
		businessId: string;
		estimatedUnitCost?: number;
		onClose: () => void;
	}

	let { open = $bindable(), item, businessId, estimatedUnitCost = 0, onClose }: Props = $props();

	let stockIntakeQty = $state<number | ''>('');
	let stockIntakeTotalCost = $state<number | ''>('');
	let stockIntakeSupplier = $state('');
	let stockIntakeNotes = $state('');
	let isSubmittingStock = $state(false);

	$effect(() => {
		if (open) {
			stockIntakeQty = '';
			stockIntakeTotalCost = '';
			stockIntakeSupplier = '';
			stockIntakeNotes = '';
			isSubmittingStock = false;
		}
	});

	function handleClose() {
		open = false;
		onClose();
	}

	const calculatedIntakeUnitCost = $derived.by(() => {
		const qty = Number(stockIntakeQty);
		const cost = Number(stockIntakeTotalCost);
		if (qty > 0 && cost >= 0) {
			return cost / qty;
		}
		return 0;
	});
</script>

{#if open && item}
	{@const batches = item.batches ?? []}
	{@const activeBatches = batches.filter((b) => b.remainingQuantity > 0)}
	{@const oldestActive = activeBatches.length > 0 ? activeBatches[0] : null}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
		role="dialog"
		aria-modal="true"
	>
		<div class="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
			<!-- Encabezado del Modal -->
			<div class="flex items-start justify-between gap-4 border-b border-border p-6 pb-4">
				<div class="space-y-1">
					<div class="flex items-center gap-2">
						<span class="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-tight {item.type === 'raw_material' ? 'border border-tertiary/40 bg-tertiary/20 text-yellow-900 dark:text-yellow-300' : 'bg-muted text-muted-foreground'}">
							{item.code}
						</span>
						<span class="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
							{item.type === 'raw_material' ? 'Insumo' : 'Elaboración'}
						</span>
					</div>
					<h2 class="text-xl font-bold text-foreground">
						Cargar Stock: {item.name}
					</h2>
					<p class="text-xs text-muted-foreground">
						{#if item.type === 'raw_material'}
							Ingresa la cantidad comprada y el costo total abonado. El sistema actualizará el stock y calculará el costo unitario ponderado.
						{:else}
							Ingresa la cantidad producida. Se actualizará el stock de esta elaboración y se descontarán los ingredientes de la receta según el stock disponible.
						{/if}
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

			<!-- Contenido con scroll -->
			<div class="flex-1 space-y-5 overflow-y-auto p-6">
				<!-- Métricas Rápidas del Ítem -->
				<div class="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/20 p-3.5 sm:grid-cols-4">
					<div>
						<span class="text-[11px] font-medium text-muted-foreground">Stock Actual</span>
						<p class="font-mono text-base font-bold text-foreground">
							{item.currentStock} <span class="text-xs font-normal text-muted-foreground">{item.baseUnit}</span>
						</p>
					</div>
					<div>
						<span class="text-[11px] font-medium text-muted-foreground">Costo Unit.</span>
						<p class="font-mono text-base font-bold text-foreground">
							{#if item.type === 'raw_material'}
								{formatCurrency(getDirectUnitCost(item))}
							{:else}
								{formatCurrency(estimatedUnitCost)}
							{/if}
						</p>
						<p class="text-[10px] text-muted-foreground">
							{item.type === 'raw_material' ? `por ${item.baseUnit}` : 'por receta'}
						</p>
					</div>
					<div>
						<span class="text-[11px] font-medium text-muted-foreground">{item.type === 'raw_material' ? 'Lotes Activos' : 'Lotes Registrados'}</span>
						<p class="font-mono text-base font-bold text-foreground">
							{activeBatches.length} <span class="text-xs font-normal text-muted-foreground">({batches.length} hist.)</span>
						</p>
					</div>
					<div>
						<span class="text-[11px] font-medium text-muted-foreground">{item.type === 'raw_material' ? 'Lote más Antiguo' : 'Última Carga'}</span>
						{#if item.type === 'raw_material'}
							{#if oldestActive}
								<p class="text-xs font-semibold text-foreground">
									{getDaysAgo(oldestActive.createdAt)}
								</p>
								<p class="text-[10px] text-muted-foreground">1º en rotación</p>
							{:else}
								<p class="text-xs text-muted-foreground">Sin stock previo</p>
							{/if}
						{:else}
							{#if batches.length > 0}
								{@const latestBatch = batches[batches.length - 1]}
								<p class="text-xs font-semibold text-foreground">
									{formatDate(latestBatch.createdAt)}
								</p>
								<p class="text-[10px] text-muted-foreground">{getDaysAgo(latestBatch.createdAt)}</p>
							{:else}
								<p class="text-xs text-muted-foreground">Sin elaboraciones previas</p>
							{/if}
						{/if}
					</div>
				</div>

				<!-- Formulario de Entrada de Stock -->
				<form
					id="add-stock-form"
					method="POST"
					action="?/addStockBatch"
					class="space-y-4"
					use:enhance={() => {
						isSubmittingStock = true;
						return async ({ result, update }) => {
							await update();
							isSubmittingStock = false;
							if (result.type === 'success') {
								handleClose();
							}
						};
					}}
				>
					<input type="hidden" name="businessId" value={businessId} />
					<input type="hidden" name="id" value={item.id} />

					<div class="grid grid-cols-1 gap-4 {item.type === 'raw_material' ? 'sm:grid-cols-2' : ''}">
						<!-- Cantidad Comprada / Producida -->
						<div class="space-y-1.5">
							<Label for="stock-intake-qty" class="font-semibold text-foreground">
								{item.type === 'raw_material' ? 'Cantidad Comprada' : 'Cantidad Producida'} ({item.baseUnit}) *
							</Label>
							<Input
								id="stock-intake-qty"
								name="quantity"
								type="number"
								step="any"
								min="0.001"
								bind:value={stockIntakeQty}
								placeholder="Ej. 5"
								class="h-10 font-mono text-base"
								required
							/>
							<p class="text-[11px] text-muted-foreground">
								En la unidad base ({item.baseUnit}).
							</p>
						</div>

						{#if item.type === 'raw_material'}
							<!-- Costo Total Pagado (sólo insumos) -->
							<div class="space-y-1.5">
								<Label for="stock-intake-cost" class="font-semibold text-foreground">
									Costo Total Abonado ($) *
								</Label>
								<div class="relative flex items-center">
									<span class="pointer-events-none absolute left-3 font-bold text-muted-foreground">$</span>
									<Input
										id="stock-intake-cost"
										name="totalCost"
										type="number"
										step="any"
										min="0"
										bind:value={stockIntakeTotalCost}
										placeholder="0.00"
										class="h-10 pl-7 font-mono text-base"
										required
									/>
								</div>
								<p class="text-[11px] text-muted-foreground">
									Total pagado por el lote completo de insumo.
								</p>
							</div>
						{/if}
					</div>

					<!-- Banner en Vivo: Costo Resultante (sólo insumos) -->
					{#if item.type === 'raw_material' && calculatedIntakeUnitCost > 0}
						<div class="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5">
							<div class="space-y-0.5">
								<span class="text-xs font-semibold text-primary">Costo Unitario Calculado</span>
								<p class="font-mono text-lg font-extrabold text-foreground">
									{formatCurrency(calculatedIntakeUnitCost)} <span class="text-xs font-normal text-muted-foreground">/ {item.baseUnit}</span>
								</p>
							</div>
							{#if item.baseUnit === 'g'}
								<div class="text-right">
									<span class="text-[11px] font-medium text-muted-foreground">Equivalente por Kilo</span>
									<p class="font-mono text-sm font-bold text-foreground">
										{formatCurrency(calculatedIntakeUnitCost * 1000)} / kg
									</p>
								</div>
							{:else if item.baseUnit === 'ml'}
								<div class="text-right">
									<span class="text-[11px] font-medium text-muted-foreground">Equivalente por Litro</span>
									<p class="font-mono text-sm font-bold text-foreground">
										{formatCurrency(calculatedIntakeUnitCost * 1000)} / l
									</p>
								</div>
							{/if}
						</div>
					{/if}

					<div class="grid grid-cols-1 gap-4 {item.type === 'raw_material' ? 'sm:grid-cols-2' : ''}">
						{#if item.type === 'raw_material'}
							<div class="space-y-1.5">
								<Label for="stock-intake-supplier" class="font-medium text-foreground">
									Proveedor (opcional)
								</Label>
								<Input
									id="stock-intake-supplier"
									name="supplier"
									type="text"
									bind:value={stockIntakeSupplier}
									placeholder="Ej. Molinos Río de la Plata"
									class="h-9 text-xs"
								/>
							</div>
						{/if}

						<div class="space-y-1.5">
							<Label for="stock-intake-notes" class="font-medium text-foreground">
								{item.type === 'raw_material' ? 'Comprobante / Lote / Notas (opcional)' : 'Lote / Notas de producción (opcional)'}
							</Label>
							<Input
								id="stock-intake-notes"
								name="notes"
								type="text"
								bind:value={stockIntakeNotes}
								placeholder={item.type === 'raw_material' ? 'Ej. Factura A-1234 o Vto 10/2026' : 'Ej. Tanda mañana, lote #4'}
								class="h-9 text-xs"
							/>
						</div>
					</div>
				</form>

				<!-- Historial de Cargas de Stock -->
				<div class="space-y-2.5 border-t border-border/60 pt-3">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<History class="size-4 text-muted-foreground" />
							<h3 class="text-sm font-bold text-foreground">
								Historial de Cargas de Stock
							</h3>
						</div>
						<span class="text-xs text-muted-foreground">
							{activeBatches.length} {activeBatches.length === 1 ? 'lote en existencia' : 'lotes en existencia'}
						</span>
					</div>

					{#if batches.length > 0}
						<div class="space-y-2">
							{#each batches.slice().reverse() as batch (batch.id)}
								{@const isOldestActive = oldestActive && batch.id === oldestActive.id}
								{@const isExhausted = batch.remainingQuantity <= 0}
								<div
									class="rounded-xl border p-3 transition-colors {isOldestActive
										? 'border-primary/50 bg-primary/5 ring-1 ring-primary/30'
										: isExhausted
											? 'border-border/40 bg-muted/10 opacity-55'
											: 'border-border bg-card'}"
								>
									<div class="flex flex-wrap items-center justify-between gap-2">
										<div class="flex items-center gap-2">
											<span class="font-mono text-xs font-semibold text-foreground">
												{formatDate(batch.createdAt)}
											</span>
											<span class="text-xs text-muted-foreground">
												({getDaysAgo(batch.createdAt)})
											</span>
											{#if isOldestActive}
												<span class="rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
													1º en rotación
												</span>
											{:else if isExhausted}
												<span class="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
													Agotado
												</span>
											{:else}
												<span class="rounded-full border border-secondary/30 bg-secondary/15 px-2 py-0.5 text-[10px] font-medium text-secondary">
													En cola
												</span>
											{/if}
										</div>

										<div class="flex items-center gap-3">
											<div class="text-right">
												<p class="font-mono text-xs font-bold text-foreground">
													{batch.remainingQuantity} / {batch.initialQuantity} {item.baseUnit}
												</p>
												<p class="font-mono text-[11px] text-muted-foreground">
													{formatCurrency(batch.unitCost)} / {item.baseUnit}
												</p>
											</div>

											<!-- Botón para eliminar carga si hubo equivocación -->
											<form
												method="POST"
												action="?/deleteStockBatch"
												use:enhance={() => {
													return async ({ update }) => {
														await update();
													};
												}}
											>
												<input type="hidden" name="businessId" value={businessId} />
												<input type="hidden" name="id" value={item.id} />
												<input type="hidden" name="batchId" value={batch.id} />
												<Button
													type="submit"
													size="icon"
													variant="ghost"
													class="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
													title="Eliminar esta carga de stock"
													onclick={(e) => {
														if (
															!confirm(
																`¿Eliminar esta carga de ${batch.remainingQuantity} ${item.baseUnit}? Se descontará del stock actual y se recalculará el costo.`
															)
														) {
															e.preventDefault();
														}
													}}
												>
													<Trash2 class="size-3.5" />
												</Button>
											</form>
										</div>
									</div>

									{#if batch.supplier || batch.notes}
										<div class="mt-2 flex flex-wrap items-center gap-2 border-t border-border/40 pt-1.5 text-[11px] text-muted-foreground">
											{#if batch.supplier}
												<span class="font-medium text-foreground/80">Prov: {batch.supplier}</span>
											{/if}
											{#if batch.notes}
												<span>· {batch.notes}</span>
											{/if}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{:else}
						<div class="rounded-xl border border-dashed border-border p-6 text-center">
							<p class="text-xs text-muted-foreground">
								{item.type === 'raw_material'
									? 'Aún no hay compras registradas para este insumo. Al ingresar la primera carga, quedará documentada con su fecha y costo unitario.'
									: 'Aún no hay registros de elaboración. Al cargar stock de producción, quedará registrado con la fecha y cantidad producida.'}
							</p>
						</div>
					{/if}
				</div>
			</div>

			<!-- Acciones del Modal -->
			<div class="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-4">
				<Button
					type="button"
					variant="outline"
					onclick={handleClose}
					disabled={isSubmittingStock}
				>
					Cancelar
				</Button>
				<Button
					type="submit"
					form="add-stock-form"
					disabled={isSubmittingStock || !stockIntakeQty || Number(stockIntakeQty) <= 0 || (item.type === 'raw_material' && (!stockIntakeTotalCost || Number(stockIntakeTotalCost) < 0))}
				>
					<PackagePlus class="mr-1.5 size-4" />
					<span>{isSubmittingStock ? 'Registrando...' : (item.type === 'raw_material' ? 'Registrar Carga de Stock' : 'Registrar Elaboración')}</span>
				</Button>
			</div>
		</div>
	</div>
{/if}
