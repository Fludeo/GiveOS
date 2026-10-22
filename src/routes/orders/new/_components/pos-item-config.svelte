<script lang="ts">
	import { Badge } from '#lib/components/ui/badge';
	import { Button } from '#lib/components/ui/button';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import Plus from '@lucide/svelte/icons/plus';
	import Minus from '@lucide/svelte/icons/minus';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import X from '@lucide/svelte/icons/x';
	import Zap from '@lucide/svelte/icons/zap';
	import Clock from '@lucide/svelte/icons/clock';
	import Check from '@lucide/svelte/icons/check';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Percent from '@lucide/svelte/icons/percent';
	import {
		calculateEffectiveUnitPrice,
		type OrderItemFulfillmentType,
		type SalesProductWithItems
	} from '#lib/features/orders/domain/order.entity';
	import {
		formatCurrency,
		roundToNext15Minutes,
		toDateString,
		toTimeString,
		time15Slots
	} from '../../_components/utils';

	let {
		product,
		defaultDeliveryDate,
		onAddImmediate,
		onAddPreorder,
		onCancel
	}: {
		product: SalesProductWithItems;
		defaultDeliveryDate: string;
		onAddImmediate: (item: {
			salesProductId: string;
			productName: string;
			productCode: string;
			isCombo: boolean;
			quantity: number;
			listPrice: number;
			unitPrice: number;
			discountLabel: string | null;
			fulfillmentType: 'immediate';
			deliveryDate: string;
			notes: string;
		}) => void;
		onAddPreorder: (item: {
			salesProductId: string;
			productName: string;
			productCode: string;
			isCombo: boolean;
			quantity: number;
			listPrice: number;
			unitPrice: number;
			discountLabel: string | null;
			fulfillmentType: 'preorder';
			deliveryDate: string;
			notes: string;
		}) => void;
		onCancel: () => void;
	} = $props();

	let itemConfigStep = $state<'config' | 'preorder_details'>('config');
	let itemConfigQuantity = $state(1);
	let itemConfigNotes = $state('');

	const initialSlot = roundToNext15Minutes(new Date(Date.now() + 2 * 3600_000));
	let configDeliveryDateOnly = $state(toDateString(initialSlot));
	let configDeliveryTimeOnly = $state(toTimeString(initialSlot));
	let itemConfigDeliveryDate = $state('');

	$effect(() => {
		if (defaultDeliveryDate && defaultDeliveryDate.includes('T')) {
			const [d, t] = defaultDeliveryDate.split('T');
			configDeliveryDateOnly = d;
			if (t) configDeliveryTimeOnly = t.slice(0, 5);
		}
	});

	$effect(() => {
		itemConfigDeliveryDate = `${configDeliveryDateOnly}T${configDeliveryTimeOnly}`;
	});

	const minDeliveryDateOnly = $derived(toDateString(new Date()));

	const autoPriceCalculation = $derived.by(() => {
		return calculateEffectiveUnitPrice(
			product.salePrice,
			itemConfigQuantity,
			product.pricingTiers ?? []
		);
	});

	const effectiveConfigUnitPrice = $derived(autoPriceCalculation.unitPrice);

	function changeConfigQuantity(delta: number) {
		const next = Math.max(1, Number((itemConfigQuantity + delta).toFixed(2)));
		itemConfigQuantity = next;
	}

	function syncDeliveryDateTime() {
		if (!configDeliveryDateOnly) {
			itemConfigDeliveryDate = '';
			return;
		}
		itemConfigDeliveryDate = `${configDeliveryDateOnly}T${configDeliveryTimeOnly || '12:00'}`;
	}

	function setQuickDeliveryOffset(hoursFromNow: number) {
		const base = new Date(Date.now() + hoursFromNow * 3600_000);
		const rounded = roundToNext15Minutes(base);
		configDeliveryDateOnly = toDateString(rounded);
		configDeliveryTimeOnly = toTimeString(rounded);
		itemConfigDeliveryDate = `${configDeliveryDateOnly}T${configDeliveryTimeOnly}`;
	}

	function handleAddImmediate() {
		const discountText = autoPriceCalculation.appliedTier
			? `${autoPriceCalculation.discountPct}% OFF`
			: null;
		onAddImmediate({
			salesProductId: product.id,
			productName: product.name,
			productCode: product.code,
			isCombo: product.isCombo,
			quantity: itemConfigQuantity > 0 ? itemConfigQuantity : 1,
			listPrice: product.salePrice,
			unitPrice: effectiveConfigUnitPrice,
			discountLabel: discountText,
			fulfillmentType: 'immediate',
			deliveryDate: '',
			notes: ''
		});
	}

	function handleAddPreorder() {
		const discountText = autoPriceCalculation.appliedTier
			? `${autoPriceCalculation.discountPct}% OFF`
			: null;
		onAddPreorder({
			salesProductId: product.id,
			productName: product.name,
			productCode: product.code,
			isCombo: product.isCombo,
			quantity: itemConfigQuantity > 0 ? itemConfigQuantity : 1,
			listPrice: product.salePrice,
			unitPrice: effectiveConfigUnitPrice,
			discountLabel: discountText,
			fulfillmentType: 'preorder',
			deliveryDate: itemConfigDeliveryDate,
			notes: itemConfigNotes.trim()
		});
	}
</script>

<div class="rounded-2xl border-2 border-primary/40 bg-card p-6 shadow-md space-y-6">
	<div class="flex items-start justify-between gap-4 border-b border-border pb-4">
		<div class="space-y-1">
			<div class="flex items-center gap-2">
				<span class="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
					{product.code}
				</span>
				<h2 class="text-xl font-bold text-foreground">
					{product.name}
				</h2>
				{#if product.isCombo}
					<Badge variant="secondary" class="gap-1">
						<Sparkles class="size-3 text-primary" />
						Combo
					</Badge>
				{/if}
			</div>
			<p class="text-xs text-muted-foreground">
				Precio de lista oficial: <strong class="text-foreground">{formatCurrency(product.salePrice)}</strong>
			</p>
		</div>

		<Button
			type="button"
			variant="ghost"
			size="sm"
			onclick={onCancel}
			class="text-xs text-muted-foreground hover:text-foreground"
		>
			<X class="size-4 mr-1" />
			<span>Cancelar</span>
		</Button>
	</div>

	<!-- PASO 1: CANTIDAD -->
	<div class="space-y-3">
		<div class="flex items-center justify-between">
			<Label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
				1. Cantidad de Unidades
			</Label>
			<span class="font-mono text-xs font-bold text-foreground">
				{itemConfigQuantity} {itemConfigQuantity === 1 ? 'unidad' : 'unidades'}
			</span>
		</div>

		<div class="flex items-center">
			<Button
				type="button"
				variant="outline"
				size="icon"
				onclick={() => changeConfigQuantity(-1)}
				class="size-11 rounded-r-none border-r-0 hover:bg-accent active:scale-95 transition-all cursor-pointer"
			>
				<Minus class="size-4" />
			</Button>
			<Input
				type="number"
				step="any"
				min="0.01"
				bind:value={itemConfigQuantity}
				class="h-11 w-28 rounded-none text-center font-mono text-base font-bold shadow-none"
			/>
			<Button
				type="button"
				variant="outline"
				size="icon"
				onclick={() => changeConfigQuantity(1)}
				class="size-11 rounded-l-none border-l-0 hover:bg-accent active:scale-95 transition-all cursor-pointer"
			>
				<Plus class="size-4" />
			</Button>
		</div>
	</div>

	<!-- PASO 2: ASIGNACIÓN AUTOMÁTICA DE PRECIO SEGÚN ESCALA POR CANTIDAD -->
	<div class="space-y-3 border-t border-border pt-4">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-1.5">
				<Percent class="size-4 text-primary" />
				<Label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					2. Política de Precio por Cantidad
				</Label>
			</div>
			<div class="text-right">
				<span class="text-[11px] text-muted-foreground">Precio Unitario Aplicado:</span>
				<span class="ml-1.5 font-mono text-sm font-bold {autoPriceCalculation.appliedTier ? 'text-emerald-600' : 'text-foreground'}">
					{formatCurrency(effectiveConfigUnitPrice)}
				</span>
			</div>
		</div>

		{#if autoPriceCalculation.appliedTier}
			<div class="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs text-emerald-900 shadow-2xs">
				<div class="flex items-center gap-2">
					<Sparkles class="size-4 text-emerald-600 shrink-0" />
					<div>
						<p class="font-bold">
							¡Escala por Volumen Aplicada Automáticamente! ({autoPriceCalculation.discountPct}% de descuento)
						</p>
						<p class="text-[11px] text-emerald-700">
							Por llevar {itemConfigQuantity} unidades (escala configurada a partir de {autoPriceCalculation.appliedTier.minQuantity}u).
						</p>
					</div>
				</div>
				<div class="text-right font-mono font-bold shrink-0">
					<span class="text-xs text-emerald-700">Ahorro:</span>
					<span class="text-emerald-800">
						{formatCurrency((product.salePrice - effectiveConfigUnitPrice) * itemConfigQuantity)}
					</span>
				</div>
			</div>
		{:else if product.pricingTiers && product.pricingTiers.length > 0}
			<div class="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
				<div class="flex items-center justify-between text-xs">
					<span class="text-muted-foreground">Escalas de descuento predefinidas en este producto:</span>
					<span class="font-mono text-[11px] text-muted-foreground">Precio base: {formatCurrency(product.salePrice)}</span>
				</div>
				<div class="flex flex-wrap gap-2">
					{#each product.pricingTiers as tier}
						{@const targetUnitPrice = tier.type === 'percentage' ? product.salePrice * (1 - tier.value / 100) : tier.value}
						<div class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs">
							<span class="font-bold text-foreground">A partir de {tier.minQuantity} u:</span>
							<span class="font-mono font-bold text-emerald-600">
								{tier.type === 'percentage' ? `-${tier.value}% (${formatCurrency(targetUnitPrice)})` : formatCurrency(targetUnitPrice)}
							</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<div class="flex items-center justify-between rounded-xl bg-muted/30 p-3">
			<span class="text-xs text-muted-foreground">
				Subtotal por {itemConfigQuantity} {itemConfigQuantity === 1 ? 'unidad' : 'unidades'}:
			</span>
			<span class="font-mono text-base font-bold text-foreground">
				{formatCurrency(itemConfigQuantity * effectiveConfigUnitPrice)}
			</span>
		</div>
	</div>

	<!-- PASO 3: MODALIDAD DE LA ORDEN Y ENTREGA -->
	<div class="space-y-4 border-t border-border pt-4">
		<Label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
			3. Modalidad de la Orden y Entrega
		</Label>

		{#if itemConfigStep === 'config'}
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<!-- Orden Inmediata -->
				<button
					type="button"
					onclick={handleAddImmediate}
					class="group flex flex-col justify-between rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/5 p-5 text-left transition-all hover:border-emerald-500 hover:bg-emerald-500/10 hover:shadow-md cursor-pointer active:scale-[0.98]"
				>
					<div class="space-y-1.5">
						<div class="flex size-9 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-700">
							<Zap class="size-5" />
						</div>
						<h4 class="text-base font-bold text-foreground group-hover:text-emerald-700">
							Orden Inmediata
						</h4>
						<p class="text-xs text-muted-foreground leading-relaxed">
							Se despacha en el acto en el mostrador. Descuenta stock inmediatamente.
						</p>
					</div>
					<div class="mt-4 flex items-center justify-between border-t border-emerald-500/20 pt-3">
						<span class="text-xs font-medium text-emerald-700">Entrega ahora</span>
						<span class="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-xs">
							+ Cargar a la Orden
						</span>
					</div>
				</button>

				<!-- Orden por Encargo -->
				<button
					type="button"
					onclick={() => (itemConfigStep = 'preorder_details')}
					class="group flex flex-col justify-between rounded-2xl border-2 border-amber-500/40 bg-amber-500/5 p-5 text-left transition-all hover:border-amber-500 hover:bg-amber-500/10 hover:shadow-md cursor-pointer active:scale-[0.98]"
				>
					<div class="space-y-1.5">
						<div class="flex size-9 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700">
							<Clock class="size-5" />
						</div>
						<h4 class="text-base font-bold text-foreground group-hover:text-amber-700">
							Orden por Encargo
						</h4>
						<p class="text-xs text-muted-foreground leading-relaxed">
							Para entregar en fecha y hora pactada. Con dedicatoria y producción Just-In-Time.
						</p>
					</div>
					<div class="mt-4 flex items-center justify-between border-t border-amber-500/20 pt-3">
						<span class="text-xs font-medium text-amber-700">Pactar entrega</span>
						<span class="rounded-lg bg-amber-600 px-3 py-1 text-xs font-bold text-white shadow-xs">
							Configurar Horario →
						</span>
					</div>
				</button>
			</div>
		{:else}
			<!-- Detalles de Orden por Encargo -->
			<div class="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-4">
				<div>
					<h4 class="text-sm font-semibold text-amber-900">
						Detalles de la Orden por Encargo para {product.name}
					</h4>
					<p class="text-xs text-muted-foreground mt-0.5">
						Ingresa la fecha y hora pactada de entrega y cualquier indicación para elaboración.
					</p>
				</div>

				<div class="space-y-3">
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<div class="space-y-1.5">
							<Label for="pos-item-delivery-date" class="text-xs font-semibold">
								Fecha de Entrega
							</Label>
							<input
								id="pos-item-delivery-date"
								type="date"
								min={minDeliveryDateOnly}
								bind:value={configDeliveryDateOnly}
								onchange={syncDeliveryDateTime}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
							/>
						</div>

						<div class="space-y-1.5">
							<div class="flex items-center justify-between">
								<Label for="pos-item-delivery-time" class="text-xs font-semibold">
									Hora Pactada
								</Label>
								<span class="text-[10px] text-muted-foreground font-mono">Paso: 15 min</span>
							</div>
							<select
								id="pos-item-delivery-time"
								bind:value={configDeliveryTimeOnly}
								onchange={syncDeliveryDateTime}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
							>
								{#each time15Slots as slot}
									<option value={slot}>{slot} hs</option>
								{/each}
							</select>
						</div>
					</div>

					<div class="flex flex-wrap items-center gap-1.5 pt-0.5">
						<span class="text-[11px] text-muted-foreground">Atajos:</span>
						<button
							type="button"
							onclick={() => setQuickDeliveryOffset(2)}
							class="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
						>
							Hoy (+2h)
						</button>
						<button
							type="button"
							onclick={() => setQuickDeliveryOffset(24)}
							class="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
						>
							Mañana (+24h)
						</button>
						<button
							type="button"
							onclick={() => setQuickDeliveryOffset(48)}
							class="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
						>
							En 48 horas
						</button>
					</div>
				</div>

				<div class="space-y-2">
					<Label class="text-xs font-semibold">
						Nota Especial / Dedicatoria / Sabores
					</Label>
					<Input
						bind:value={itemConfigNotes}
						placeholder="Ej. Dedicatoria: Feliz Cumple Juan, decoración con fresas, sin nueces..."
						class="h-10 text-sm"
					/>
				</div>

				<div class="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
					<Button
						type="button"
						variant="outline"
						class="gap-1.5"
						onclick={() => (itemConfigStep = 'config')}
					>
						<ArrowLeft class="size-4" />
						<span>Volver a Orden Inmediata</span>
					</Button>

					<Button
						type="button"
						class="bg-amber-600 hover:bg-amber-700 text-white gap-2 font-bold shadow-sm"
						onclick={handleAddPreorder}
					>
						<Check class="size-4" />
						<span>Agregar Encargo a la Orden</span>
					</Button>
				</div>
			</div>
		{/if}
	</div>
</div>
