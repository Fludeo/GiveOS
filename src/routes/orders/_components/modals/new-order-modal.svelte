<script lang="ts">
	import { enhance } from '$app/forms';
	import type {
		OrderItemFulfillmentType,
		PaymentStatus,
		SalesProductWithItems
	} from '#lib/features/orders/domain/order.entity';
	import { calculateEffectiveUnitPrice } from '#lib/features/orders/domain/order.entity';
	import { Button } from '#lib/components/ui/button';
	import { Badge } from '#lib/components/ui/badge';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import Clock from '@lucide/svelte/icons/clock';
	import Calendar from '@lucide/svelte/icons/calendar';
	import Check from '@lucide/svelte/icons/check';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Zap from '@lucide/svelte/icons/zap';
	import Minus from '@lucide/svelte/icons/minus';
	import CreditCard from '@lucide/svelte/icons/credit-card';
	import Star from '@lucide/svelte/icons/star';
	import Tag from '@lucide/svelte/icons/tag';
	import {
		formatCurrency,
		formatDateTime,
		roundToNext15Minutes,
		toDateString,
		toTimeString,
		time15Slots,
		type DraftOrderLine
	} from '../utils';

	interface Props {
		open: boolean;
		salesProducts: SalesProductWithItems[];
		businessId: string;
		onClose: () => void;
	}

	let { open = $bindable(false), salesProducts, businessId, onClose }: Props = $props();

	type OrderModalView = 'catalog' | 'item_config' | 'checkout';
	type ItemWizardStep = 'quantity' | 'type' | 'preorder_details';

	let orderModalView = $state<OrderModalView>('catalog');
	let productSearchQuery = $state('');

	let configuringProduct = $state<SalesProductWithItems | null>(null);
	let itemWizardStep = $state<ItemWizardStep>('quantity');
	let itemConfigQuantity = $state(1);
	let itemConfigUnitPrice = $state(0);
	let itemConfigFulfillmentType = $state<OrderItemFulfillmentType>('immediate');
	let itemConfigDeliveryDate = $state('');
	let itemConfigNotes = $state('');

	let draftCustomerName = $state('Cliente Mostrador');
	let draftPaymentStatus = $state<PaymentStatus>('paid');
	let draftPaidAmount = $state(0);
	let draftDeliveryDate = $state('');
	let draftNotes = $state('');
	let draftLines = $state<DraftOrderLine[]>([]);

	let modalDeliveryDateOnly = $state(toDateString(new Date()));
	let modalDeliveryTimeOnly = $state(
		toTimeString(roundToNext15Minutes(new Date(Date.now() + 2 * 3600_000)))
	);

	const minDeliveryDateOnly = $derived(toDateString(new Date()));

	const shortcutProducts = $derived(salesProducts.filter((p) => p.isShortcut));
	const suggestedFallbackProducts = $derived(
		shortcutProducts.length === 0 ? salesProducts.slice(0, 6) : []
	);
	const filteredProductsBySearch = $derived(
		productSearchQuery.trim()
			? salesProducts.filter(
					(p) =>
						p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
						p.code.toLowerCase().includes(productSearchQuery.toLowerCase())
				)
			: []
	);

	const draftTotalAmount = $derived(
		draftLines.reduce(
			(sum, l) =>
				sum +
				(l.quantity > 0 ? l.quantity : 0) * (l.unitPrice >= 0 ? l.unitPrice : 0),
			0
		)
	);

	$effect(() => {
		if (draftPaymentStatus === 'paid') {
			draftPaidAmount = Number(draftTotalAmount.toFixed(2));
		} else if (draftPaymentStatus === 'pending') {
			draftPaidAmount = 0;
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

	const modalItemPriceCalc = $derived.by(() => {
		if (!configuringProduct) return { unitPrice: 0, discountPct: 0, appliedTier: null };
		return calculateEffectiveUnitPrice(
			configuringProduct.salePrice,
			itemConfigQuantity,
			configuringProduct.pricingTiers ?? []
		);
	});

	function syncModalDeliveryDateTime() {
		if (!modalDeliveryDateOnly) {
			itemConfigDeliveryDate = '';
			return;
		}
		itemConfigDeliveryDate = `${modalDeliveryDateOnly}T${modalDeliveryTimeOnly || '12:00'}`;
	}

	function setQuickDeliveryOffset(hoursFromNow: number) {
		const base = new Date(Date.now() + hoursFromNow * 3600_000);
		const rounded = roundToNext15Minutes(base);
		modalDeliveryDateOnly = toDateString(rounded);
		modalDeliveryTimeOnly = toTimeString(rounded);
		itemConfigDeliveryDate = `${modalDeliveryDateOnly}T${modalDeliveryTimeOnly}`;
	}

	function startConfiguringProduct(product: SalesProductWithItems) {
		configuringProduct = product;
		itemWizardStep = 'quantity';
		itemConfigQuantity = 1;
		itemConfigUnitPrice = product.salePrice;
		itemConfigFulfillmentType = 'immediate';

		const initialSlot = roundToNext15Minutes(new Date(Date.now() + 2 * 3600_000));
		if (draftDeliveryDate && draftDeliveryDate.includes('T')) {
			const [d, t] = draftDeliveryDate.split('T');
			modalDeliveryDateOnly = d;
			modalDeliveryTimeOnly = t ? t.slice(0, 5) : toTimeString(initialSlot);
			itemConfigDeliveryDate = draftDeliveryDate;
		} else {
			modalDeliveryDateOnly = toDateString(initialSlot);
			modalDeliveryTimeOnly = toTimeString(initialSlot);
			itemConfigDeliveryDate = `${modalDeliveryDateOnly}T${modalDeliveryTimeOnly}`;
		}
		itemConfigNotes = '';
		orderModalView = 'item_config';
	}

	function finishAddingImmediateItem() {
		if (!configuringProduct) return;
		draftLines = [
			...draftLines,
			{
				key: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
				salesProductId: configuringProduct.id,
				productName: configuringProduct.name,
				productCode: configuringProduct.code,
				isCombo: configuringProduct.isCombo,
				quantity: itemConfigQuantity > 0 ? itemConfigQuantity : 1,
				unitPrice: modalItemPriceCalc.unitPrice,
				fulfillmentType: 'immediate',
				deliveryDate: '',
				notes: ''
			}
		];
		configuringProduct = null;
		productSearchQuery = '';
		orderModalView = 'catalog';
	}

	function finishAddingPreorderItem() {
		if (!configuringProduct) return;
		if (itemConfigDeliveryDate && !draftDeliveryDate) {
			draftDeliveryDate = itemConfigDeliveryDate;
		}
		draftLines = [
			...draftLines,
			{
				key: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
				salesProductId: configuringProduct.id,
				productName: configuringProduct.name,
				productCode: configuringProduct.code,
				isCombo: configuringProduct.isCombo,
				quantity: itemConfigQuantity > 0 ? itemConfigQuantity : 1,
				unitPrice: modalItemPriceCalc.unitPrice,
				fulfillmentType: 'preorder',
				deliveryDate: itemConfigDeliveryDate,
				notes: itemConfigNotes.trim()
			}
		];
		configuringProduct = null;
		productSearchQuery = '';
		orderModalView = 'catalog';
	}

	function cancelConfiguringItem() {
		configuringProduct = null;
		orderModalView = 'catalog';
	}

	function changeConfigQuantity(delta: number) {
		const next = Math.max(1, Number((itemConfigQuantity + delta).toFixed(2)));
		itemConfigQuantity = next;
	}

	function removeDraftLine(index: number) {
		draftLines = draftLines.filter((_, idx) => idx !== index);
	}

	function changeLineQuantity(index: number, delta: number) {
		const current = draftLines[index].quantity;
		const next = Math.max(1, Number((current + delta).toFixed(2)));
		draftLines[index].quantity = next;

		const prod = salesProducts.find((p) => p.id === draftLines[index].salesProductId);
		if (prod) {
			const calc = calculateEffectiveUnitPrice(prod.salePrice, next, prod.pricingTiers ?? []);
			draftLines[index].unitPrice = calc.unitPrice;
		}
	}

	async function toggleProductShortcut(product: SalesProductWithItems) {
		product.isShortcut = !product.isShortcut;
		const form = new FormData();
		form.set('productId', product.id);
		form.set('businessId', businessId);
		try {
			await fetch('?/toggleShortcut', {
				method: 'POST',
				body: form
			});
		} catch (e) {
			console.error('Error toggling shortcut:', e);
		}
	}

	function setDepositPercentage(pct: number) {
		draftPaymentStatus = 'partially_paid';
		draftPaidAmount = Number(((draftTotalAmount * pct) / 100).toFixed(2));
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 p-0 sm:p-4 backdrop-blur-[1px]"
		role="dialog"
		aria-modal="true"
		aria-labelledby="new-order-modal-title"
	>
		<div
			class="flex max-h-[94vh] sm:max-h-[92vh] w-full max-w-full sm:max-w-3xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border-t sm:border border-border bg-card shadow-2xl"
		>
			<!-- Header del Modal -->
			<div class="border-b border-border bg-muted/30 px-6 py-4">
				<div class="flex items-start justify-between gap-4">
					<div class="space-y-1">
						<div class="flex flex-wrap items-center gap-2">
							<Badge variant="secondary" class="text-xs">
								Nueva Orden de Compra
							</Badge>
							{#if orderModalView === 'catalog'}
								<Badge variant="outline" class="text-xs text-muted-foreground">
									{draftLines.length}{' '}
									{draftLines.length === 1 ? 'producto cargado' : 'productos cargados'}
								</Badge>
							{:else if orderModalView === 'item_config'}
								<Badge
									variant="outline"
									class="border-primary/40 bg-primary/10 text-primary text-xs"
								>
									Configurando ítem
								</Badge>
							{:else}
								<Badge
									variant="outline"
									class="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 text-xs"
								>
									Paso Final: Cobro y Cliente
								</Badge>
							{/if}
						</div>
						<h2 id="new-order-modal-title" class="text-lg font-bold text-foreground">
							{#if orderModalView === 'catalog'}
								Crear Orden de Compra
							{:else if orderModalView === 'item_config'}
								Configurar Producto: {configuringProduct?.name}
							{:else}
								Cobro y Confirmación de la Orden
							{/if}
						</h2>
					</div>

					<div class="flex items-center gap-2">
						{#if orderModalView !== 'catalog'}
							<Button
								type="button"
								size="sm"
								variant="outline"
								class="h-8 gap-1 text-xs"
								onclick={() => (orderModalView = 'catalog')}
							>
								<ArrowLeft class="size-3.5" />
								<span>Volver al Catálogo</span>
							</Button>
						{/if}
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
				</div>
			</div>

			{#if salesProducts.length === 0}
				<div class="space-y-4 p-8 text-center">
					<Tag class="mx-auto size-10 text-muted-foreground" />
					<p class="text-base font-semibold text-foreground">
						Primero debes habilitar al menos un Producto para Venta
					</p>
					<p class="mx-auto max-w-md text-sm text-muted-foreground">
						Ve a la pestaña "Productos para Venta" dentro de Inventario para asociar tus
						productos finales con un precio comercial.
					</p>
					<div class="flex justify-center gap-3 pt-2">
						<Button variant="outline" onclick={onClose}>
							Cerrar
						</Button>
						<Button href="/inventory?tab=products">
							Ir a Productos para Venta →
						</Button>
					</div>
				</div>
			{:else}
				<!-- VISTA 1: CATÁLOGO, BUSCADOR, ATAJOS Y TARJETAS CARGADAS -->
				{#if orderModalView === 'catalog'}
					<div class="flex-1 overflow-y-auto p-6 space-y-6">
						<!-- 1. Buscador Rápido de Productos -->
						<div class="space-y-2">
							<Label
								for="order-prod-search"
								class="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
							>
								Buscador de Productos
							</Label>
							<div class="relative">
								<Search
									class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
								/>
								<Input
									id="order-prod-search"
									type="text"
									bind:value={productSearchQuery}
									placeholder="Escribe el nombre o código del producto (ej: Selva Negra, T-01, Combo)..."
									class="h-11 rounded-xl pl-9 pr-8 text-sm"
								/>
								{#if productSearchQuery}
									<Button
										type="button"
										variant="ghost"
										size="icon"
										onclick={() => (productSearchQuery = '')}
										class="absolute right-1.5 top-1/2 -translate-y-1/2 size-7 text-muted-foreground hover:text-foreground"
									>
										<X class="size-3.5" />
									</Button>
								{/if}
							</div>

							{#if productSearchQuery.trim()}
								<div class="mt-2 rounded-xl border border-border bg-card p-2 shadow-md">
									{#if filteredProductsBySearch.length === 0}
										<div class="p-4 text-center text-xs text-muted-foreground">
											No se encontraron productos coincidentes con "{productSearchQuery}".
										</div>
									{:else}
										<div class="max-h-48 overflow-y-auto divide-y divide-border/50">
											{#each filteredProductsBySearch as prod (prod.id)}
												<button
													type="button"
													onclick={() => startConfiguringProduct(prod)}
													class="flex w-full items-center justify-between rounded-lg p-2.5 text-left transition-colors hover:bg-primary/10 group"
												>
													<div class="min-w-0 pr-3">
														<div class="flex items-center gap-2">
															<span
																class="font-mono text-xs font-semibold text-muted-foreground"
															>
																[{prod.code}]
															</span>
															<span
																class="font-medium text-sm text-foreground group-hover:text-primary"
															>
																{prod.name}
															</span>
															{#if prod.isCombo}
																<Badge variant="secondary" class="gap-1 text-[10px]">
																	<Sparkles class="size-2.5 text-primary" />
																	Combo
																</Badge>
															{/if}
														</div>
													</div>
													<div class="flex items-center gap-2 shrink-0">
														<span class="font-mono text-sm font-bold text-foreground">
															{formatCurrency(prod.salePrice)}
														</span>
														<span
															class="rounded bg-primary/20 px-2 py-1 text-xs font-semibold text-primary"
														>
															+ Cargar
														</span>
													</div>
												</button>
											{/each}
										</div>
									{/if}
								</div>
							{/if}
						</div>

						<!-- 2. Botones de Productos Atajos / Frecuentes -->
						<div class="space-y-2.5">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-1.5">
									<Star class="size-4 text-amber-500 fill-amber-500" />
									<Label
										class="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
									>
										Atajos Rápidos de Venta
									</Label>
								</div>
								<span class="text-[11px] text-muted-foreground">
									Toca un botón para iniciar su configuración
								</span>
							</div>

							{#if shortcutProducts.length > 0}
								<div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
									{#each shortcutProducts as prod (prod.id)}
										<button
											type="button"
											onclick={() => startConfiguringProduct(prod)}
											class="group relative flex flex-col justify-between rounded-xl border border-border bg-card p-3 shadow-2xs transition-all hover:border-primary hover:bg-muted/10 text-left cursor-pointer active:scale-[0.98]"
										>
											<div class="flex flex-1 flex-col pr-5">
												<div class="flex items-start justify-between gap-1">
													<span class="font-mono text-[10px] text-muted-foreground">
														{prod.code}
													</span>
													{#if prod.isCombo}
														<span
															class="rounded bg-primary/10 px-1 py-0.2 text-[9px] font-bold text-primary"
														>
															Combo
														</span>
													{/if}
												</div>
												<h4
													class="mt-1 line-clamp-2 text-xs font-semibold text-foreground group-hover:text-primary transition-colors"
												>
													{prod.name}
												</h4>
												<div
													class="mt-2 font-mono text-xs font-bold text-emerald-600"
												>
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
												class="absolute right-2 top-2 rounded p-1 text-amber-500 hover:bg-muted cursor-pointer z-10 transition-colors"
											>
												<Star class="size-3.5 fill-amber-500" />
											</span>
										</button>
									{/each}
								</div>
							{:else}
								<div
									class="rounded-xl border border-dashed border-border p-4 bg-muted/10 space-y-3"
								>
									<p class="text-xs text-muted-foreground">
										Aún no tienes atajos marcados. Toca la estrella ⭐ para fijar
										productos frecuentes, o toca cualquiera de estos sugeridos:
									</p>
									<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
										{#each suggestedFallbackProducts as prod (prod.id)}
											<button
												type="button"
												onclick={() => startConfiguringProduct(prod)}
												class="group relative flex flex-col justify-between rounded-xl border border-border bg-card p-2.5 text-left transition-all hover:border-primary hover:bg-muted/10 cursor-pointer active:scale-[0.98]"
											>
												<div class="flex flex-col pr-5">
													<span class="font-mono text-[10px] text-muted-foreground"
														>{prod.code}</span
													>
													<span
														class="line-clamp-1 text-xs font-semibold text-foreground group-hover:text-primary transition-colors"
														>{prod.name}</span
													>
													<span
														class="mt-1 font-mono text-xs font-bold text-emerald-600"
														>{formatCurrency(prod.salePrice)}</span
													>
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
													class="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:text-amber-500 hover:bg-muted cursor-pointer z-10 transition-colors"
												>
													<Star class="size-3.5" />
												</span>
											</button>
										{/each}
									</div>
								</div>
							{/if}
						</div>

						<!-- 3. Tarjetas Configuradas en la Orden -->
						<div class="space-y-3 pt-2">
							<div class="flex items-center justify-between border-t border-border pt-4">
								<div class="flex items-center gap-2">
									<ShoppingBag class="size-4 text-primary" />
									<Label
										class="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
									>
										Productos en la Orden ({draftLines.length})
									</Label>
								</div>
								<span class="font-mono text-sm font-bold text-foreground">
									Subtotal: {formatCurrency(draftTotalAmount)}
								</span>
							</div>

							{#if draftLines.length === 0}
								<div
									class="rounded-xl border border-dashed border-border/80 bg-muted/5 p-8 text-center"
								>
									<ShoppingBag class="mx-auto size-8 text-muted-foreground/40" />
									<p class="mt-2 text-sm font-medium text-foreground">
										La orden está vacía
									</p>
									<p class="text-xs text-muted-foreground">
										Toca un atajo rápido arriba o busca un producto para comenzar a
										armar la venta.
									</p>
								</div>
							{:else}
								<div class="space-y-2.5">
									{#each draftLines as line, idx (line.key)}
										<div
											class="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-2xs transition-all hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between"
										>
											<div class="min-w-0 flex-1 space-y-1">
												<div class="flex flex-wrap items-center gap-2">
													<span
														class="rounded bg-muted px-2 py-0.5 font-mono text-xs font-bold text-foreground"
													>
														{line.quantity} ×
													</span>
													<span class="font-semibold text-sm text-foreground">
														{line.productName}
													</span>
													{#if line.fulfillmentType === 'immediate'}
														<Badge
															variant="outline"
															class="gap-1 border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-700"
														>
															<Zap class="size-2.5" />
															Venta Inmediata
														</Badge>
													{:else}
														<Badge
															variant="outline"
															class="gap-1 border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700"
														>
															<Clock class="size-2.5" />
															Por Encargo
														</Badge>
													{/if}
												</div>

												<div
													class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
												>
													<span>Unitario: {formatCurrency(line.unitPrice)}</span>
													{#if line.fulfillmentType === 'preorder' && line.deliveryDate}
														<span
															class="flex items-center gap-1 font-mono text-amber-700"
														>
															<Calendar class="size-3" />
															{formatDateTime(line.deliveryDate)}
														</span>
													{/if}
													{#if line.notes}
														<span class="italic text-foreground/80">
															“{line.notes}”
														</span>
													{/if}
												</div>
											</div>

											<div
												class="flex items-center justify-between gap-3 border-t border-border/40 pt-2 sm:border-t-0 sm:pt-0"
											>
												<div class="flex items-center">
													<Button
														type="button"
														variant="outline"
														size="icon"
														onclick={() => changeLineQuantity(idx, -1)}
														class="size-7 rounded-r-none border-r-0 p-0 text-foreground"
													>
														<Minus class="size-3" />
													</Button>
													<span
														class="flex h-7 w-8 items-center justify-center border border-input bg-background font-mono text-xs font-bold"
													>
														{line.quantity}
													</span>
													<Button
														type="button"
														variant="outline"
														size="icon"
														onclick={() => changeLineQuantity(idx, 1)}
														class="size-7 rounded-l-none border-l-0 p-0 text-foreground"
													>
														<Plus class="size-3" />
													</Button>
												</div>

												<span class="font-mono text-sm font-bold text-foreground">
													{formatCurrency(line.quantity * line.unitPrice)}
												</span>

												<Button
													type="button"
													size="icon"
													variant="ghost"
													class="size-8 text-muted-foreground hover:text-destructive"
													onclick={() => removeDraftLine(idx)}
												>
													<Trash2 class="size-4" />
												</Button>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</div>

					<!-- Barra Inferior de Acción -->
					<div
						class="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-4"
					>
						<div>
							{#if draftLines.length > 0}
								<Button
									type="button"
									variant="ghost"
									class="text-xs text-muted-foreground hover:text-destructive"
									onclick={() => (draftLines = [])}
								>
									Vaciar Orden
								</Button>
							{:else}
								<Button type="button" variant="outline" onclick={onClose}>
									Cerrar
								</Button>
							{/if}
						</div>

						<div class="flex items-center gap-3">
							<div class="text-right">
								<span class="block text-[11px] text-muted-foreground"
									>Total de la Orden</span
								>
								<span class="font-mono text-base font-bold text-foreground">
									{formatCurrency(draftTotalAmount)}
								</span>
							</div>

							<Button
								type="button"
								disabled={draftLines.length === 0}
								class="gap-1.5 font-semibold"
								onclick={() => (orderModalView = 'checkout')}
							>
								<span>Continuar a Cobro</span>
								<ArrowRight class="size-4" />
							</Button>
						</div>
					</div>
				{/if}

				<!-- VISTA 2: CONFIGURACIÓN PASO A PASO DEL ÍTEM SELECCIONADO -->
				{#if orderModalView === 'item_config' && configuringProduct}
					<div class="flex-1 overflow-y-auto p-6 space-y-6">
						<div
							class="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4"
						>
							<div>
								<div class="flex items-center gap-2">
									<span class="font-mono text-xs font-bold text-primary">
										[{configuringProduct.code}]
									</span>
									<h3 class="text-base font-bold text-foreground">
										{configuringProduct.name}
									</h3>
									{#if configuringProduct.isCombo}
										<Badge variant="secondary" class="text-[10px]">Combo</Badge>
									{/if}
								</div>
								<p class="mt-0.5 text-xs text-muted-foreground">
									Precio unitario base: {formatCurrency(configuringProduct.salePrice)}
								</p>
							</div>
							<div class="text-right">
								<span class="text-xs text-muted-foreground">Subtotal Ítem</span>
								<p class="font-mono text-lg font-bold text-foreground">
									{formatCurrency(itemConfigQuantity * itemConfigUnitPrice)}
								</p>
							</div>
						</div>

						{#if itemWizardStep === 'quantity'}
							<div class="space-y-4">
								<div>
									<h4 class="text-sm font-semibold text-foreground">
										Paso 1: ¿Cuántas unidades deseas agregar?
									</h4>
									<p class="text-xs text-muted-foreground">
										Ajusta la cantidad con los botones o escribe el número
										directamente.
									</p>
								</div>

								<div
									class="grid grid-cols-1 gap-4 rounded-xl border border-border bg-muted/15 p-4 sm:grid-cols-2"
								>
									<div class="space-y-1.5">
										<Label class="text-xs">Cantidad</Label>
										<div class="flex items-center">
											<Button
												type="button"
												variant="outline"
												size="icon"
												onclick={() => changeConfigQuantity(-1)}
												class="size-10 rounded-r-none border-r-0 hover:bg-accent active:scale-95 transition-all"
											>
												<Minus class="size-4" />
											</Button>
											<Input
												type="number"
												step="any"
												min="0.01"
												bind:value={itemConfigQuantity}
												class="h-10 w-24 rounded-none text-center font-mono text-base font-bold shadow-none"
											/>
											<Button
												type="button"
												variant="outline"
												size="icon"
												onclick={() => changeConfigQuantity(1)}
												class="size-10 rounded-l-none border-l-0 hover:bg-accent active:scale-95 transition-all"
											>
												<Plus class="size-4" />
											</Button>
										</div>
									</div>

									<div class="space-y-1.5 flex flex-col justify-center">
										<span class="text-xs text-muted-foreground"
											>Precio Unitario Calculado</span
										>
										<span
											class="font-mono text-base font-bold {modalItemPriceCalc.appliedTier
												? 'text-emerald-600'
												: 'text-foreground'}"
										>
											{formatCurrency(modalItemPriceCalc.unitPrice)}
										</span>
										{#if modalItemPriceCalc.appliedTier}
											<span class="text-[11px] text-emerald-700 font-semibold">
												✨ {modalItemPriceCalc.discountPct}% OFF por escala (≥{modalItemPriceCalc
													.appliedTier.minQuantity}u)
											</span>
										{/if}
									</div>
								</div>
							</div>
						{/if}

						{#if itemWizardStep === 'type'}
							<div class="space-y-4">
								<div>
									<h4 class="text-sm font-semibold text-foreground">
										Paso 2: ¿Cómo se entregará este producto?
									</h4>
									<p class="text-xs text-muted-foreground">
										Selecciona si es una venta en el momento para entregar ya, o un
										pedido por encargo para otra fecha.
									</p>
								</div>

								<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
									<button
										type="button"
										onclick={finishAddingImmediateItem}
										class="group flex flex-col justify-between rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/5 p-6 text-left transition-all hover:border-emerald-500 hover:bg-emerald-500/10 hover:shadow-md cursor-pointer active:scale-[0.98]"
									>
										<div class="space-y-2">
											<div
												class="flex size-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-700"
											>
												<Zap class="size-5" />
											</div>
											<h3
												class="text-base font-bold text-foreground group-hover:text-emerald-700"
											>
												Orden Inmediata
											</h3>
											<p class="text-xs text-muted-foreground leading-relaxed">
												Se entrega y despacha ahora en el mostrador. Descuenta el stock
												en el acto.
											</p>
										</div>
										<div
											class="mt-4 flex items-center justify-between border-t border-emerald-500/20 pt-3"
										>
											<span class="text-xs font-semibold text-emerald-700">
												Listo en el acto
											</span>
											<span
												class="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-xs"
											>
												Agregar ya →
											</span>
										</div>
									</button>

									<button
										type="button"
										onclick={() => (itemWizardStep = 'preorder_details')}
										class="group flex flex-col justify-between rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 p-6 text-left transition-all hover:border-amber-500 hover:bg-amber-500/10 hover:shadow-md cursor-pointer active:scale-[0.98]"
									>
										<div class="space-y-2">
											<div
												class="flex size-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700"
											>
												<Clock class="size-5" />
											</div>
											<h3
												class="text-base font-bold text-foreground group-hover:text-amber-700"
											>
												Orden por Encargo
											</h3>
											<p class="text-xs text-muted-foreground leading-relaxed">
												Para elaborar y entregar en un día y horario futuro. Producción
												Just-In-Time.
											</p>
										</div>
										<div
											class="mt-4 flex items-center justify-between border-t border-amber-500/20 pt-3"
										>
											<span class="text-xs font-semibold text-amber-700">
												Pautar entrega
											</span>
											<span
												class="rounded-lg bg-amber-600 px-3 py-1 text-xs font-bold text-white shadow-xs"
											>
												Configurar horario →
											</span>
										</div>
									</button>
								</div>
							</div>
						{/if}

						{#if itemWizardStep === 'preorder_details'}
							<div class="space-y-5">
								<div>
									<h4 class="text-sm font-semibold text-foreground">
										Paso 3: Fecha de Entrega y Notas del Encargo
									</h4>
									<p class="text-xs text-muted-foreground">
										Especifica cuándo debe estar listo y agrega indicaciones para la
										elaboración.
									</p>
								</div>

								<div class="rounded-xl border border-border bg-card p-4 space-y-3">
									<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
										<div class="space-y-1.5">
											<Label
												for="item-modal-delivery-date"
												class="text-xs font-semibold"
											>
												Fecha de Entrega
											</Label>
											<input
												id="item-modal-delivery-date"
												type="date"
												min={minDeliveryDateOnly}
												bind:value={modalDeliveryDateOnly}
												onchange={syncModalDeliveryDateTime}
												class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
											/>
										</div>

										<div class="space-y-1.5">
											<div class="flex items-center justify-between">
												<Label
													for="item-modal-delivery-time"
													class="text-xs font-semibold"
												>
													Hora Pactada
												</Label>
												<span class="text-[10px] text-muted-foreground font-mono"
													>Paso: 15 min</span
												>
											</div>
											<select
												id="item-modal-delivery-time"
												bind:value={modalDeliveryTimeOnly}
												onchange={syncModalDeliveryDateTime}
												class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
											>
												{#each time15Slots as slot}
													<option value={slot}>{slot} hs</option>
												{/each}
											</select>
										</div>
									</div>

									<div class="flex flex-wrap items-center gap-1.5 pt-1">
										<span class="text-[11px] text-muted-foreground">Atajos:</span>
										<button
											type="button"
											onclick={() => setQuickDeliveryOffset(2)}
											class="rounded bg-muted px-2 py-1 text-xs text-muted-foreground hover:bg-muted/80 hover:text-foreground"
										>
											Hoy (+2 horas)
										</button>
										<button
											type="button"
											onclick={() => setQuickDeliveryOffset(24)}
											class="rounded bg-muted px-2 py-1 text-xs text-muted-foreground hover:bg-muted/80 hover:text-foreground"
										>
											Mañana (+24h)
										</button>
										<button
											type="button"
											onclick={() => setQuickDeliveryOffset(48)}
											class="rounded bg-muted px-2 py-1 text-xs text-muted-foreground hover:bg-muted/80 hover:text-foreground"
										>
											En 48 horas
										</button>
									</div>
								</div>

								<div class="rounded-xl border border-border bg-card p-4 space-y-2">
									<Label for="item-notes" class="text-xs font-semibold">
										Nota Especial / Dedicatoria (opcional)
									</Label>
									<Input
										id="item-notes"
										bind:value={itemConfigNotes}
										placeholder="Ej. Dedicatoria: Feliz Cumple Juan, sin nueces, cobertura dulce de leche..."
										class="h-10 text-sm"
									/>
								</div>
							</div>
						{/if}
					</div>

					<div
						class="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-4"
					>
						<Button
							type="button"
							variant="ghost"
							onclick={() => {
								if (itemWizardStep === 'preorder_details') itemWizardStep = 'type';
								else if (itemWizardStep === 'type') itemWizardStep = 'quantity';
								else cancelConfiguringItem();
							}}
						>
							<ArrowLeft class="size-4 mr-1" />
							<span>
								{itemWizardStep === 'quantity' ? 'Cancelar este ítem' : 'Paso Anterior'}
							</span>
						</Button>

						<div class="flex items-center gap-3">
							{#if itemWizardStep === 'quantity'}
								<Button
									type="button"
									class="gap-1.5"
									onclick={() => (itemWizardStep = 'type')}
								>
									<span>Siguiente: Modalidad</span>
									<ArrowRight class="size-4" />
								</Button>
							{:else if itemWizardStep === 'preorder_details'}
								<Button
									type="button"
									class="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
									onclick={finishAddingPreorderItem}
								>
									<Check class="size-4" />
									<span>Agregar Encargo a la Orden</span>
								</Button>
							{/if}
						</div>
					</div>
				{/if}

				<!-- VISTA 3: CHECKOUT FINAL, CLIENTE Y COBRO -->
				{#if orderModalView === 'checkout'}
					<form
						method="POST"
						action="?/createOrder"
						class="flex flex-1 flex-col overflow-hidden"
						use:enhance={() => {
							return async ({ result, update }) => {
								await update();
								if (result.type === 'success') {
									onClose();
								}
							};
						}}
					>
						<input type="hidden" name="businessId" value={businessId} />
						<input type="hidden" name="customerName" value={draftCustomerName} />
						<input type="hidden" name="deliveryDate" value={draftDeliveryDate} />
						<input type="hidden" name="paymentStatus" value={draftPaymentStatus} />
						<input type="hidden" name="paidAmount" value={draftPaidAmount} />
						<input type="hidden" name="notes" value={draftNotes} />
						<input type="hidden" name="linesJson" value={serializedDraftLines} />

						<div class="flex-1 overflow-y-auto p-6 space-y-6">
							<!-- Resumen de Ítems en Checkout -->
							<div class="rounded-xl border border-border bg-muted/15 p-4 space-y-3">
								<div class="flex items-center justify-between">
									<h4
										class="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
									>
										Resumen de la Orden ({draftLines.length} productos)
									</h4>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										class="h-7 text-xs text-primary"
										onclick={() => (orderModalView = 'catalog')}
									>
										+ Modificar productos
									</Button>
								</div>

								<div class="divide-y divide-border/60">
									{#each draftLines as l}
										<div class="flex items-center justify-between py-2 text-xs">
											<div class="flex items-center gap-2">
												<span class="font-mono font-bold">{l.quantity}×</span>
												<span class="font-medium text-foreground">{l.productName}</span>
												{#if l.fulfillmentType === 'immediate'}
													<span
														class="text-[10px] text-emerald-700 bg-emerald-500/10 px-1.5 py-0.2 rounded font-medium"
														>Inmediata</span
													>
												{:else}
													<span
														class="text-[10px] text-amber-700 bg-amber-500/10 px-1.5 py-0.2 rounded font-medium"
														>Encargo</span
													>
												{/if}
											</div>
											<span class="font-mono font-semibold"
												>{formatCurrency(l.quantity * l.unitPrice)}</span
											>
										</div>
									{/each}
								</div>

								<div
									class="flex items-center justify-between border-t border-border pt-2"
								>
									<span class="text-xs font-semibold text-muted-foreground"
										>Total General</span
									>
									<span class="font-mono text-base font-bold text-foreground">
										{formatCurrency(draftTotalAmount)}
									</span>
								</div>
							</div>

							<!-- Datos del Cliente -->
							<div class="rounded-xl border border-border bg-card p-4 space-y-3">
								<div class="flex items-center justify-between">
									<Label for="chk-customer" class="text-xs font-semibold"
										>Cliente</Label
									>
									<span class="text-[11px] text-muted-foreground">Opcional</span>
								</div>
								<Input
									id="chk-customer"
									bind:value={draftCustomerName}
									placeholder="Ej. María Gómez o Cliente Mostrador"
									class="h-10 text-sm"
								/>
							</div>

							<!-- Modalidad de Pago (3 Tarjetas Grandes) -->
							<div class="space-y-3">
								<Label
									class="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
								>
									Modalidad de Cobro
								</Label>

								<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
									<button
										type="button"
										onclick={() => {
											draftPaymentStatus = 'paid';
											draftPaidAmount = Number(draftTotalAmount.toFixed(2));
										}}
										class="flex flex-col justify-between rounded-xl border p-4 text-left transition-all {draftPaymentStatus ===
										'paid'
											? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20'
											: 'border-border bg-card hover:bg-muted/30'}"
									>
										<div class="space-y-1">
											<div class="flex items-center justify-between">
												<span class="text-xs font-bold text-foreground">Cobro Total</span>
												<Check
													class="size-4 {draftPaymentStatus === 'paid'
														? 'text-emerald-600'
														: 'text-transparent'}"
												/>
											</div>
											<p class="text-[11px] text-muted-foreground">Abona el 100% ahora</p>
										</div>
										<div class="mt-3 font-mono text-sm font-bold text-emerald-600">
											{formatCurrency(draftTotalAmount)}
										</div>
									</button>

									<button
										type="button"
										onclick={() => {
											draftPaymentStatus = 'partially_paid';
											if (draftPaidAmount <= 0 || draftPaidAmount >= draftTotalAmount) {
												setDepositPercentage(50);
											}
										}}
										class="flex flex-col justify-between rounded-xl border p-4 text-left transition-all {draftPaymentStatus ===
										'partially_paid'
											? 'border-sky-500 bg-sky-500/10 ring-2 ring-sky-500/20'
											: 'border-border bg-card hover:bg-muted/30'}"
									>
										<div class="space-y-1">
											<div class="flex items-center justify-between">
												<span class="text-xs font-bold text-foreground">Seña / Parcial</span>
												<CreditCard
													class="size-4 {draftPaymentStatus === 'partially_paid'
														? 'text-sky-600'
														: 'text-muted-foreground'}"
												/>
											</div>
											<p class="text-[11px] text-muted-foreground">Deja un adelanto</p>
										</div>
										<div class="mt-3 font-mono text-sm font-bold text-sky-600">
											{formatCurrency(draftPaidAmount)}
										</div>
									</button>

									<button
										type="button"
										onclick={() => {
											draftPaymentStatus = 'pending';
											draftPaidAmount = 0;
										}}
										class="flex flex-col justify-between rounded-xl border p-4 text-left transition-all {draftPaymentStatus ===
										'pending'
											? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/20'
											: 'border-border bg-card hover:bg-muted/30'}"
									>
										<div class="space-y-1">
											<div class="flex items-center justify-between">
												<span class="text-xs font-bold text-foreground">Al Retirar</span>
												<Clock
													class="size-4 {draftPaymentStatus === 'pending'
														? 'text-amber-600'
														: 'text-muted-foreground'}"
												/>
											</div>
											<p class="text-[11px] text-muted-foreground">Paga al entregar</p>
										</div>
										<div class="mt-3 font-mono text-sm font-bold text-amber-600">
											$ 0,00 ahora
										</div>
									</button>
								</div>

								{#if draftPaymentStatus === 'partially_paid'}
									<div
										class="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 space-y-3"
									>
										<div class="flex flex-wrap items-center justify-between gap-2">
											<Label
												for="step-paid-amount"
												class="text-xs font-semibold text-foreground"
											>
												Monto de la Seña ($)
											</Label>
											<div class="flex items-center gap-1.5">
												<span class="text-[11px] text-muted-foreground">Atajos:</span>
												<button
													type="button"
													onclick={() => setDepositPercentage(30)}
													class="rounded bg-sky-500/20 px-2 py-0.5 text-xs font-medium text-sky-800 hover:bg-sky-500/30"
												>
													30% ({formatCurrency(draftTotalAmount * 0.3)})
												</button>
												<button
													type="button"
													onclick={() => setDepositPercentage(50)}
													class="rounded bg-sky-500/20 px-2 py-0.5 text-xs font-medium text-sky-800 hover:bg-sky-500/30"
												>
													50% ({formatCurrency(draftTotalAmount * 0.5)})
												</button>
											</div>
										</div>
										<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 items-center">
											<Input
												id="step-paid-amount"
												type="number"
												step="any"
												min="0"
												max={draftTotalAmount}
												bind:value={draftPaidAmount}
												class="h-10 font-mono text-sm font-semibold"
											/>
											<div class="rounded-lg bg-card p-2 text-xs">
												<span class="text-muted-foreground">Saldo restante:</span>
												<span class="ml-1 font-mono font-bold text-foreground">
													{formatCurrency(Math.max(0, draftTotalAmount - draftPaidAmount))}
												</span>
											</div>
										</div>
									</div>
								{/if}
							</div>

							<!-- Notas Generales de la Orden -->
							<div class="rounded-xl border border-border bg-card p-4 space-y-2">
								<Label for="chk-notes" class="text-xs font-semibold"
									>Notas Generales de la Orden</Label
								>
								<Input
									id="chk-notes"
									bind:value={draftNotes}
									placeholder="Ej. Retira por sucursal centro, embalar para viaje..."
									class="h-10 text-sm"
								/>
							</div>
						</div>

						<!-- Acciones de Confirmación -->
						<div
							class="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-4"
						>
							<Button
								type="button"
								variant="outline"
								class="gap-1.5"
								onclick={() => (orderModalView = 'catalog')}
							>
								<ArrowLeft class="size-4" />
								<span>Volver a Productos</span>
							</Button>

							<Button type="submit" class="gap-1.5 font-bold">
								<Check class="size-4" />
								<span>Confirmar Orden ({formatCurrency(draftTotalAmount)})</span>
							</Button>
						</div>
					</form>
				{/if}
			{/if}
		</div>
	</div>
{/if}
