<script lang="ts">
	import { enhance } from '$app/forms';
	import type { OrderWithItems } from '#lib/features/orders/domain/order.entity';
	import { Button } from '#lib/components/ui/button';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';

	interface Props {
		order: OrderWithItems | null;
		businessId: string;
		onClose: () => void;
	}

	let { order, businessId, onClose }: Props = $props();
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
			<div class="space-y-3 p-6">
				<div
					class="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive"
				>
					<AlertTriangle class="size-5" />
				</div>
				<div class="space-y-1.5">
					<h2 class="text-lg font-bold text-foreground">
						¿Cancelar la orden {order.orderNumber}?
					</h2>
					<p class="text-sm text-muted-foreground">
						Los encargos pendientes de esta orden quedarán cancelados y dejarán de
						comprometer sub-ensambles a futuro.
					</p>
				</div>
			</div>

			<div
				class="flex items-center justify-end gap-2.5 border-t border-border bg-muted/20 px-6 py-4"
			>
				<Button type="button" variant="outline" size="sm" onclick={onClose}>
					Volver
				</Button>
				<form
					method="POST"
					action="?/cancelOrder"
					use:enhance={({ action }) => {
						if (typeof window !== 'undefined') {
							const currentUrl = new URL(window.location.href);
							for (const [k, v] of currentUrl.searchParams.entries()) {
								if (!action.searchParams.has(k)) {
									action.searchParams.set(k, v);
								}
							}
						}
						return async ({ update }) => {
							await update({ reset: false });
							onClose();
						};
					}}
				>
					<input type="hidden" name="businessId" value={businessId} />
					<input type="hidden" name="orderId" value={order.id} />
					<Button type="submit" variant="destructive" size="sm">
						Sí, cancelar orden
					</Button>
				</form>
			</div>
		</div>
	</div>
{/if}
