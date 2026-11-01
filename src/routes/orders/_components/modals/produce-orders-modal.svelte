<script lang="ts">
	import { enhance } from '$app/forms';
	import type {
		OrderWithItems,
		SalesProductWithItems
	} from '#lib/features/orders/domain/order.entity';
	import { Button } from '#lib/components/ui/button';
	import { Badge } from '#lib/components/ui/badge';
	import ChefHat from '@lucide/svelte/icons/chef-hat';
	import Store from '@lucide/svelte/icons/store';
	import X from '@lucide/svelte/icons/x';
	import PackageCheck from '@lucide/svelte/icons/package-check';
	import { toast } from '#lib/components/ui/toast';

	interface Props {
		orders: OrderWithItems[];
		salesProducts?: SalesProductWithItems[];
		businessId: string;
		periodLabel?: string;
		onClose: () => void;
	}

	let {
		orders,
		salesProducts = [],
		businessId,
		periodLabel = 'Seleccionados',
		onClose
	}: Props = $props();

	let selectedIds = $state<string[]>([]);
	let useDisplayStock = $state(false);
	let isSubmitting = $state(false);
	let customProducedByProduct = $state<Record<string, number>>({});

	$effect(() => {
		if (orders && orders.length > 0) {
			selectedIds = orders.map((o) => o.id);
			useDisplayStock = false;
			isSubmitting = false;
			customProducedByProduct = {};
		}
	});

	function toggleOrder(id: string) {
		if (selectedIds.includes(id)) {
			selectedIds = selectedIds.filter((i) => i !== id);
		} else {
			selectedIds = [...selectedIds, id];
		}
	}

	function toggleAll() {
		if (selectedIds.length === orders.length) {
			selectedIds = [];
		} else {
			selectedIds = orders.map((o) => o.id);
		}
	}

	const selectedOrders = $derived(orders.filter((o) => selectedIds.includes(o.id)));

	const consolidatedProducts = $derived.by(() => {
		const map = new Map<
			string,
			{
				salesProductId: string;
				productName: string;
				totalQty: number;
				ordersCount: number;
				availableDisplayStock: number | null;
				itemId: string | null;
				componentMultiplier: number;
				recipeStep: number;
			}
		>();

		const spMap = new Map(salesProducts.map((sp) => [sp.id, sp]));

		for (const order of selectedOrders) {
			for (const line of order.items) {
				if (line.status !== 'pending_delivery') continue;
				const existing = map.get(line.salesProductId);
				if (existing) {
					existing.totalQty += line.quantity;
					existing.ordersCount += 1;
				} else {
					const sp = spMap.get(line.salesProductId);
					let displayStock: number | null = null;
					let itemId: string | null = null;
					let componentMultiplier = 1;
					let recipeStep = 1;
					if (sp && sp.components.length === 1 && sp.components[0].item) {
						const comp = sp.components[0];
						const compItem = comp.item!;
						componentMultiplier = comp.quantity || 1;
						displayStock = Math.floor(
							(compItem.currentStock ?? 0) / componentMultiplier
						);
						if (compItem.type === 'prepared') {
							itemId = compItem.id;
							const rawYield =
								compItem.yieldQuantity && compItem.yieldQuantity > 0
									? compItem.yieldQuantity
									: 1;
							recipeStep = Math.max(1, Number((rawYield / componentMultiplier).toFixed(2)));
						}
					}
					map.set(line.salesProductId, {
						salesProductId: line.salesProductId,
						productName: line.productName,
						totalQty: line.quantity,
						ordersCount: 1,
						availableDisplayStock: displayStock,
						itemId,
						componentMultiplier,
						recipeStep
					});
				}
			}
		}

		return Array.from(map.values());
	});

	function getTakenFromDisplay(prod: (typeof consolidatedProducts)[number]): number {
		if (!useDisplayStock || !prod.availableDisplayStock || prod.availableDisplayStock <= 0) {
			return 0;
		}
		return Math.min(prod.totalQty, prod.availableDisplayStock);
	}

	function getMinKitchenQty(prod: (typeof consolidatedProducts)[number]): number {
		return Math.max(0, prod.totalQty - getTakenFromDisplay(prod));
	}

	function getSuggestedBatchQty(minQty: number, step: number): number {
		if (minQty <= 0 || step <= 1) return minQty;
		return Math.max(step, Math.ceil(minQty / step) * step);
	}

	function getProducedQty(prod: (typeof consolidatedProducts)[number]): number {
		const minQty = getMinKitchenQty(prod);
		const custom = customProducedByProduct[prod.salesProductId];
		if (custom === undefined || Number.isNaN(custom) || custom < minQty) {
			return minQty;
		}
		return custom;
	}

	function setProducedQty(salesProductId: string, minQty: number, val: number) {
		const clamped = Math.max(minQty, Number.isFinite(val) ? val : minQty);
		customProducedByProduct = {
			...customProducedByProduct,
			[salesProductId]: clamped
		};
	}

	const hasAnyDisplayStock = $derived(
		consolidatedProducts.some((p) => (p.availableDisplayStock ?? 0) > 0)
	);

	const extraStockMap = $derived.by(() => {
		const extra: Record<string, number> = {};
		for (const prod of consolidatedProducts) {
			if (!prod.itemId) continue;
			const minQty = getMinKitchenQty(prod);
			const actual = getProducedQty(prod);
			const diff = actual - minQty;
			if (diff > 0) {
				extra[prod.itemId] = (extra[prod.itemId] ?? 0) + diff * prod.componentMultiplier;
			}
		}
		return extra;
	});
</script>

{#if orders.length > 0}
	<div
		class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 p-0 sm:p-4 backdrop-blur-[1px]"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="flex max-h-[92vh] sm:max-h-[90vh] w-full max-w-full sm:max-w-xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border-t sm:border border-border bg-card shadow-2xl"
		>
			<!-- Header -->
			<div class="flex items-start justify-between gap-4 border-b border-border bg-muted/20 p-5 sm:p-6">
				<div class="flex items-start gap-3">
					<div
						class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
					>
						<ChefHat class="size-5" />
					</div>
					<div class="space-y-1">
						<div class="flex items-center gap-2">
							<h2 class="text-base sm:text-lg font-bold text-foreground">
								Producir y Marcar como Listo
							</h2>
							<Badge variant="outline" class="text-[10px] border-primary/30 bg-primary/10 text-primary">
								{periodLabel}
							</Badge>
						</div>
						<p class="text-xs text-muted-foreground">
							Descuenta los insumos de la receta y deja el pedido <strong>Listo para entregar</strong>.
						</p>
					</div>
				</div>
				<Button
					type="button"
					size="icon"
					variant="ghost"
					class="size-8 text-muted-foreground hover:text-foreground"
					onclick={onClose}
				>
					<X class="size-4" />
				</Button>
			</div>

			<!-- Body -->
			<div class="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
				<!-- Selección de Pedidos (solo muestra checkboxes si son varios pedidos) -->
				{#if orders.length === 1}
					{@const singleOrder = orders[0]}
					{@const pendingItems = singleOrder.items.filter((i) => i.status === 'pending_delivery')}
					<div class="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3 text-xs">
						<div class="flex items-center gap-2.5 min-w-0">
							<span class="rounded bg-primary/10 px-2 py-0.5 font-mono font-bold text-primary shrink-0">
								{singleOrder.orderNumber}
							</span>
							<span class="font-semibold text-foreground truncate">
								{singleOrder.customerName}
							</span>
						</div>
						<span class="font-mono text-xs font-medium text-muted-foreground shrink-0">
							{pendingItems.reduce((acc, i) => acc + i.quantity, 0)} u. en total
						</span>
					</div>
				{:else}
					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Pedidos incluidos ({selectedOrders.length} de {orders.length})
							</span>
							<button
								type="button"
								onclick={toggleAll}
								class="text-xs font-semibold text-primary hover:underline cursor-pointer"
							>
								{selectedIds.length === orders.length ? 'Desmarcar todos' : 'Seleccionar todos'}
							</button>
						</div>

						<div class="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-border bg-muted/15 p-2.5">
							{#each orders as order (order.id)}
								{@const isChecked = selectedIds.includes(order.id)}
								{@const pendingItems = order.items.filter((i) => i.status === 'pending_delivery')}
								<label
									class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs transition-colors cursor-pointer {isChecked
										? 'border-primary/40 bg-card shadow-2xs'
										: 'border-transparent bg-transparent opacity-60 hover:bg-card/50'}"
								>
									<div class="flex items-center gap-2.5 min-w-0">
										<input
											type="checkbox"
											checked={isChecked}
											onchange={() => toggleOrder(order.id)}
											class="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
										/>
										<span class="font-mono font-bold text-foreground shrink-0">
											{order.orderNumber}
										</span>
										<span class="font-semibold text-foreground truncate">
											{order.customerName}
										</span>
									</div>
									<span class="font-mono text-[11px] text-muted-foreground shrink-0">
										{pendingItems.reduce((acc, i) => acc + i.quantity, 0)} u.
									</span>
								</label>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Opción de usar Stock de Vidriera (si hay unidades exhibidas) -->
				{#if hasAnyDisplayStock}
					<label
						class="flex items-start gap-3 rounded-xl border p-3.5 text-xs cursor-pointer transition-colors {useDisplayStock
							? 'border-primary/40 bg-primary/5'
							: 'border-border bg-muted/15 hover:bg-muted/25'}"
					>
						<input
							type="checkbox"
							bind:checked={useDisplayStock}
							onchange={() => {
								customProducedByProduct = {};
							}}
							class="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
						/>
						<div class="space-y-0.5">
							<div class="flex items-center gap-1.5 font-semibold text-foreground">
								<Store class="size-3.5 text-primary" />
								<span>Usar unidades ya listas en Vidriera / Stock disponible</span>
							</div>
							<p class="text-[11px] text-muted-foreground leading-relaxed">
								{#if useDisplayStock}
									Se descontarán primero las unidades que ya tienes en stock y solo se producirá en cocina lo que falte.
								{:else}
									Desactivado: no toca el stock de tu vidriera y descuenta los ingredientes de cocina para producir el pedido desde cero.
								{/if}
							</p>
						</div>
					</label>
				{/if}

				<!-- Detalle de productos a preparar -->
				<div class="space-y-2">
					<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
						Detalle de Producción
					</span>

					{#if consolidatedProducts.length === 0}
						<div class="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
							Selecciona al menos un pedido para ver los productos a producir.
						</div>
					{:else}
						<div class="divide-y divide-border/60 rounded-xl border border-border bg-card">
							{#each consolidatedProducts as prod (prod.salesProductId)}
								{@const takenFromDisplay = getTakenFromDisplay(prod)}
								{@const minKitchenQty = getMinKitchenQty(prod)}
								{@const actualQty = getProducedQty(prod)}
								{@const extraQty = Number((actualQty - minKitchenQty).toFixed(2))}
								{@const suggestedBatchQty = getSuggestedBatchQty(minKitchenQty, prod.recipeStep)}
								{@const batchesCount = prod.recipeStep > 1 ? Math.round((suggestedBatchQty / prod.recipeStep) * 10) / 10 : 1}

								<div class="p-3.5 space-y-3 text-xs">
									<div class="flex items-start justify-between gap-3">
										<div class="space-y-1 min-w-0">
											<p class="font-bold text-sm text-foreground truncate">
												{prod.productName}
											</p>
											<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
												<span>
													Pedido: <strong class="font-mono text-foreground">{prod.totalQty} u.</strong>
												</span>
												{#if prod.availableDisplayStock !== null && prod.availableDisplayStock > 0}
													<span>
														En vidriera: <strong class="font-mono text-foreground">{prod.availableDisplayStock} u.</strong>
													</span>
												{/if}
												{#if prod.recipeStep > 1}
													<span>
														1 tanda de receta = <strong class="font-mono text-foreground">{prod.recipeStep} u.</strong>
													</span>
												{/if}
											</div>
										</div>

										<!-- Control de cantidad a elaborar en cocina -->
										{#if prod.itemId}
											<div class="flex flex-col items-end gap-1 shrink-0">
												<span class="text-[10px] font-medium text-muted-foreground">
													Elaborar en cocina:
												</span>
												<div class="inline-flex items-center rounded-lg border border-border bg-background">
													<button
														type="button"
														onclick={() => setProducedQty(prod.salesProductId, minKitchenQty, actualQty - 1)}
														disabled={actualQty <= minKitchenQty}
														class="px-2.5 py-1 text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-40 cursor-pointer"
														title="Restar 1 unidad"
													>
														-
													</button>
													<input
														type="number"
														min={minKitchenQty}
														step="1"
														value={actualQty}
														oninput={(e) =>
															setProducedQty(
																prod.salesProductId,
																minKitchenQty,
																Number((e.currentTarget as HTMLInputElement).value)
															)}
														class="w-12 border-x border-border bg-transparent py-1 text-center font-mono text-xs font-bold text-foreground focus:outline-none"
													/>
													<button
														type="button"
														onclick={() => setProducedQty(prod.salesProductId, minKitchenQty, actualQty + 1)}
														class="px-2.5 py-1 text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
														title="Sumar 1 unidad (el excedente va a stock)"
													>
														+
													</button>
												</div>
											</div>
										{:else}
											<span class="font-mono font-bold text-foreground">{prod.totalQty} u.</span>
										{/if}
									</div>

									<!-- Resumen claro de qué ocurre con este producto -->
									<div class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/25 px-3 py-2 text-[11px]">
										<div class="space-y-0.5">
											{#if takenFromDisplay > 0}
												<p class="text-foreground">
													• Se separan <strong class="font-mono">{takenFromDisplay} u.</strong> de tu vidriera (quedarán <strong class="font-mono">{(prod.availableDisplayStock ?? 0) - takenFromDisplay} u.</strong> disponibles).
												</p>
											{/if}
											{#if actualQty > 0}
												<p class="text-foreground">
													• Se elaboran <strong class="font-mono">{actualQty} u.</strong> en cocina ({minKitchenQty} u. para el pedido{#if extraQty > 0} + <strong class="font-mono text-emerald-600 dark:text-emerald-400">{extraQty} u. sobrantes que se guardan en stock</strong>{/if}).
												</p>
											{:else if takenFromDisplay >= prod.totalQty}
												<p class="text-emerald-700 dark:text-emerald-400 font-medium">
													✓ Pedido cubierto 100% con el stock de vidriera (no requiere producir en cocina).
												</p>
											{/if}
										</div>

										<!-- Botón opcional para redondear a tandas completas de receta -->
										{#if prod.itemId && prod.recipeStep > 1 && suggestedBatchQty > minKitchenQty}
											{#if actualQty !== suggestedBatchQty}
												<button
													type="button"
													onclick={() => setProducedQty(prod.salesProductId, minKitchenQty, suggestedBatchQty)}
													class="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 font-medium text-[11px] text-primary hover:bg-primary/15 transition-colors cursor-pointer shrink-0"
												>
													Redondear a {batchesCount} {batchesCount === 1 ? 'tanda' : 'tandas'} ({suggestedBatchQty} u.)
												</button>
											{:else}
												<button
													type="button"
													onclick={() => setProducedQty(prod.salesProductId, minKitchenQty, minKitchenQty)}
													class="rounded-md border border-border bg-background px-2 py-1 font-medium text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
												>
													Producir solo lo justo ({minKitchenQty} u.)
												</button>
											{/if}
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<!-- Footer -->
			<div
				class="flex items-center justify-between gap-3 border-t border-border bg-muted/20 px-5 py-4 sm:px-6"
			>
				<Button type="button" variant="outline" size="sm" onclick={onClose} disabled={isSubmitting}>
					Cancelar
				</Button>

				<form
					method="POST"
					action="?/produceOrdersBatch"
					use:enhance={({ action }) => {
						if (typeof window !== 'undefined') {
							const currentUrl = new URL(window.location.href);
							for (const [k, v] of currentUrl.searchParams.entries()) {
								if (!action.searchParams.has(k)) {
									action.searchParams.set(k, v);
								}
							}
						}
						isSubmitting = true;
						return async ({ result, update }) => {
							await update({ reset: false });
							isSubmitting = false;
							if (result.type === 'success') {
								const msg =
									(result.data as { message?: string })?.message ??
									'Producción registrada con éxito.';
								toast.success('¡Producción completada!', msg);
								onClose();
							} else if (result.type === 'failure') {
								const err =
									(result.data as { error?: string })?.error ??
									'No se pudo registrar la producción.';
								toast.error('Error al producir', err);
							}
						};
					}}
				>
					<input type="hidden" name="businessId" value={businessId} />
					<input type="hidden" name="orderIdsJson" value={JSON.stringify(selectedIds)} />
					<input type="hidden" name="extraStockJson" value={JSON.stringify(extraStockMap)} />
					<input type="hidden" name="useDisplayStock" value={useDisplayStock ? 'true' : 'false'} />

					<Button
						type="submit"
						size="sm"
						class="gap-1.5 font-semibold"
						disabled={isSubmitting || selectedIds.length === 0}
					>
						<PackageCheck class="size-4" />
						<span>
							{isSubmitting
								? 'Procesando...'
								: orders.length === 1
									? 'Confirmar y Marcar Listo'
									: `Confirmar (${selectedIds.length} ${selectedIds.length === 1 ? 'pedido' : 'pedidos'})`}
						</span>
					</Button>
				</form>
			</div>
		</div>
	</div>
{/if}
