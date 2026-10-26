<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import type { PaymentStatus } from '#lib/features/orders/domain/order.entity';
	import AppShell from '#lib/components/layout/app-shell.svelte';
	import { Button } from '#lib/components/ui/button';
	import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Tag from '@lucide/svelte/icons/tag';
	import X from '@lucide/svelte/icons/x';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { toast } from '#lib/components/ui/toast';
	import { draftOrderStore } from '#lib/features/orders/ui/draft-order.svelte';
	import { formatCurrency, type DraftOrderLine } from '../_components/utils';
	import PosCatalog from './_components/pos-catalog.svelte';
	import PosItemConfig from './_components/pos-item-config.svelte';
	import PosCart from './_components/pos-cart.svelte';

	let { data }: PageProps = $props();

	let configuringProduct = $state<(typeof data.salesProducts)[number] | null>(null);

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
	let isLoadedFromStorage = $state(false);

	$effect(() => {
		const bizId = data.activeBusiness?.id;
		if (bizId) {
			untrack(() => {
				draftOrderStore.init(bizId);
				if (!isLoadedFromStorage) {
					draftLines = [...draftOrderStore.lines];
					draftCustomerName = draftOrderStore.customerName;
					draftPaymentStatus = draftOrderStore.paymentStatus;
					draftPaidAmount = draftOrderStore.paidAmount;
					draftDeliveryDate = draftOrderStore.deliveryDate;
					draftNotes = draftOrderStore.notes;
					draftTransactionId = draftOrderStore.transactionId;
					draftCreateAsUnconfirmed = draftOrderStore.createAsUnconfirmed;
					isLoadedFromStorage = true;
				}
			});
		}
	});

	$effect(() => {
		if (isLoadedFromStorage && data.activeBusiness?.id) {
			const lines = draftLines;
			const customerName = draftCustomerName;
			const paymentStatus = draftPaymentStatus;
			const paidAmount = draftPaidAmount;
			const deliveryDate = draftDeliveryDate;
			const notes = draftNotes;
			const transactionId = draftTransactionId;
			const createAsUnconfirmed = draftCreateAsUnconfirmed;

			untrack(() => {
				draftOrderStore.updateFromTerminal({
					lines,
					customerName,
					paymentStatus,
					paidAmount,
					deliveryDate,
					notes,
					transactionId,
					createAsUnconfirmed
				});
			});
		}
	});

	const draftTotalAmount = $derived(
		draftLines.reduce((sum, l) => sum + (l.quantity > 0 ? l.quantity : 0) * (l.unitPrice >= 0 ? l.unitPrice : 0), 0)
	);

	function handleSelectProduct(product: (typeof data.salesProducts)[number]) {
		configuringProduct = product;
	}

	async function handleToggleShortcut(product: (typeof data.salesProducts)[number]) {
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

	function handleAddImmediate(line: Omit<DraftOrderLine, 'key'>) {
		draftLines = [
			...draftLines,
			{
				...line,
				key: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
			}
		];
		configuringProduct = null;
	}

	function handleAddPreorder(line: Omit<DraftOrderLine, 'key'>) {
		if (line.deliveryDate && !draftDeliveryDate) {
			draftDeliveryDate = line.deliveryDate;
		}
		draftLines = [
			...draftLines,
			{
				...line,
				key: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
			}
		];
		configuringProduct = null;
	}

	function handleChangeLineQuantity(index: number, delta: number) {
		const current = draftLines[index].quantity;
		const next = Math.max(1, Number((current + delta).toFixed(2)));
		draftLines = draftLines.map((l, idx) => (idx === index ? { ...l, quantity: next } : l));
	}

	function handleRemoveLine(index: number) {
		draftLines = draftLines.filter((_, idx) => idx !== index);
	}

	function handleClearOrder() {
		draftLines = [];
		draftCustomerName = 'Cliente Mostrador';
		draftPaidAmount = 0;
		draftPaymentStatus = 'paid';
		draftDeliveryDate = '';
		draftNotes = '';
		draftTransactionId = '';
		draftCreateAsUnconfirmed = false;
		draftOrderStore.clear();
		toast.info('Comanda vaciada', 'Se han eliminado todos los productos de la orden en borrador.');
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
	description="Pantalla completa para registro rápido de ventas y órdenes por encargo"
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
			<!-- COLUMNA IZQUIERDA: CATÁLOGO, ATAJOS Y ASISTENTE (7 cols) -->
			<div class="space-y-6 lg:col-span-7 pb-24 lg:pb-0">
				{#if configuringProduct}
					<PosItemConfig
						product={configuringProduct}
						defaultDeliveryDate={draftDeliveryDate}
						onAddImmediate={handleAddImmediate}
						onAddPreorder={handleAddPreorder}
						onCancel={() => (configuringProduct = null)}
					/>
				{:else}
					<PosCatalog
						salesProducts={data.salesProducts}
						onSelectProduct={handleSelectProduct}
						onToggleShortcut={handleToggleShortcut}
					/>
				{/if}
			</div>

			<!-- COLUMNA DERECHA: COMANDERO / CARRITO EN VIVO (5 cols Desktop) -->
			<div class="hidden lg:block lg:col-span-5">
				<form
					method="POST"
					action="?/createOrder"
					use:enhance={() => {
						isSubmitting = true;
						return async ({ update, result }) => {
							if (result.type === 'redirect') {
								draftOrderStore.clear();
							}
							await update();
							isSubmitting = false;
						};
					}}
					class="sticky top-6 rounded-2xl border border-border bg-card p-6 shadow-lg space-y-5"
				>
					<PosCart
						activeBusinessId={data.activeBusiness.id}
						bind:draftLines
						bind:draftCustomerName
						bind:draftPaymentStatus
						bind:draftPaidAmount
						bind:draftDeliveryDate
						bind:draftNotes
						bind:draftTransactionId
						bind:draftCreateAsUnconfirmed
						{isSubmitting}
						isMobileDrawer={false}
						onChangeLineQuantity={handleChangeLineQuantity}
						onRemoveLine={handleRemoveLine}
						onClearCart={handleClearOrder}
					/>
				</form>
			</div>

			<!-- Versión Mobile: Barra Flotante Inferior de Carrito (ubicada sobre el Bottom Dock) -->
			{#if draftLines.length > 0}
				<div class="fixed bottom-20 inset-x-4 z-30 lg:hidden">
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
						<div class="flex items-center justify-between pb-3 border-b border-border">
							<div class="flex items-center gap-2">
								<ShoppingCart class="size-5 text-primary" />
								<h3 class="text-base font-bold text-foreground">Orden de Compra</h3>
								<div class="flex items-center gap-1.5">
									<span class="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-bold text-primary">
										{draftLines.length} {draftLines.length === 1 ? 'producto' : 'productos'}
									</span>
									{#if draftLines.length > 0}
										<button
											type="button"
											onclick={handleClearOrder}
											class="inline-flex items-center gap-1 rounded-lg border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive hover:bg-destructive hover:text-white transition-all cursor-pointer active:scale-95"
											title="Vaciar comanda completa"
										>
											<Trash2 class="size-3" />
											<span>Vaciar</span>
										</button>
									{/if}
								</div>
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

						<form
							method="POST"
							action="?/createOrder"
							use:enhance={() => {
								isSubmitting = true;
								return async ({ update, result }) => {
									if (result.type === 'redirect') {
										draftOrderStore.clear();
									}
									await update();
									isSubmitting = false;
									isMobileCartOpen = false;
								};
							}}
							class="overflow-y-auto space-y-5 pt-3"
						>
							<PosCart
								activeBusinessId={data.activeBusiness.id}
								bind:draftLines
								bind:draftCustomerName
								bind:draftPaymentStatus
								bind:draftPaidAmount
								bind:draftDeliveryDate
								bind:draftNotes
								bind:draftTransactionId
								bind:draftCreateAsUnconfirmed
								{isSubmitting}
								isMobileDrawer={true}
								onChangeLineQuantity={handleChangeLineQuantity}
								onRemoveLine={handleRemoveLine}
								onClearCart={handleClearOrder}
							/>
						</form>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</AppShell>
