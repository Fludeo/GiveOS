<script lang="ts">
	import { enhance } from '$app/forms';
	import type { OrderWithItems, PaymentStatus } from '#lib/features/orders/domain/order.entity';
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

	let payModalAmount = $state(0);
	let payModalStatus = $state<PaymentStatus>('paid');

	$effect(() => {
		if (order) {
			payModalAmount = order.totalAmount;
			payModalStatus = 'paid';
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
			<div class="flex items-start justify-between gap-4 border-b border-border p-6">
				<div class="space-y-1">
					<span
						class="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary"
					>
						{order.orderNumber}
					</span>
					<h2 class="text-lg font-bold text-foreground">
						Actualizar Pago — {order.customerName}
					</h2>
					<p class="text-xs text-muted-foreground">
						Total de la orden: <strong>{formatCurrency(order.totalAmount)}</strong> (Abonado actual:
						{formatCurrency(order.paidAmount)})
					</p>
				</div>
				<Button
					type="button"
					size="icon"
					variant="ghost"
					class="size-8"
					onclick={onClose}
				>
					<X class="size-4" />
				</Button>
			</div>

			<form
				method="POST"
				action="?/updatePayment"
				use:enhance={() => {
					return async ({ result, update }) => {
						await update();
						if (result.type === 'success') {
							onClose();
						}
					};
				}}
			>
				<div class="space-y-4 p-6">
					<input type="hidden" name="businessId" value={businessId} />
					<input type="hidden" name="orderId" value={order.id} />

					<div class="space-y-2">
						<Label for="pay-status">Estado de Pago</Label>
						<select
							id="pay-status"
							name="paymentStatus"
							bind:value={payModalStatus}
							onchange={() => {
								if (payModalStatus === 'paid') payModalAmount = order.totalAmount;
								else if (payModalStatus === 'pending') payModalAmount = 0;
							}}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
						>
							<option value="paid">Pagado Total ({formatCurrency(order.totalAmount)})</option>
							<option value="partially_paid">Pago Parcial</option>
							<option value="pending">Sin Pagar ($ 0,00)</option>
						</select>
					</div>

					<div class="space-y-2">
						<Label for="pay-amount">Monto Total Abonado Acumulado ($)</Label>
						<Input
							id="pay-amount"
							name="paidAmount"
							type="number"
							step="any"
							min="0"
							max={order.totalAmount}
							bind:value={payModalAmount}
							class="h-10 font-mono"
							required
						/>
					</div>
				</div>

				<div
					class="flex items-center justify-end gap-3 border-t border-border bg-muted/20 px-6 py-4"
				>
					<Button type="button" variant="outline" onclick={onClose}>
						Cancelar
					</Button>
					<Button type="submit">
						<Check class="size-4" />
						<span>Guardar Pago</span>
					</Button>
				</div>
			</form>
		</div>
	</div>
{/if}
