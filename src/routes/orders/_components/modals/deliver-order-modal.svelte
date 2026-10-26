<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		isOrderReadyToDeliver,
		type OrderWithItems
	} from '#lib/features/orders/domain/order.entity';
	import { Button } from '#lib/components/ui/button';
	import Check from '@lucide/svelte/icons/check';
	import Store from '@lucide/svelte/icons/store';
	import PackageCheck from '@lucide/svelte/icons/package-check';
	import { toast } from '#lib/components/ui/toast';

	interface Props {
		order: OrderWithItems | null;
		businessId: string;
		onClose: () => void;
	}

	let { order, businessId, onClose }: Props = $props();

	let useDisplayStock = $state(false);
	let isSubmitting = $state(false);

	$effect(() => {
		if (order) {
			useDisplayStock = false;
			isSubmitting = false;
		}
	});

	const alreadyReady = $derived(order ? isOrderReadyToDeliver(order) : false);
</script>

{#if order}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
		>
			<div class="space-y-4 p-6">
				<div
					class="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"
				>
					<Check class="size-5" />
				</div>
				<div class="space-y-1.5">
					<h2 class="text-lg font-bold text-foreground">
						¿Confirmar entrega de la orden {order.orderNumber}?
					</h2>
					{#if alreadyReady}
						<div class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
							<PackageCheck class="size-4 shrink-0 mt-0.5 text-emerald-600" />
							<span>
								Este pedido ya figura como <strong>Listo para entregar</strong> (los insumos ya fueron descontados al producirlo). Al confirmar se cerrará la entrega y el cobro para <strong>{order.customerName}</strong>.
							</span>
						</div>
					{:else}
						<p class="text-sm text-muted-foreground">
							Se registrará la entrega para <strong>{order.customerName}</strong>, se
							descontarán los insumos de las líneas aún pendientes y la orden pasará a estar{' '}
							<strong>Finalizada</strong>.
						</p>

						<label
							class="mt-3 flex items-start gap-2.5 rounded-xl border border-border bg-muted/20 p-3 text-xs cursor-pointer hover:bg-muted/30 transition-colors"
						>
							<input
								type="checkbox"
								bind:checked={useDisplayStock}
								class="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
							/>
							<div class="space-y-0.5">
								<div class="flex items-center gap-1.5 font-semibold text-foreground">
									<Store class="size-3.5 text-secondary" />
									<span>Tomar del stock de Vidriera / Estantería</span>
								</div>
								<p class="text-[11px] text-muted-foreground">
									Actívalo si estás entregando unidades que ya tenías cargadas en tu stock de mostrador.
								</p>
							</div>
						</label>
					{/if}
				</div>
			</div>

			<div
				class="flex items-center justify-end gap-2.5 border-t border-border bg-muted/20 px-6 py-4"
			>
				<Button type="button" variant="outline" size="sm" onclick={onClose} disabled={isSubmitting}>
					Cancelar
				</Button>
				<form
					method="POST"
					action="?/completeOrder"
					use:enhance={() => {
						isSubmitting = true;
						return async ({ result, update }) => {
							await update();
							isSubmitting = false;
							if (result.type === 'success') {
								toast.success(
									`Orden ${order.orderNumber} entregada`,
									'La entrega y el estado de la orden fueron actualizados.'
								);
								onClose();
							}
						};
					}}
				>
					<input type="hidden" name="businessId" value={businessId} />
					<input type="hidden" name="orderId" value={order.id} />
					<input type="hidden" name="useDisplayStock" value={useDisplayStock ? 'true' : 'false'} />
					<Button type="submit" size="sm" class="gap-1.5" disabled={isSubmitting}>
						<Check class="size-3.5" />
						<span>{isSubmitting ? 'Entregando...' : 'Sí, entregar orden'}</span>
					</Button>
				</form>
			</div>
		</div>
	</div>
{/if}
