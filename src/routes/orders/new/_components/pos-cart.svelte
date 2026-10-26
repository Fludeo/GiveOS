<script lang="ts">
	import { Button } from '#lib/components/ui/button';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
	import Calendar from '@lucide/svelte/icons/calendar';
	import Plus from '@lucide/svelte/icons/plus';
	import Minus from '@lucide/svelte/icons/minus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Zap from '@lucide/svelte/icons/zap';
	import Check from '@lucide/svelte/icons/check';
	import type { PaymentStatus } from '#lib/features/orders/domain/order.entity';
	import { formatCurrency, formatDateTime, type DraftOrderLine } from '../../_components/utils';

	let {
		activeBusinessId,
		draftLines = $bindable(),
		draftCustomerName = $bindable(),
		draftPaymentStatus = $bindable(),
		draftPaidAmount = $bindable(),
		draftDeliveryDate = $bindable(),
		draftNotes = $bindable(),
		draftTransactionId = $bindable(),
		draftCreateAsUnconfirmed = $bindable(),
		isSubmitting = false,
		isMobileDrawer = false,
		onChangeLineQuantity,
		onRemoveLine
	}: {
		activeBusinessId: string;
		draftLines: DraftOrderLine[];
		draftCustomerName: string;
		draftPaymentStatus: PaymentStatus;
		draftPaidAmount: number;
		draftDeliveryDate: string;
		draftNotes: string;
		draftTransactionId: string;
		draftCreateAsUnconfirmed: boolean;
		isSubmitting?: boolean;
		isMobileDrawer?: boolean;
		onChangeLineQuantity: (index: number, delta: number) => void;
		onRemoveLine: (index: number) => void;
	} = $props();

	const draftImmediateAmount = $derived(
		draftLines
			.filter((l) => l.fulfillmentType === 'immediate')
			.reduce((sum, l) => sum + (l.quantity > 0 ? l.quantity : 0) * (l.unitPrice >= 0 ? l.unitPrice : 0), 0)
	);
	const draftPreorderAmount = $derived(
		draftLines
			.filter((l) => l.fulfillmentType === 'preorder')
			.reduce((sum, l) => sum + (l.quantity > 0 ? l.quantity : 0) * (l.unitPrice >= 0 ? l.unitPrice : 0), 0)
	);
	const draftTotalAmount = $derived(draftImmediateAmount + draftPreorderAmount);
	const draftHasImmediate = $derived(draftImmediateAmount > 0);
	const draftHasPreorder = $derived(draftPreorderAmount > 0);
	const draftIsMixed = $derived(draftHasImmediate && draftHasPreorder);
	const sliderFillPct = $derived(
		draftTotalAmount > draftImmediateAmount
			? Math.min(100, Math.max(0, ((Number(draftPaidAmount) - draftImmediateAmount) / (draftTotalAmount - draftImmediateAmount)) * 100))
			: 100
	);

	$effect(() => {
		if (draftPaymentStatus === 'paid') {
			draftPaidAmount = Number(draftTotalAmount.toFixed(2));
		} else if (draftPaymentStatus === 'pending') {
			draftPaidAmount = draftHasImmediate ? Number(draftImmediateAmount.toFixed(2)) : 0;
		} else if (draftPaymentStatus === 'partially_paid') {
			if (draftHasImmediate && draftPaidAmount < draftImmediateAmount) {
				draftPaidAmount = Number(draftImmediateAmount.toFixed(2));
			}
		}
	});

	const serializedDraftLines = $derived(
		JSON.stringify(
			draftLines.map((l) => ({
				salesProductId: l.salesProductId,
				quantity: Number(l.quantity),
				unitPrice: Number(l.unitPrice),
				fulfillmentType: l.fulfillmentType,
				notes: l.notes.trim() || null
			}))
		)
	);

	function setDepositPercentage(pct: number) {
		const targetPreorderPart = (draftPreorderAmount * pct) / 100;
		const total = draftImmediateAmount + targetPreorderPart;
		draftPaidAmount = Number(total.toFixed(2));
	}
</script>

<input type="hidden" name="businessId" value={activeBusinessId} />
<input type="hidden" name="customerName" value={draftCustomerName} />
<input type="hidden" name="deliveryDate" value={draftDeliveryDate} />
<input type="hidden" name="paymentStatus" value={draftPaymentStatus} />
<input type="hidden" name="paidAmount" value={draftPaidAmount} />
<input type="hidden" name="notes" value={draftNotes} />
<input type="hidden" name="transactionId" value={draftTransactionId} />
<input type="hidden" name="status" value={draftCreateAsUnconfirmed ? 'unconfirmed' : 'pending'} />
<input type="hidden" name="linesJson" value={serializedDraftLines} />

<!-- Header Comanda (solo visible en Desktop, el Drawer Mobile ya tiene el suyo) -->
{#if !isMobileDrawer}
	<div class="flex items-center justify-between border-b border-border pb-3">
		<div class="flex items-center gap-2">
			<ShoppingCart class="size-5 text-primary" />
			<h3 class="text-base font-bold text-foreground">
				Orden de Compra
			</h3>
		</div>
		<span class="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-bold text-primary">
			{draftLines.length} {draftLines.length === 1 ? 'producto' : 'productos'}
		</span>
	</div>
{/if}

<!-- Lista de Ítems en la Comanda -->
{#if draftLines.length === 0}
	<div class="rounded-xl border border-dashed border-border/80 bg-muted/5 p-8 text-center">
		<ShoppingCart class="mx-auto size-8 text-muted-foreground/30" />
		<p class="mt-2 text-sm font-semibold text-foreground">
			La orden está vacía
		</p>
		<p class="text-xs text-muted-foreground">
			Toca un producto a la izquierda para comenzar a cargar la orden.
		</p>
	</div>
{:else}
	<div class="max-h-72 overflow-y-auto space-y-2.5 pr-1">
		{#each draftLines as line, idx (line.key)}
			<div class="rounded-xl border border-border bg-muted/20 p-3 space-y-2 transition-all hover:border-primary/40">
				<div class="flex items-start justify-between gap-2">
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-center gap-1.5">
							<span class="font-mono text-xs font-bold text-foreground">
								{line.quantity}×
							</span>
							<h5 class="text-xs font-bold text-foreground truncate">
								{line.productName}
							</h5>
							{#if line.fulfillmentType === 'immediate'}
								<span class="rounded bg-emerald-500/10 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700">
									Venta
								</span>
							{:else}
								<span class="rounded bg-amber-500/10 px-1.5 py-0.2 text-[10px] font-bold text-amber-700">
									Encargo
								</span>
							{/if}
						</div>

						{#if line.notes}
							<div class="mt-1 flex items-start gap-1 rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-900">
								<span class="font-semibold shrink-0">Nota:</span>
								<span class="italic font-medium">{line.notes}</span>
							</div>
						{/if}

						{#if line.fulfillmentType === 'preorder' && line.deliveryDate}
							<div class="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
								<Calendar class="size-3 text-amber-600" />
								<span>Entrega: {formatDateTime(line.deliveryDate)}</span>
							</div>
						{/if}
					</div>

					<span class="font-mono text-xs font-bold text-foreground">
						{formatCurrency(line.quantity * line.unitPrice)}
					</span>
				</div>

				<!-- Controles de Cantidad y Eliminar -->
				<div class="flex items-center justify-between border-t border-border/50 pt-2">
					<div class="flex items-center">
						<Button
							type="button"
							variant="outline"
							size="icon"
							onclick={() => onChangeLineQuantity(idx, -1)}
							class="size-6 rounded-r-none border-r-0 p-0 text-foreground cursor-pointer"
						>
							<Minus class="size-2.5" />
						</Button>
						<span class="flex h-6 w-7 items-center justify-center border border-input bg-background font-mono text-[11px] font-bold">
							{line.quantity}
						</span>
						<Button
							type="button"
							variant="outline"
							size="icon"
							onclick={() => onChangeLineQuantity(idx, 1)}
							class="size-6 rounded-l-none border-l-0 p-0 text-foreground cursor-pointer"
						>
							<Plus class="size-2.5" />
						</Button>
					</div>

					<Button
						type="button"
						variant="ghost"
						size="icon"
						class="size-6 text-muted-foreground hover:text-destructive cursor-pointer"
						onclick={() => onRemoveLine(idx)}
					>
						<Trash2 class="size-3.5" />
					</Button>
				</div>
			</div>
		{/each}
	</div>
{/if}

<!-- Datos del Cliente -->
<div class="space-y-2 border-t border-border pt-4">
	<div class="flex items-center justify-between">
		<Label for="pos-customer" class="text-xs font-semibold">Cliente</Label>
		<span class="text-[10px] text-muted-foreground">Opcional</span>
	</div>
	<Input
		id="pos-customer"
		bind:value={draftCustomerName}
		placeholder="Cliente Mostrador o Nombre"
		class="h-9 text-xs"
	/>
</div>

<!-- Modalidad de Cobro -->
<div class="space-y-2.5 border-t border-border pt-4">
	<div class="flex items-center justify-between">
		<Label class="text-xs font-semibold">Modalidad de Cobro</Label>
		{#if draftIsMixed}
			<span class="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
				Inmediato + Encargo
			</span>
		{/if}
	</div>

	{#if draftIsMixed}
		<div class="rounded-xl border border-border/80 bg-muted/30 p-2.5 text-xs space-y-1">
			<div class="flex items-center justify-between">
				<span class="flex items-center gap-1.5 text-muted-foreground text-[11px]">
					<Zap class="size-3 text-emerald-600" />
					<span>Inmediato (se entrega ahora):</span>
				</span>
				<span class="font-mono font-bold text-foreground">
					{formatCurrency(draftImmediateAmount)}
				</span>
			</div>
			<div class="flex items-center justify-between">
				<span class="flex items-center gap-1.5 text-muted-foreground text-[11px]">
					<Calendar class="size-3 text-sky-600" />
					<span>Encargo pactado:</span>
				</span>
				<span class="font-mono text-muted-foreground">
					{formatCurrency(draftPreorderAmount)}
				</span>
			</div>
			<p class="text-[10px] text-muted-foreground pt-1 border-t border-border/40 italic">
				* Lo inmediato se cobra en el acto de forma obligatoria.
			</p>
		</div>
	{/if}

	{#if draftHasPreorder}
		<div class="grid grid-cols-2 gap-2">
			<button
				type="button"
				onclick={() => {
					draftPaymentStatus = 'paid';
					draftPaidAmount = Number(draftTotalAmount.toFixed(2));
				}}
				class="rounded-xl border p-2.5 text-center transition-all cursor-pointer active:scale-95 {draftPaymentStatus === 'paid'
					? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500'
					: 'border-border bg-card hover:bg-muted'}"
			>
				<span class="block text-xs font-bold text-foreground">Total</span>
				<span class="block font-mono text-[11px] text-emerald-600">
					{formatCurrency(draftTotalAmount)}
				</span>
			</button>

			<button
				type="button"
				onclick={() => {
					draftPaymentStatus = 'partially_paid';
					if (draftPaidAmount <= draftImmediateAmount || draftPaidAmount >= draftTotalAmount) {
						setDepositPercentage(50);
					}
				}}
				class="rounded-xl border p-2.5 text-center transition-all cursor-pointer active:scale-95 {draftPaymentStatus === 'partially_paid'
					? 'border-sky-500 bg-sky-500/10 ring-1 ring-sky-500'
					: 'border-border bg-card hover:bg-muted'}"
			>
				<span class="block text-xs font-bold text-foreground">
					{draftIsMixed ? 'Inm. + Seña' : 'Seña Parcial'}
				</span>
				<span class="block font-mono text-[11px] text-sky-600">
					{draftIsMixed ? 'Inmediato + Anticipo' : 'Anticipo'}
				</span>
			</button>
		</div>
	{:else}
		<div class="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-center">
			<span class="block text-xs font-bold text-emerald-600">
				Cobro Total Inmediato
			</span>
			<span class="block font-mono text-sm font-bold text-emerald-600 mt-1">
				{formatCurrency(draftTotalAmount)}
			</span>
		</div>
	{/if}

	{#if draftHasPreorder && draftPaymentStatus === 'partially_paid' && draftPaidAmount < draftTotalAmount}
		<div class="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3.5 space-y-3">
			<Label class="text-xs font-semibold text-foreground">
				{draftIsMixed ? 'Ajuste de Seña sobre el Encargo' : 'Ajuste de Seña'}
			</Label>

			<div class="space-y-1.5">
				<input
					type="range"
					min={draftImmediateAmount}
					max={draftTotalAmount}
					step="100"
					bind:value={draftPaidAmount}
					style="background: linear-gradient(to right, #0284c7 0%, #0284c7 {sliderFillPct}%, #cbd5e1 {sliderFillPct}%, #cbd5e1 100%);"
					class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-sky-600 transition-all"
				/>
				<div class="flex justify-between text-[10px] font-mono text-muted-foreground">
					<span>
						Mín: {formatCurrency(draftImmediateAmount)}
						{#if draftHasImmediate}<span class="text-emerald-600 font-sans font-medium">(Inmediato)</span>{/if}
					</span>
					<span>
						Máx: {formatCurrency(draftTotalAmount)}
						<span class="font-sans font-medium">(Total)</span>
					</span>
				</div>
			</div>

			<div class="space-y-1 pt-0.5">
				<div class="flex items-center justify-between text-[11px]">
					<span class="font-medium text-foreground">Total a Cobrar Ahora:</span>
					<span class="font-mono font-bold text-sky-700 dark:text-sky-300">
						{formatCurrency(draftPaidAmount)}
					</span>
				</div>
				<div class="relative">
					<Input
						type="number"
						step="100"
						min={draftImmediateAmount}
						max={draftTotalAmount}
						bind:value={draftPaidAmount}
						class="h-8 font-mono text-xs font-bold"
					/>
				</div>
			</div>

			<div class="space-y-1 pt-1.5 border-t border-sky-500/20 text-[11px]">
				{#if draftIsMixed}
					<div class="flex justify-between text-muted-foreground text-[10px]">
						<span>Inmediato obligatorio:</span>
						<span class="font-mono">{formatCurrency(draftImmediateAmount)}</span>
					</div>
					<div class="flex justify-between text-muted-foreground text-[10px]">
						<span>Seña asignada al encargo:</span>
						<span class="font-mono font-semibold text-sky-700 dark:text-sky-300">
							{formatCurrency(Math.max(0, draftPaidAmount - draftImmediateAmount))}
						</span>
					</div>
				{/if}
				<div class="flex justify-between font-semibold text-foreground pt-0.5">
					<span>Resta abonar al retirar:</span>
					<span class="font-mono">
						{formatCurrency(Math.max(0, draftTotalAmount - draftPaidAmount))}
					</span>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Comprobante / Transacción y Estado Inicial -->
<div class="space-y-3 border-t border-border pt-4">
	<div class="space-y-1.5">
		<div class="flex items-center justify-between">
			<Label for="pos-transaction" class="text-xs font-semibold">ID de Transacción / Comprobante</Label>
			<span class="text-[10px] text-muted-foreground">Opcional</span>
		</div>
		<Input
			id="pos-transaction"
			bind:value={draftTransactionId}
			placeholder="Ej. TRANS-12345, Ticket #, etc."
			class="h-8 text-xs font-mono"
		/>
	</div>

	<div class="rounded-xl border border-border bg-muted/20 p-3 space-y-1.5">
		<label class="flex items-start gap-2.5 cursor-pointer">
			<input
				type="checkbox"
				bind:checked={draftCreateAsUnconfirmed}
				class="size-4 mt-0.5 rounded border-border text-secondary focus:ring-secondary accent-secondary cursor-pointer"
			/>
			<div class="space-y-0.5">
				<span class="block text-xs font-bold text-foreground">
					Guardar como "Por Confirmar"
				</span>
				<span class="block text-[11px] text-muted-foreground leading-tight">
					Se contabiliza en el listado pero queda pendiente de validación por caja. No descuenta stock ni compromete insumos hasta su confirmación.
				</span>
			</div>
		</label>
	</div>
</div>

<!-- Totales y Confirmación Final -->
<div class="border-t border-border pt-4 space-y-3">
	<div class="flex items-center justify-between">
		<span class="text-xs text-muted-foreground">Total de la Orden</span>
		<span class="font-mono text-xl font-bold text-foreground">
			{formatCurrency(draftTotalAmount)}
		</span>
	</div>

	<Button
		type="submit"
		disabled={draftLines.length === 0 || isSubmitting}
		variant={draftCreateAsUnconfirmed ? 'secondary' : 'default'}
		class="w-full h-12 text-sm font-bold gap-2 shadow-md cursor-pointer"
	>
		<Check class="size-5" />
		{#if draftCreateAsUnconfirmed}
			<span>Guardar Pedido Por Confirmar ({formatCurrency(draftTotalAmount)})</span>
		{:else}
			<span>Confirmar y Emitir Orden ({formatCurrency(draftTotalAmount)})</span>
		{/if}
	</Button>
</div>
