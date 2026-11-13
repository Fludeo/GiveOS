<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import type { SuperValidated, Infer } from 'sveltekit-superforms';
	import type { UpdatePaymentSchema } from '#lib/schemas/order.schema';
	import type { OrderWithItems, PaymentStatus } from '#lib/features/orders/domain/order.entity';
	import { Button } from '#lib/components/ui/button';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import { formatCurrency } from '../utils';

	interface Props {
		formData: SuperValidated<Infer<UpdatePaymentSchema>>;
		order: OrderWithItems | null;
		businessId: string;
		onClose: () => void;
	}

	let { formData, order, businessId, onClose }: Props = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, submitting, reset } = superForm(formData, {
		onResult({ result }) {
			if (result.type === 'success') {
				onClose();
			}
		}
	});

	$effect(() => {
		if (order) {
			reset();
			$form.businessId = businessId;
			$form.orderId = order.id;
			$form.paidAmount = order.totalAmount;
			$form.paymentStatus = 'paid';
			$form.transactionId = order.transactionId ?? '';
		}
	});
</script>

{#if order}
	<div
		class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 p-0 sm:p-4 backdrop-blur-[1px]"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="w-full max-w-full sm:max-w-md overflow-hidden rounded-t-2xl sm:rounded-2xl border-t sm:border border-border bg-card shadow-xl"
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
				use:enhance
			>
				<div class="space-y-4 p-6">
					<input type="hidden" name="businessId" value={$form.businessId} />
					<input type="hidden" name="orderId" value={$form.orderId} />

					<div class="space-y-2">
						<Label for="pay-status">Estado de Pago</Label>
						<select
							id="pay-status"
							name="paymentStatus"
							bind:value={$form.paymentStatus}
							onchange={() => {
								if ($form.paymentStatus === 'paid') $form.paidAmount = order.totalAmount;
								else if ($form.paymentStatus === 'pending') $form.paidAmount = 0;
							}}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
						>
							<option value="paid">Pagado Total ({formatCurrency(order.totalAmount)})</option>
							<option value="partially_paid">Pago Parcial</option>
							<option value="pending">Sin Pagar ($ 0,00)</option>
						</select>
						{#if $errors.paymentStatus}
							<p class="text-xs text-destructive">{$errors.paymentStatus}</p>
						{/if}
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
							bind:value={$form.paidAmount}
							class="h-10 font-mono"
							required
						/>
						{#if $errors.paidAmount}
							<p class="text-xs text-destructive">{$errors.paidAmount}</p>
						{/if}
					</div>
				</div>

				<div
					class="flex items-center justify-end gap-3 border-t border-border bg-muted/20 px-6 py-4"
				>
					<Button type="button" variant="outline" onclick={onClose} disabled={$submitting}>
						Cancelar
					</Button>
					<Button type="submit" disabled={$submitting}>
						<Check class="size-4" />
						<span>{$submitting ? 'Guardando...' : 'Guardar Pago'}</span>
					</Button>
				</div>
			</form>
		</div>
	</div>
{/if}
