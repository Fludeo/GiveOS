<script lang="ts">
	import { enhance } from '$app/forms';
	import type { OrderWithItems } from '#lib/features/orders/domain/order.entity';
	import { Button } from '#lib/components/ui/button';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import { formatCurrency } from '../utils';

	interface Props {
		order: OrderWithItems | null;
		businessId: string;
		onClose: () => void;
	}

	let { order, businessId, onClose }: Props = $props();

	let confirmDepositAmount = $state<number>(0);
	let confirmTransactionId = $state<string>('');

	$effect(() => {
		if (order) {
			confirmDepositAmount = 0;
			confirmTransactionId = '';
		}
	});
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
			<div class="flex items-center justify-between border-b border-border p-5">
				<div class="flex items-center gap-2.5">
					<div
						class="flex size-9 items-center justify-center rounded-xl bg-secondary/10 text-secondary"
					>
						<Check class="size-5" />
					</div>
					<div>
						<h3 class="text-base font-bold text-foreground">
							Confirmar Pedido {order.orderNumber}
						</h3>
						<p class="text-xs text-muted-foreground">Validación de caja / encargado</p>
					</div>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onclick={onClose}
					class="size-8 text-muted-foreground hover:text-foreground"
					title="Cerrar modal"
				>
					<X class="size-4" />
				</Button>
			</div>

			<form
				method="POST"
				action="?/confirmOrder"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
						onClose();
					};
				}}
				class="p-5 space-y-4 text-xs"
			>
				<input type="hidden" name="businessId" value={businessId} />
				<input type="hidden" name="orderId" value={order.id} />

				<!-- Resumen del pedido -->
				<div class="rounded-xl border border-border bg-muted/20 p-3 space-y-1.5">
					<div class="flex justify-between">
						<span class="text-muted-foreground">Cliente:</span>
						<span class="font-semibold text-foreground">{order.customerName}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground">Total de la Orden:</span>
						<span class="font-mono font-bold text-foreground">
							{formatCurrency(order.totalAmount)}
						</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground">Ítems a confirmar:</span>
						<span class="font-mono text-muted-foreground">
							{order.items.length} productos
						</span>
					</div>
				</div>

				<p class="text-muted-foreground text-[11px] leading-relaxed">
					Al confirmar, el pedido comenzará a descontar stock inmediato de sus productos y se
					contabilizará en la previsión de insumos y recetas de cocina.
				</p>

				<!-- Monto de Seña / Pago (Opcional) -->
				<div class="space-y-1.5">
					<Label class="text-xs font-semibold text-foreground">
						Monto de Seña / Pago Recibido ($){' '}
						<span class="text-muted-foreground font-normal">(Opcional)</span>
					</Label>
					<Input
						type="number"
						step="100"
						min="0"
						max={order.totalAmount}
						name="paidAmount"
						bind:value={confirmDepositAmount}
						class="h-9 font-mono text-xs font-bold"
					/>
					<span class="text-[10px] text-muted-foreground">
						Total orden: {formatCurrency(order.totalAmount)}. Si no se abonó nada, puedes
						dejarlo en 0.
					</span>
				</div>

				<!-- ID de Transacción (Opcional) -->
				<div class="space-y-1.5">
					<Label class="text-xs font-semibold text-foreground">
						ID de Transacción / Comprobante{' '}
						<span class="text-muted-foreground font-normal">(Opcional)</span>
					</Label>
					<Input
						type="text"
						name="transactionId"
						placeholder="Ej. TRANS-847291, N° de ticket o comprobante MP..."
						bind:value={confirmTransactionId}
						class="h-9 text-xs font-mono"
					/>
				</div>

				<div class="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
					<Button type="button" variant="outline" size="sm" onclick={onClose}>
						Volver
					</Button>
					<Button
						type="submit"
						variant="secondary"
						size="sm"
						class="gap-1.5 font-bold shadow-xs"
					>
						<Check class="size-3.5" />
						<span>Confirmar Pedido</span>
					</Button>
				</div>
			</form>
		</div>
	</div>
{/if}
