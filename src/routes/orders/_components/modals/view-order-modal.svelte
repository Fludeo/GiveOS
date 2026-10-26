<script lang="ts">
	import type { OrderWithItems } from '#lib/features/orders/domain/order.entity';
	import {
		ORDER_STATUS_LABELS,
		PAYMENT_STATUS_LABELS
	} from '#lib/features/orders/domain/order.entity';
	import { Button } from '#lib/components/ui/button';
	import { Badge } from '#lib/components/ui/badge';
	import Calendar from '@lucide/svelte/icons/calendar';
	import X from '@lucide/svelte/icons/x';
	import { formatCurrency, formatDateTime } from '../utils';

	interface Props {
		order: OrderWithItems | null;
		onClose: () => void;
	}

	let { order, onClose }: Props = $props();
</script>

{#if order}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
		>
			<!-- Header -->
			<div
				class="flex items-start justify-between gap-4 border-b border-border bg-muted/20 p-6"
			>
				<div class="space-y-1.5">
					<div class="flex items-center gap-2">
						<span
							class="rounded-md bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-bold text-primary"
						>
							{order.orderNumber}
						</span>
						<Badge variant="outline">
							{ORDER_STATUS_LABELS[order.status]}
						</Badge>
						<Badge variant="secondary">
							{PAYMENT_STATUS_LABELS[
								order.status === 'completed' ? 'paid' : order.paymentStatus
							]}
						</Badge>
					</div>
					<h2 class="text-xl font-bold text-foreground">
						{order.customerName}
					</h2>
					<div class="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
						<span>Creada: {formatDateTime(order.createdAt)}</span>
						{#if order.deliveryDate}
							<span>·</span>
							<span class="inline-flex items-center gap-1 font-medium text-foreground">
								<Calendar class="size-3.5 text-primary" />
								Entrega: {formatDateTime(order.deliveryDate)}
							</span>
						{:else}
							<span>·</span>
							<span>Entrega Inmediata</span>
						{/if}
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

			<!-- Contenido: Lista de Ítems (Solo Lectura) -->
			<div class="max-h-[65vh] space-y-4 overflow-y-auto p-6">
				{#if order.notes}
					<div
						class="rounded-xl border border-border bg-muted/30 p-3 text-xs italic text-muted-foreground"
					>
						<strong class="font-semibold text-foreground not-italic">Nota de la orden: </strong>
						"{order.notes}"
					</div>
				{/if}

				<div class="overflow-x-auto rounded-xl border border-border">
					<table class="w-full text-left text-sm">
						<thead
							class="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground"
						>
							<tr>
								<th class="py-3 pr-3 pl-4 font-semibold">Producto / Ítem</th>
								<th class="px-3 py-3 text-right font-semibold">Cant.</th>
								<th class="px-3 py-3 text-right font-semibold">Unitario</th>
								<th class="px-3 py-3 text-right font-semibold">Subtotal</th>
								<th class="py-3 pr-4 pl-3 text-right font-semibold">Estado</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border/60">
							{#each order.items as line (line.id)}
								<tr class="hover:bg-muted/10">
									<td class="py-3 pr-3 pl-4">
										<p class="font-medium text-foreground">{line.productName}</p>
										{#if line.notes}
											<p class="mt-0.5 text-xs text-muted-foreground italic">
												"{line.notes}"
											</p>
										{/if}
									</td>
									<td
										class="px-3 py-3 text-right font-mono text-xs font-bold text-foreground"
									>
										{line.quantity}
									</td>
									<td
										class="px-3 py-3 text-right font-mono text-xs text-muted-foreground"
									>
										{formatCurrency(line.unitPrice)}
									</td>
									<td
										class="px-3 py-3 text-right font-mono text-xs font-semibold text-foreground"
									>
										{formatCurrency(line.quantity * line.unitPrice)}
									</td>
									<td class="py-3 pr-4 pl-3 text-right">
										<Badge
											variant="outline"
											class="text-[10px] {line.status === 'delivered' ||
											order.status === 'completed'
												? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
												: line.status === 'ready'
													? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 font-bold'
													: line.status === 'pending_delivery'
														? 'border-amber-500/40 bg-amber-500/10 text-amber-700'
														: 'border-red-500/40 bg-red-500/10 text-red-700'}"
										>
											{line.status === 'delivered' || order.status === 'completed'
												? 'Entregado'
												: line.status === 'ready'
													? 'Listo p/ retirar'
													: line.status === 'pending_delivery'
														? 'En preparación'
														: 'Cancelado'}
										</Badge>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Resumen Financiero -->
				<div
					class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-4 text-sm"
				>
					<div class="flex items-center gap-3 text-xs">
						{#if order.status === 'completed' || order.paymentStatus === 'paid'}
							<span
								class="rounded bg-emerald-500/15 px-2 py-1 font-semibold text-emerald-700"
							>
								Totalmente Pagado
							</span>
						{:else if order.paymentStatus === 'partially_paid'}
							<div>
								<span class="text-muted-foreground">Seña pagada: </span>
								<strong class="font-mono text-amber-700">
									{formatCurrency(order.paidAmount)}
								</strong>
								<span class="mx-2 text-muted-foreground">·</span>
								<span class="text-muted-foreground">Saldo pendiente: </span>
								<strong class="font-mono text-foreground">
									{formatCurrency(Math.max(0, order.totalAmount - order.paidAmount))}
								</strong>
							</div>
						{:else}
							<span class="rounded bg-red-500/15 px-2 py-1 font-semibold text-red-700">
								Sin pagar
							</span>
						{/if}
					</div>
					<div class="flex items-baseline gap-2">
						<span class="text-xs text-muted-foreground">Total:</span>
						<span class="font-mono text-lg font-bold text-foreground">
							{formatCurrency(order.totalAmount)}
						</span>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div
				class="flex items-center justify-end border-t border-border bg-muted/20 px-6 py-4"
			>
				<Button type="button" size="sm" onclick={onClose}>
					Cerrar
				</Button>
			</div>
		</div>
	</div>
{/if}
