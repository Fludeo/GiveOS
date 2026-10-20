<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import {
		calculateEffectiveUnitPrice,
		PAYMENT_STATUS_LABELS,
		type OrderItemFulfillmentType,
		type PaymentStatus
	} from '#lib/features/orders/domain/order.entity';
	import AppShell from '#lib/components/layout/app-shell.svelte';
	import { Button } from '#lib/components/ui/button';
	import { Badge } from '#lib/components/ui/badge';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import Plus from '@lucide/svelte/icons/plus';
	import Minus from '@lucide/svelte/icons/minus';
	import Search from '@lucide/svelte/icons/search';
	import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import Clock from '@lucide/svelte/icons/clock';
	import Calendar from '@lucide/svelte/icons/calendar';
	import Check from '@lucide/svelte/icons/check';
	import CircleDollarSign from '@lucide/svelte/icons/circle-dollar-sign';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';
	import Tag from '@lucide/svelte/icons/tag';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Zap from '@lucide/svelte/icons/zap';
	import User from '@lucide/svelte/icons/user';
	import Star from '@lucide/svelte/icons/star';
	import CreditCard from '@lucide/svelte/icons/credit-card';
	import Percent from '@lucide/svelte/icons/percent';

	let { data }: PageProps = $props();

	// Buscador de productos
	let productSearchQuery = $state('');

	// Ítem actualmente en configuración
	let configuringProduct = $state<(typeof data.salesProducts)[number] | null>(null);
	let itemConfigStep = $state<'config' | 'preorder_details'>('config');
	let itemConfigQuantity = $state(1);
	let itemConfigDiscountPct = $state<number>(0);
	let itemConfigCustomPrice = $state<number | null>(null);
	let itemConfigPriceMode = $state<'list' | 'discount' | 'custom'>('list');
	let itemConfigDeliveryDate = $state('');
	let itemConfigNotes = $state('');

	// Comanda / Líneas de la Orden
	interface DraftOrderLine {
		key: string;
		salesProductId: string;
		productName: string;
		productCode: string;
		isCombo: boolean;
		quantity: number;
		listPrice: number;
		unitPrice: number;
		discountLabel: string | null;
		fulfillmentType: OrderItemFulfillmentType;
		deliveryDate: string;
		notes: string;
	}

	let draftLines = $state<DraftOrderLine[]>([]);
	let draftCustomerName = $state('Cliente Mostrador');
	let draftPaymentStatus = $state<PaymentStatus>('paid');
	let draftPaidAmount = $state(0);
	let draftDeliveryDate = $state('');
	let draftNotes = $state('');
	let draftTransactionId = $state('');
	let draftCreateAsUnconfirmed = $state(false);
	let isSubmitting = $state(false);
	let isMobileCartOpen = $state(false);

	// Filtros y atajos
	const shortcutProducts = $derived(data.salesProducts.filter((p) => p.isShortcut));
	const fallbackSuggestedProducts = $derived(
		shortcutProducts.length === 0 ? data.salesProducts.slice(0, 8) : []
	);
	const searchResults = $derived(
		productSearchQuery.trim()
			? data.salesProducts.filter(
					(p) =>
						p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
						p.code.toLowerCase().includes(productSearchQuery.toLowerCase())
				)
			: []
	);

	// Cálculo automático del precio según escalas por cantidad predefinidas del producto
	const autoPriceCalculation = $derived.by(() => {
		if (!configuringProduct) {
			return { unitPrice: 0, discountPct: 0, appliedTier: null };
		}
		return calculateEffectiveUnitPrice(
			configuringProduct.salePrice,
			itemConfigQuantity,
			configuringProduct.pricingTiers ?? []
		);
	});

	const effectiveConfigUnitPrice = $derived(autoPriceCalculation.unitPrice);

	// Subtotales según modalidad de cumplimiento
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

	function startConfiguringProduct(product: (typeof data.salesProducts)[number]) {
		configuringProduct = product;
		itemConfigStep = 'config';
		itemConfigQuantity = 1;
		itemConfigPriceMode = 'list';
		itemConfigDiscountPct = 0;
		itemConfigCustomPrice = null;

		const initialSlot = roundToNext15Minutes(new Date(Date.now() + 2 * 3600_000));
		if (draftDeliveryDate && draftDeliveryDate.includes('T')) {
			const [d, t] = draftDeliveryDate.split('T');
			configDeliveryDateOnly = d;
			configDeliveryTimeOnly = t ? t.slice(0, 5) : toTimeString(initialSlot);
			itemConfigDeliveryDate = draftDeliveryDate;
		} else {
			configDeliveryDateOnly = toDateString(initialSlot);
			configDeliveryTimeOnly = toTimeString(initialSlot);
			itemConfigDeliveryDate = `${configDeliveryDateOnly}T${configDeliveryTimeOnly}`;
		}
		itemConfigNotes = '';
	}

	function changeConfigQuantity(delta: number) {
		const next = Math.max(1, Number((itemConfigQuantity + delta).toFixed(2)));
		itemConfigQuantity = next;
	}

	function selectDiscount(pct: number) {
		if (pct === 0) {
			itemConfigPriceMode = 'list';
			itemConfigDiscountPct = 0;
		} else {
			itemConfigPriceMode = 'discount';
			itemConfigDiscountPct = pct;
		}
	}

	function addImmediateItem() {
		if (!configuringProduct) return;
		const discountText = autoPriceCalculation.appliedTier
			? `${autoPriceCalculation.discountPct}% OFF`
			: null;

		draftLines = [
			...draftLines,
			{
				key: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
				salesProductId: configuringProduct.id,
				productName: configuringProduct.name,
				productCode: configuringProduct.code,
				isCombo: configuringProduct.isCombo,
				quantity: itemConfigQuantity > 0 ? itemConfigQuantity : 1,
				listPrice: configuringProduct.salePrice,
				unitPrice: effectiveConfigUnitPrice,
				discountLabel: discountText,
				fulfillmentType: 'immediate',
				deliveryDate: '',
				notes: ''
			}
		];
		configuringProduct = null;
		productSearchQuery = '';
	}

	function addPreorderItem() {
		if (!configuringProduct) return;
		if (itemConfigDeliveryDate && !draftDeliveryDate) {
			draftDeliveryDate = itemConfigDeliveryDate;
		}
		const discountText = autoPriceCalculation.appliedTier
			? `${autoPriceCalculation.discountPct}% OFF`
			: null;

		draftLines = [
			...draftLines,
			{
				key: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
				salesProductId: configuringProduct.id,
				productName: configuringProduct.name,
				productCode: configuringProduct.code,
				isCombo: configuringProduct.isCombo,
				quantity: itemConfigQuantity > 0 ? itemConfigQuantity : 1,
				listPrice: configuringProduct.salePrice,
				unitPrice: effectiveConfigUnitPrice,
				discountLabel: discountText,
				fulfillmentType: 'preorder',
				deliveryDate: itemConfigDeliveryDate,
				notes: itemConfigNotes.trim()
			}
		];
		configuringProduct = null;
		productSearchQuery = '';
	}

	function removeDraftLine(index: number) {
		draftLines = draftLines.filter((_, idx) => idx !== index);
	}

	function changeLineQuantity(index: number, delta: number) {
		const current = draftLines[index].quantity;
		const next = Math.max(1, Number((current + delta).toFixed(2)));
		draftLines[index].quantity = next;

		// Recalcular según las escalas de precio por cantidad configuradas del producto
		const prod = data.salesProducts.find((p) => p.id === draftLines[index].salesProductId);
		if (prod) {
			const calc = calculateEffectiveUnitPrice(
				prod.salePrice,
				next,
				prod.pricingTiers ?? []
			);
			draftLines[index].unitPrice = calc.unitPrice;
			draftLines[index].discountLabel = calc.appliedTier ? `${calc.discountPct}% OFF` : null;
		}
	}

	function setDepositPercentage(pct: number) {
		draftPaymentStatus = pct >= 100 ? 'paid' : 'partially_paid';
		if (draftHasPreorder) {
			const preorderDeposit = (draftPreorderAmount * pct) / 100;
			const raw = draftImmediateAmount + preorderDeposit;
			draftPaidAmount = Math.round(raw / 100) * 100;
		} else {
			draftPaidAmount = Number(draftTotalAmount.toFixed(2));
		}
	}

	async function toggleProductShortcut(product: (typeof data.salesProducts)[number]) {
		product.isShortcut = !product.isShortcut;
		const form = new FormData();
		form.set('productId', product.id);
		form.set('businessId', data.activeBusiness.id);
		try {
			await fetch('?/toggleShortcut', { method: 'POST', body: form });
		} catch (e) {
			console.error(e);
		}
	}

	function formatCurrency(val: number): string {
		return `$ ${new Intl.NumberFormat('es-AR', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(val)}`;
	}

	function roundToNext15Minutes(date: Date = new Date()): Date {
		const d = new Date(date);
		d.setSeconds(0, 0);
		const minutes = d.getMinutes();
		const remainder = minutes % 15;
		if (remainder !== 0) {
			d.setMinutes(minutes + (15 - remainder));
		}
		return d;
	}

	function toDateString(date: Date): string {
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
	}

	function toTimeString(date: Date): string {
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
	}

	function toDatetimeLocalString(date: Date): string {
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
	}

	const minDeliveryDateOnly = $derived(toDateString(new Date()));

	// Intervalos estrictos cada 15 minutos: 00:00, 00:15, 00:30, 00:45, ... 23:45
	const time15Slots = Array.from({ length: 96 }, (_, i) => {
		const h = String(Math.floor(i / 4)).padStart(2, '0');
		const m = String((i % 4) * 15).padStart(2, '0');
		return `${h}:${m}`;
	});

	let configDeliveryDateOnly = $state(toDateString(new Date()));
	let configDeliveryTimeOnly = $state(toTimeString(roundToNext15Minutes(new Date(Date.now() + 2 * 3600_000))));

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

	function formatDateTime(date: Date | string | null): string {
		if (!date) return 'Inmediato / En el acto';
		const d = typeof date === 'string' ? new Date(date) : date;
		if (Number.isNaN(d.getTime())) return 'Inmediato / En el acto';
		return new Intl.DateTimeFormat('es-AR', {
			day: '2-digit',
			month: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		}).format(d);
	}
</script>

<svelte:head>
	<title>Terminal de Órdenes de Compra — {data.activeBusiness.name}</title>
</svelte:head>

<AppShell
	user={data.user}
	activeBusiness={data.activeBusiness}
	businesses={data.businesses}
	currentSection="orders"
	title="Terminal de Órdenes de Compra"
	description="Pantalla completa para registro rápido de órdenes inmediatas y órdenes por encargo"
>
	{#snippet headerActions()}
		<div class="flex items-center gap-2">
			<Button
				type="button"
				variant="outline"
				class="relative gap-2 lg:hidden cursor-pointer"
				onclick={() => (isMobileCartOpen = true)}
			>
				<ShoppingCart class="size-4 text-primary" />
				<span class="font-bold text-xs">Orden</span>
				{#if draftLines.length > 0}
					<span class="rounded-full bg-primary px-1.5 py-0.2 font-mono text-[10px] font-bold text-primary-foreground">
						{draftLines.reduce((s, l) => s + l.quantity, 0)}
					</span>
				{/if}
			</Button>

			<Button variant="outline" href="/orders" class="gap-1.5">
				<ArrowLeft class="size-4" />
				<span>Volver a Órdenes</span>
			</Button>
		</div>
	{/snippet}

	{#if data.salesProducts.length === 0}
		<div class="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
			<Tag class="mx-auto size-12 text-muted-foreground/60" />
			<h3 class="mt-4 text-lg font-bold text-foreground">
				No hay Productos para Venta habilitados
			</h3>
			<p class="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
				Ve a la sección Inventario > Productos para Venta para asignar precios comerciales a tus productos terminados.
			</p>
			<Button href="/inventory?tab=products" class="mt-6">
				Ir a Productos para Venta →
			</Button>
		</div>
	{:else}
		<!-- Layout Dividido de Pantalla Completa (Estilo POS / Terminal de Ventas) -->
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
			
			<!-- ======================================================== -->
			<!-- COLUMNA IZQUIERDA: CATÁLOGO, ATAJOS Y ASISTENTE (7 cols) -->
			<!-- ======================================================== -->
			<div class="space-y-6 lg:col-span-7 pb-24 lg:pb-0">
				
				{#if configuringProduct}
					<!-- Panel de Configuración Enfocada del Producto Seleccionado -->
					<div class="rounded-2xl border-2 border-primary/40 bg-card p-6 shadow-md space-y-6">
						<div class="flex items-start justify-between gap-4 border-b border-border pb-4">
							<div class="space-y-1">
								<div class="flex items-center gap-2">
									<span class="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
										{configuringProduct.code}
									</span>
									<h2 class="text-xl font-bold text-foreground">
										{configuringProduct.name}
									</h2>
									{#if configuringProduct.isCombo}
										<Badge variant="secondary" class="gap-1">
											<Sparkles class="size-3 text-primary" />
											Combo
										</Badge>
									{/if}
								</div>
								<p class="text-xs text-muted-foreground">
									Precio de lista oficial: <strong class="text-foreground">{formatCurrency(configuringProduct.salePrice)}</strong>
								</p>
							</div>

							<Button
								type="button"
								variant="ghost"
								size="sm"
								onclick={() => (configuringProduct = null)}
								class="text-xs text-muted-foreground hover:text-foreground"
							>
								<X class="size-4 mr-1" />
								<span>Cancelar</span>
							</Button>
						</div>

						<!-- PASO A: CANTIDAD -->
						<div class="space-y-3">
							<div class="flex items-center justify-between">
								<Label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
									1. Cantidad de Unidades
								</Label>
								<span class="font-mono text-xs font-bold text-foreground">
									{itemConfigQuantity} {itemConfigQuantity === 1 ? 'unidad' : 'unidades'}
								</span>
							</div>

							<!-- Input con Menos y Más -->
							<div class="flex items-center">
								<Button
									type="button"
									variant="outline"
									size="icon"
									onclick={() => changeConfigQuantity(-1)}
									class="size-11 rounded-r-none border-r-0 hover:bg-accent active:scale-95 transition-all"
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
									class="size-11 rounded-l-none border-l-0 hover:bg-accent active:scale-95 transition-all"
								>
									<Plus class="size-4" />
								</Button>
							</div>
						</div>

						<!-- PASO B: ASIGNACIÓN AUTOMÁTICA DE PRECIO SEGÚN ESCALA POR CANTIDAD -->
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

							<!-- Banner si se aplicó automáticamente una escala por cantidad -->
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
											{formatCurrency((configuringProduct.salePrice - effectiveConfigUnitPrice) * itemConfigQuantity)}
										</span>
									</div>
								</div>
							{:else if configuringProduct.pricingTiers && configuringProduct.pricingTiers.length > 0}
								<!-- Escalas disponibles para que el vendedor sepa cuánto falta para activar descuento -->
								<div class="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
									<div class="flex items-center justify-between text-xs">
										<span class="text-muted-foreground">Escalas de descuento predefinidas en este producto:</span>
										<span class="font-mono text-[11px] text-muted-foreground">Precio base: {formatCurrency(configuringProduct.salePrice)}</span>
									</div>
									<div class="flex flex-wrap gap-2">
										{#each configuringProduct.pricingTiers as tier}
											{@const targetUnitPrice = tier.type === 'percentage' ? configuringProduct.salePrice * (1 - tier.value / 100) : tier.value}
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

							<!-- Subtotal del Ítem Calculado -->
							<div class="flex items-center justify-between rounded-xl bg-muted/30 p-3">
								<span class="text-xs text-muted-foreground">
									Subtotal por {itemConfigQuantity} {itemConfigQuantity === 1 ? 'unidad' : 'unidades'}:
								</span>
								<span class="font-mono text-base font-bold text-foreground">
									{formatCurrency(itemConfigQuantity * effectiveConfigUnitPrice)}
								</span>
							</div>
						</div>

						<!-- PASO C: MODALIDAD DE LA ORDEN Y ENTREGA -->
						<div class="space-y-4 border-t border-border pt-4">
							<Label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								3. Modalidad de la Orden y Entrega
							</Label>

							{#if itemConfigStep === 'config'}
								<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
									<!-- Botón A: Orden Inmediata (1 Clic y listo) -->
									<button
										type="button"
										onclick={addImmediateItem}
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

									<!-- Botón B: Orden por Encargo -->
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
								<!-- Paso Detalles de Orden por Encargo -->
								<div class="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-4">
									<div>
										<h4 class="text-sm font-semibold text-amber-900">
											Detalles de la Orden por Encargo para {configuringProduct.name}
										</h4>
										<p class="text-xs text-muted-foreground mt-0.5">
											Ingresa la fecha y hora pactada de entrega y cualquier indicación para elaboración.
										</p>
									</div>

									<div class="space-y-3">
										<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
											<div class="space-y-1.5">
												<Label for="item-delivery-date" class="text-xs font-semibold">
													Fecha de Entrega
												</Label>
												<input
													id="item-delivery-date"
													type="date"
													min={minDeliveryDateOnly}
													bind:value={configDeliveryDateOnly}
													onchange={syncDeliveryDateTime}
													class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
												/>
											</div>

											<div class="space-y-1.5">
												<div class="flex items-center justify-between">
													<Label for="item-delivery-time" class="text-xs font-semibold">
														Hora Pactada
													</Label>
													<span class="text-[10px] text-muted-foreground font-mono">Paso: 15 min</span>
												</div>
												<select
													id="item-delivery-time"
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

									<!-- Botonera: Volver/Orden Inmediata a la izquierda, Confirmar Encargo a la derecha -->
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
											onclick={addPreorderItem}
										>
											<Check class="size-4" />
											<span>Agregar Encargo a la Orden</span>
										</Button>
									</div>
								</div>
							{/if}
						</div>
					</div>
				{:else}
					<!-- Vista Normal: Buscador y Atajos Rápidos -->
					<div class="space-y-6">
						<!-- Buscador -->
						<div class="relative">
							<Search class="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<input
								type="text"
								bind:value={productSearchQuery}
								placeholder="Buscar producto por nombre o código (ej: Torta, Mousse, COMBO)..."
								class="flex h-12 w-full rounded-2xl border border-input bg-card pl-10 pr-9 text-sm shadow-xs transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
							/>
							{#if productSearchQuery}
								<button
									type="button"
									onclick={() => (productSearchQuery = '')}
									class="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
								>
									<X class="size-4" />
								</button>
							{/if}
						</div>

						<!-- Resultados si hay búsqueda -->
						{#if productSearchQuery.trim()}
							<div class="rounded-2xl border border-border bg-card p-3 shadow-md space-y-1">
								<h4 class="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
									Resultados ({searchResults.length})
								</h4>
								{#if searchResults.length === 0}
									<p class="p-4 text-center text-xs text-muted-foreground">
										No hay coincidencias para "{productSearchQuery}"
									</p>
								{:else}
									<div class="max-h-60 overflow-y-auto divide-y divide-border/50">
										{#each searchResults as prod (prod.id)}
											<button
												type="button"
												onclick={() => startConfiguringProduct(prod)}
												class="flex w-full items-center justify-between rounded-xl p-3 text-left transition-all hover:bg-primary/10 group cursor-pointer active:scale-[0.99]"
											>
												<div class="min-w-0 pr-3">
													<div class="flex items-center gap-2">
														<span class="font-mono text-xs font-semibold text-muted-foreground">
															[{prod.code}]
														</span>
														<span class="font-bold text-sm text-foreground group-hover:text-primary">
															{prod.name}
														</span>
														{#if prod.isCombo}
															<Badge variant="secondary" class="text-[10px]">Combo</Badge>
														{/if}
													</div>
												</div>
												<div class="flex items-center gap-2 shrink-0">
													<span class="font-mono text-sm font-bold text-foreground">
														{formatCurrency(prod.salePrice)}
													</span>
													<span class="rounded-lg bg-primary/20 px-2.5 py-1 text-xs font-bold text-primary">
														Seleccionar →
													</span>
												</div>
											</button>
										{/each}
									</div>
								{/if}
							</div>
						{/if}

						<!-- Atajos Rápidos de Venta -->
						<div class="space-y-3">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-1.5">
									<Star class="size-4 text-amber-500 fill-amber-500" />
									<h3 class="text-sm font-bold uppercase tracking-wider text-muted-foreground">
										Atajos Rápidos de Venta
									</h3>
								</div>
								<span class="text-xs text-muted-foreground">
									Toca para configurar cantidad y modalidad
								</span>
							</div>

							{#if shortcutProducts.length > 0}
								<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
									{#each shortcutProducts as prod (prod.id)}
										<button
											type="button"
											onclick={() => startConfiguringProduct(prod)}
											class="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-3.5 shadow-2xs transition-all hover:border-primary hover:bg-muted/10 hover:shadow-sm text-left cursor-pointer active:scale-[0.98]"
										>
											<div class="flex flex-1 flex-col pr-6">
												<span class="font-mono text-[10px] text-muted-foreground">{prod.code}</span>
												<h4 class="mt-1 line-clamp-2 text-xs font-bold text-foreground group-hover:text-primary transition-colors">
													{prod.name}
												</h4>
												{#if prod.isCombo}
													<span class="mt-0.5 inline-block text-[9px] font-semibold text-primary">
														Combo
													</span>
												{/if}
												<div class="mt-2 font-mono text-sm font-bold text-emerald-600">
													{formatCurrency(prod.salePrice)}
												</div>
											</div>
											<span
												role="button"
												tabindex="0"
												title="Quitar de atajos"
												onclick={(e) => {
													e.stopPropagation();
													toggleProductShortcut(prod);
												}}
												onkeydown={(e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.stopPropagation();
														toggleProductShortcut(prod);
													}
												}}
												class="absolute right-2.5 top-2.5 rounded p-1 text-amber-500 hover:bg-muted cursor-pointer z-10 transition-colors"
											>
												<Star class="size-3.5 fill-amber-500" />
											</span>
										</button>
									{/each}
								</div>
							{:else}
								<!-- Fallback sugeridos -->
								<div class="rounded-2xl border border-dashed border-border bg-card p-5 space-y-3">
									<p class="text-xs text-muted-foreground">
										Aún no has fijado atajos favoritos. Toca la estrella ⭐ para guardarlos aquí o elige uno de estos productos sugeridos:
									</p>
									<div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
										{#each fallbackSuggestedProducts as prod (prod.id)}
											<button
												type="button"
												onclick={() => startConfiguringProduct(prod)}
												class="group relative flex flex-col justify-between rounded-xl border border-border bg-background p-3 text-left transition-all hover:border-primary hover:bg-muted/10 cursor-pointer active:scale-[0.98]"
											>
												<div class="flex flex-col pr-5">
													<span class="font-mono text-[10px] text-muted-foreground">{prod.code}</span>
													<span class="line-clamp-1 text-xs font-bold text-foreground group-hover:text-primary transition-colors">{prod.name}</span>
													<span class="mt-1 font-mono text-xs font-bold text-emerald-600">{formatCurrency(prod.salePrice)}</span>
												</div>
												<span
													role="button"
													tabindex="0"
													title="Fijar como atajo"
													onclick={(e) => {
														e.stopPropagation();
														toggleProductShortcut(prod);
													}}
													onkeydown={(e) => {
														if (e.key === 'Enter' || e.key === ' ') {
															e.stopPropagation();
															toggleProductShortcut(prod);
														}
													}}
													class="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:text-amber-500 cursor-pointer z-10 transition-colors"
												>
													<Star class="size-3.5" />
												</span>
											</button>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			<!-- ======================================================== -->
			<!-- COLUMNA DERECHA: COMANDERO / CARRITO EN VIVO (5 cols)    -->
			<!-- ======================================================== -->
			{#snippet cartContent(isMobileDrawer = false)}
				<input type="hidden" name="businessId" value={data.activeBusiness.id} />
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
													Inmediato
												</span>
											{:else}
												<span class="rounded bg-amber-500/10 px-1.5 py-0.2 text-[10px] font-bold text-amber-700">
													Encargo
												</span>
											{/if}
											{#if line.discountLabel}
												<span class="rounded bg-sky-500/15 px-1.5 py-0.2 text-[10px] font-bold text-sky-700">
													{line.discountLabel}
												</span>
											{/if}
										</div>

										<!-- Nota del Producto (Destacada) -->
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
											onclick={() => changeLineQuantity(idx, -1)}
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
											onclick={() => changeLineQuantity(idx, 1)}
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
										onclick={() => removeDraftLine(idx)}
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
						<!-- Desglose informativo cuando se combinan ambos -->
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

					<!-- Botones de Selección de Cobro (Total vs Seña) -->
					{#if draftHasPreorder}
						<div class="grid grid-cols-2 gap-2">
							<!-- Opción 1: Total 100% -->
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

							<!-- Opción 2: Seña Parcial -->
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

					<!-- Panel de Ajuste de Seña con Slider -->
					{#if draftHasPreorder && draftPaymentStatus === 'partially_paid' && draftPaidAmount < draftTotalAmount}
						<div class="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3.5 space-y-3">
							<Label class="text-xs font-semibold text-foreground">
								{draftIsMixed ? 'Ajuste de Seña sobre el Encargo' : 'Ajuste de Seña'}
							</Label>

							<!-- Slider de Seña: min es lo inmediato, max es el total de la orden -->
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

							<!-- Campo Numérico Sincronizado -->
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
								class="size-4 mt-0.5 rounded border-border text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer"
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
						class="w-full h-12 text-sm font-bold gap-2 shadow-md cursor-pointer {draftCreateAsUnconfirmed ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}"
					>
						<Check class="size-5" />
						{#if draftCreateAsUnconfirmed}
							<span>Guardar Pedido Por Confirmar ({formatCurrency(draftTotalAmount)})</span>
						{:else}
							<span>Confirmar y Emitir Orden ({formatCurrency(draftTotalAmount)})</span>
						{/if}
					</Button>
				</div>
			{/snippet}

			<!-- Versión Desktop: Columna lateral fija -->
			<div class="hidden lg:block lg:col-span-5">
				<form
					method="POST"
					action="?/createOrder"
					use:enhance={() => {
						isSubmitting = true;
						return async ({ update }) => {
							await update();
							isSubmitting = false;
						};
					}}
					class="sticky top-6 rounded-2xl border border-border bg-card p-6 shadow-lg space-y-5"
				>
					{@render cartContent(false)}
				</form>
			</div>

			<!-- Versión Mobile: Barra Flotante Inferior de Carrito -->
			{#if draftLines.length > 0}
				<div class="fixed bottom-4 inset-x-4 z-40 lg:hidden">
					<button
						type="button"
						onclick={() => (isMobileCartOpen = true)}
						class="flex w-full items-center justify-between rounded-2xl bg-primary p-3.5 text-primary-foreground shadow-2xl transition-all active:scale-[0.98] cursor-pointer"
					>
						<div class="flex items-center gap-3">
							<div class="relative flex size-10 items-center justify-center rounded-xl bg-white/20">
								<ShoppingCart class="size-5" />
								<span class="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-destructive text-[11px] font-bold text-white shadow-xs">
									{draftLines.reduce((s, l) => s + l.quantity, 0)}
								</span>
							</div>
							<div class="text-left">
								<p class="text-[11px] font-medium text-primary-foreground/80">
									{draftLines.length} {draftLines.length === 1 ? 'producto' : 'productos'} en la Orden
								</p>
								<p class="font-mono text-base font-bold leading-none">{formatCurrency(draftTotalAmount)}</p>
							</div>
						</div>
						<div class="flex items-center gap-1.5 font-bold text-xs bg-white/20 px-3 py-2 rounded-xl">
							<span>Ver Orden</span>
							<ChevronUp class="size-4" />
						</div>
					</button>
				</div>
			{/if}

			<!-- Versión Mobile: Drawer / Modal Deslizable de la Comanda -->
			{#if isMobileCartOpen}
				<div class="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
					<!-- Backdrop -->
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
						onclick={() => (isMobileCartOpen = false)}
					></div>

					<!-- Panel Drawer -->
					<div class="relative z-10 max-h-[90vh] flex flex-col rounded-t-3xl border-t border-border bg-card p-5 shadow-2xl overflow-hidden">
						<!-- Header Drawer con botón cerrar -->
						<div class="flex items-center justify-between pb-3 border-b border-border">
							<div class="flex items-center gap-2">
								<ShoppingCart class="size-5 text-primary" />
								<h3 class="text-base font-bold text-foreground">Orden de Compra</h3>
								<span class="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-bold text-primary">
									{draftLines.length}
								</span>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								class="size-8 cursor-pointer"
								onclick={() => (isMobileCartOpen = false)}
							>
								<X class="size-5" />
							</Button>
						</div>

						<!-- Formulario scrolleable dentro del Drawer -->
						<form
							method="POST"
							action="?/createOrder"
							use:enhance={() => {
								isSubmitting = true;
								return async ({ update }) => {
									await update();
									isSubmitting = false;
									isMobileCartOpen = false;
								};
							}}
							class="overflow-y-auto space-y-5 pt-3"
						>
							{@render cartContent(true)}
						</form>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</AppShell>
