<script lang="ts">
	import { enhance } from '$app/forms';
	import type { OrderWithItems } from '#lib/features/orders/domain/order.entity';
	import { Button } from '#lib/components/ui/button';
	import Check from '@lucide/svelte/icons/check';

	interface Props {
		order: OrderWithItems | null;
		businessId: string;
		onClose: () => void;
	}

	let { order, businessId, onClose }: Props = $props();
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
			<div class="space-y-3 p-6">
				<div
					class="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"
				>
					<Check class="size-5" />
				</div>
				<div class="space-y-1.5">
					<h2 class="text-lg font-bold text-foreground">
						¿Confirmar entrega de la orden {order.orderNumber}?
					</h2>
					<p class="text-sm text-muted-foreground">
						Se registrará la entrega para <strong>{order.customerName}</strong>, se
						descontarán los insumos correspondientes y la orden pasará a estar{' '}
						<strong>Finalizada</strong>.
					</p>
				</div>
			</div>

			<div
				class="flex items-center justify-end gap-2.5 border-t border-border bg-muted/20 px-6 py-4"
			>
				<Button type="button" variant="outline" size="sm" onclick={onClose}>
					Cancelar
				</Button>
				<form
					method="POST"
					action="?/completeOrder"
					use:enhance={() => {
						return async ({ update }) => {
							await update();
							onClose();
						};
					}}
				>
					<input type="hidden" name="businessId" value={businessId} />
					<input type="hidden" name="orderId" value={order.id} />
					<Button type="submit" size="sm" class="gap-1.5">
						<Check class="size-3.5" />
						<span>Sí, entregar orden</span>
					</Button>
				</form>
			</div>
		</div>
	</div>
{/if}
