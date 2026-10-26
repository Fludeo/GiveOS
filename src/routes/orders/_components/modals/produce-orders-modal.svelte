<script lang="ts">
	import { enhance } from '$app/forms';
	import type {
		OrderWithItems,
		SalesProductWithItems
	} from '#lib/features/orders/domain/order.entity';
	import { Button } from '#lib/components/ui/button';
	import { Badge } from '#lib/components/ui/badge';
	import ChefHat from '@lucide/svelte/icons/chef-hat';
	import Check from '@lucide/svelte/icons/check';
	import Sparkles from '@lucide/svelte/icons/sparkles';
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

	$effect(() => {
		if (orders && orders.length > 0) {
			selectedIds = orders.map((o) => o.id);
			useDisplayStock = false;
			isSubmitting = false;
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
					if (sp && sp.components.length === 1 && sp.components[0].item) {
						const comp = sp.components[0];
						displayStock = Math.floor(
							(comp.item?.currentStock ?? 0) / (comp.quantity || 1)
						);
					}
					map.set(line.salesProductId, {
						salesProductId: line.salesProductId,
						productName: line.productName,
						totalQty: line.quantity,
						ordersCount: 1,
						availableDisplayStock: displayStock
					});
				}
			}
		}

		return Array.from(map.values());
	});
</script>

{#if orders.length > 0}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
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
								Hoja de Producción en 1 Clic
							</h2>
							<Badge variant="outline" class="text-[10px] border-primary/30 bg-primary/10 text-primary">
								{periodLabel}
							</Badge>
						</div>
						<p class="text-xs text-muted-foreground">
							Descuenta los insumos y sub-ensambles ahora y marca los pedidos como <strong>Listos para entregar</strong>.
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
			<div class="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
				<!-- 1. Selección de Pedidos a Producir -->
				<div class="space-y-2.5">
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							1. Pedidos a Marcar como Listos ({selectedOrders.length} de {orders.length})
						</span>
						{#if orders.length > 1}
							<button
								type="button"
								onclick={toggleAll}
								class="text-xs font-semibold text-primary hover:underline cursor-pointer"
							>
								{selectedIds.length === orders.length ? 'Desmarcar todos' : 'Seleccionar todos'}
							</button>
						{/if}
					</div>

					<div class="max-h-44 space-y-1.5 overflow-y-auto rounded-xl border border-border bg-muted/15 p-2.5">
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
									{pendingItems.reduce((acc, i) => acc + i.quantity, 0)} un.
								</span>
							</label>
						{/each}
					</div>
				</div>

				<!-- 2. Consolidado de Productos a Terminar -->
				<div class="space-y-2.5">
					<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
						2. Consolidado de Productos a Elaborar
					</span>

					{#if consolidatedProducts.length === 0}
						<div class="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
							Selecciona al menos un pedido para ver los productos a producir.
						</div>
					{:else}
						<div class="divide-y divide-border/60 rounded-xl border border-border bg-card">
							{#each consolidatedProducts as prod (prod.salesProductId)}
								<div class="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs">
									<div class="flex items-center gap-2 min-w-0">
										<span class="rounded bg-primary/10 px-2 py-0.5 font-mono font-bold text-primary shrink-0">
											{prod.totalQty}x
										</span>
										<span class="font-semibold text-foreground truncate">
											{prod.productName}
										</span>
									</div>
									{#if prod.availableDisplayStock !== null && prod.availableDisplayStock > 0}
										<span class="rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground shrink-0">
											En estantería: {prod.availableDisplayStock}
										</span>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- 3. Modo de Descuento de Stock -->
				<label
					class="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-3.5 text-xs cursor-pointer hover:bg-muted/30 transition-colors"
				>
					<input
						type="checkbox"
						bind:checked={useDisplayStock}
						class="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
					/>
					<div class="space-y-0.5">
						<div class="flex items-center gap-1.5 font-semibold text-foreground">
							<Store class="size-3.5 text-secondary" />
							<span>Tomar primero del stock disponible en Estantería / Vidriera</span>
						</div>
						<p class="text-[11px] text-muted-foreground leading-relaxed">
							Por defecto está desactivado para <strong>proteger tu vidriera</strong> y descontar los sub-ensambles e insumos de taller/cocina. Actívalo solo si vas a separar unidades que ya tenías exhibidas.
						</p>
					</div>
				</label>
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
					use:enhance={() => {
						isSubmitting = true;
						return async ({ result, update }) => {
							await update();
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
								: `Confirmar Producción (${selectedIds.length} ${selectedIds.length === 1 ? 'pedido' : 'pedidos'})`}
						</span>
					</Button>
				</form>
			</div>
		</div>
	</div>
{/if}
