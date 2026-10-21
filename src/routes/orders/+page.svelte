<script lang="ts">
	import { enhance } from '$app/forms';
	import { replaceState } from '$app/navigation';
	import type { PageProps } from './$types';
	import {
		calculateEffectiveUnitPrice,
		ORDER_STATUS_LABELS,
		PAYMENT_STATUS_LABELS,
		ORDER_ITEM_STATUS_LABELS,
		type OrderItemFulfillmentType,
		type OrderStatus,
		type OrderWithItems,
		type PaymentStatus
	} from '#lib/features/orders/domain/order.entity';
	import AppShell from '#lib/components/layout/app-shell.svelte';
	import TablePagination from '#lib/components/ui/pagination/table-pagination.svelte';
	import { Button } from '#lib/components/ui/button';
	import { Badge } from '#lib/components/ui/badge';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import {
		Card,
		CardContent,
		CardHeader
	} from '#lib/components/ui/card';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import Clock from '@lucide/svelte/icons/clock';
	import Calendar from '@lucide/svelte/icons/calendar';
	import Check from '@lucide/svelte/icons/check';
	import CircleDollarSign from '@lucide/svelte/icons/circle-dollar-sign';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Eye from '@lucide/svelte/icons/eye';
	import X from '@lucide/svelte/icons/x';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import Tag from '@lucide/svelte/icons/tag';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Zap from '@lucide/svelte/icons/zap';
	import User from '@lucide/svelte/icons/user';
	import Minus from '@lucide/svelte/icons/minus';
	import CreditCard from '@lucide/svelte/icons/credit-card';
	import Star from '@lucide/svelte/icons/star';
	import { toast } from '#lib/components/ui/toast';

	let { data }: PageProps = $props();

	$effect(() => {
		if (data.createdOrderNumber) {
			toast.success(
				`¡Orden ${data.createdOrderNumber} registrada con éxito!`,
				'Los productos y cobros han sido actualizados en el sistema.'
			);
			replaceState('/orders', {});
		}
	});

	let searchQuery = $state('');
	let filterStatus = $state<OrderStatus | 'all'>('all');
	let filterPayment = $state<PaymentStatus | 'all'>('all');
	let currentPage = $state(1);
	let pageSize = $state(10);

	// Modales
	let showNewOrderModal = $state(false);
	let viewingOrderId = $state<string | null>(null);
	let payingOrderId = $state<string | null>(null);
	let payModalAmount = $state(0);
	let payModalStatus = $state<PaymentStatus>('paid');
	let cancellingOrderId = $state<string | null>(null);
	let deliveringOrderId = $state<string | null>(null);
	let confirmingOrderId = $state<string | null>(null);
	let confirmDepositAmount = $state<number>(0);
	let confirmTransactionId = $state<string>('');

	const viewingOrder = $derived(
		viewingOrderId ? (data.orders.find((o) => o.id === viewingOrderId) ?? null) : null
	);
	const payingOrder = $derived(
		payingOrderId ? (data.orders.find((o) => o.id === payingOrderId) ?? null) : null
	);
	const cancellingOrder = $derived(
		cancellingOrderId ? (data.orders.find((o) => o.id === cancellingOrderId) ?? null) : null
	);
	const deliveringOrder = $derived(
		deliveringOrderId ? (data.orders.find((o) => o.id === deliveringOrderId) ?? null) : null
	);
	const confirmingOrder = $derived(
		confirmingOrderId ? (data.orders.find((o) => o.id === confirmingOrderId) ?? null) : null
	);

	// Estado del Asistente de Venta Rápida (POS y Pedidos por Botones)
	type OrderModalView = 'catalog' | 'item_config' | 'checkout';
	type ItemWizardStep = 'quantity' | 'type' | 'preorder_details';

	let orderModalView = $state<OrderModalView>('catalog');
	let productSearchQuery = $state('');

	// Configuración del ítem en proceso
	let configuringProduct = $state<(typeof data.salesProducts)[number] | null>(null);
	let itemWizardStep = $state<ItemWizardStep>('quantity');
	let itemConfigQuantity = $state(1);
	let itemConfigUnitPrice = $state(0);
	let itemConfigFulfillmentType = $state<OrderItemFulfillmentType>('immediate');
	let itemConfigDeliveryDate = $state('');
	let itemConfigNotes = $state('');

	// Líneas añadidas a la orden
	interface DraftOrderLine {
		key: string;
		salesProductId: string;
		productName: string;
		productCode: string;
		isCombo: boolean;
		quantity: number;
		unitPrice: number;
		fulfillmentType: OrderItemFulfillmentType;
		deliveryDate: string;
		notes: string;
	}

	let draftCustomerName = $state('Cliente Mostrador');
	let draftPaymentStatus = $state<PaymentStatus>('paid');
	let draftPaidAmount = $state(0);
	let draftDeliveryDate = $state('');
	let draftNotes = $state('');
	let draftLines = $state<DraftOrderLine[]>([]);

	// Derivados de productos para atajos y búsqueda
	const shortcutProducts = $derived(data.salesProducts.filter((p) => p.isShortcut));
	const suggestedFallbackProducts = $derived(
		shortcutProducts.length === 0 ? data.salesProducts.slice(0, 6) : []
	);
	const filteredProductsBySearch = $derived(
		productSearchQuery.trim()
			? data.salesProducts.filter(
					(p) =>
						p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
						p.code.toLowerCase().includes(productSearchQuery.toLowerCase())
				)
			: []
	);

	function openNewOrder() {
		orderModalView = 'catalog';
		productSearchQuery = '';
		configuringProduct = null;
		draftCustomerName = 'Cliente Mostrador';
		draftPaymentStatus = 'paid';
		draftDeliveryDate = '';
		draftNotes = '';
		draftLines = [];
		showNewOrderModal = true;
	}

	function startConfiguringProduct(product: (typeof data.salesProducts)[number]) {
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

	const modalItemPriceCalc = $derived.by(() => {
		if (!configuringProduct) return { unitPrice: 0, discountPct: 0, appliedTier: null };
		return calculateEffectiveUnitPrice(
			configuringProduct.salePrice,
			itemConfigQuantity,
			configuringProduct.pricingTiers ?? []
		);
	});

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

	function setQuickConfigQuantity(q: number) {
		itemConfigQuantity = q;
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
		}
	}

	async function toggleProductShortcut(product: (typeof data.salesProducts)[number]) {
		product.isShortcut = !product.isShortcut;
		const form = new FormData();
		form.set('productId', product.id);
		form.set('businessId', data.activeBusiness.id);
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

	// Si venimos con ?new=1 desde el botón del Sidebar, abrir automáticamente el modal
	$effect(() => {
		if (data.openNewModalOnLoad) {
			openNewOrder();
			if (typeof window !== 'undefined') {
				const url = new URL(window.location.href);
				url.searchParams.delete('new');
				replaceState(url, {});
			}
		}
	});

	const draftTotalAmount = $derived(
		draftLines.reduce((sum, l) => sum + (l.quantity > 0 ? l.quantity : 0) * (l.unitPrice >= 0 ? l.unitPrice : 0), 0)
	);

	const draftHasPreorder = $derived(draftLines.some((l) => l.fulfillmentType === 'preorder'));

	// Sincronizar monto pagado cuando el modo es 'paid' o 'pending'
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

	function openPaymentModal(order: OrderWithItems) {
		payingOrderId = order.id;
		payModalAmount = order.totalAmount;
		payModalStatus = 'paid';
	}

	// KPIs
	const unconfirmedOrdersCount = $derived(
		data.orders.filter((o) => o.status === 'unconfirmed').length
	);
	const pendingOrdersCount = $derived(data.orders.filter((o) => o.status === 'pending').length);
	const completedOrdersCount = $derived(
		data.orders.filter((o) => o.status === 'completed').length
	);
	const activeOrders = $derived(
		data.orders.filter((o) => o.status !== 'cancelled' && o.status !== 'unconfirmed')
	);
	const totalBilled = $derived(activeOrders.reduce((acc, o) => acc + o.totalAmount, 0));
	const totalCollected = $derived(
		activeOrders.reduce((acc, o) => acc + (o.status === 'completed' ? o.totalAmount : o.paidAmount), 0)
	);
	const totalPendingCollection = $derived(Math.max(0, totalBilled - totalCollected));

	const filteredOrders = $derived(
		data.orders.filter((order) => {
			if (filterStatus !== 'all' && order.status !== filterStatus) return false;
			const effectivePayment = order.status === 'completed' ? 'paid' : order.paymentStatus;
			if (filterPayment !== 'all' && effectivePayment !== filterPayment) return false;
			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase().trim();
				const matchHeader =
					order.orderNumber.toLowerCase().includes(q) ||
					order.customerName.toLowerCase().includes(q) ||
					(order.notes?.toLowerCase().includes(q) ?? false);
				const matchItems = order.items.some((i) =>
					i.productName.toLowerCase().includes(q)
				);
				return matchHeader || matchItems;
			}
			return true;
		})
	);

	$effect(() => {
		void searchQuery;
		void filterStatus;
		void filterPayment;
		currentPage = 1;
	});

	const paginatedOrders = $derived(
		filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize)
	);

	function formatCurrency(val: number): string {
		return `$ ${new Intl.NumberFormat('es-AR', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(val)}`;
	}

	function formatDateTime(date: Date | string | null): string {
		if (!date) return 'Sin horario pactado';
		const d = typeof date === 'string' ? new Date(date) : date;
		if (Number.isNaN(d.getTime())) return 'Sin horario pactado';
		return new Intl.DateTimeFormat('es-AR', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(d);
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

	// Intervalos estrictos cada 15 minutos: 00:00, 00:15, 00:30, ... 23:45
	const time15Slots = Array.from({ length: 96 }, (_, i) => {
		const h = String(Math.floor(i / 4)).padStart(2, '0');
		const m = String((i % 4) * 15).padStart(2, '0');
		return `${h}:${m}`;
	});

	let modalDeliveryDateOnly = $state(toDateString(new Date()));
	let modalDeliveryTimeOnly = $state(toTimeString(roundToNext15Minutes(new Date(Date.now() + 2 * 3600_000))));

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
</script>

<svelte:head>
	<title>Órdenes de Compra — {data.activeBusiness.name}</title>
</svelte:head>

{#snippet headerActions()}
	<Button variant="outline" href="/inventory?tab=products">
		<Tag class="size-4" />
		<span>Catálogo de Venta ({data.salesProducts.length})</span>
	</Button>
	<Button href="/orders/new" class="gap-1.5 font-bold shadow-sm">
		<Plus class="size-4" />
		<span>Nueva Orden de Compra</span>
	</Button>
{/snippet}

{#snippet salesSummary()}
	<!-- Tarjetas de Resumen de Ventas y Pedidos -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card class={pendingOrdersCount > 0 ? 'border-amber-500/40 bg-amber-500/5' : ''}>
			<CardContent class="flex items-center justify-between p-5">
				<div class="space-y-1">
					<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
						Órdenes Pendientes
					</p>
					<p class="text-2xl font-bold {pendingOrdersCount > 0 ? 'text-amber-600' : 'text-foreground'}">
						{pendingOrdersCount}
					</p>
					<p class="text-xs text-muted-foreground">
						Con encargos pendientes de entregar
					</p>
				</div>
				<div class="flex size-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
					<Clock class="size-5" />
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="flex items-center justify-between p-5">
				<div class="space-y-1">
					<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
						Órdenes Completadas
					</p>
					<p class="text-2xl font-bold text-emerald-600">
						{completedOrdersCount}
					</p>
					<p class="text-xs text-muted-foreground">
						Totalmente entregadas
					</p>
				</div>
				<div class="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
					<Check class="size-5" />
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="flex items-center justify-between p-5">
				<div class="space-y-1">
					<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
						Total Cobrado
					</p>
					<p class="font-mono text-2xl font-bold text-foreground">
						{formatCurrency(totalCollected)}
					</p>
					<p class="text-xs text-muted-foreground">
						De {formatCurrency(totalBilled)} facturados
					</p>
				</div>
				<div class="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
					<CircleDollarSign class="size-5" />
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="flex items-center justify-between p-5">
				<div class="space-y-1">
					<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
						Saldo por Cobrar
					</p>
					<p class="font-mono text-2xl font-bold {totalPendingCollection > 0 ? 'text-amber-600' : 'text-foreground'}">
						{formatCurrency(totalPendingCollection)}
					</p>
					<p class="text-xs text-muted-foreground">
						Señas y pagos pendientes
					</p>
				</div>
				<div class="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
					<ShoppingBag class="size-5" />
				</div>
			</CardContent>
		</Card>
	</div>
{/snippet}

{#snippet orderFiltersAndList()}
	<!-- Listado y Filtros de Órdenes -->
	<Card>
		<CardHeader class="space-y-4 p-6 sm:p-8 sm:pb-4">
			<div class="flex flex-wrap items-center justify-between gap-4">
				<div class="relative w-full max-w-sm">
					<Search class="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
					<Input
						type="search"
						placeholder="Buscar por N° orden, cliente o producto..."
						bind:value={searchQuery}
						class="h-10 pl-9"
					/>
				</div>

				<div class="flex flex-wrap items-center gap-2">
					<Button
						size="sm"
						variant={filterStatus === 'all' ? 'default' : 'outline'}
						onclick={() => (filterStatus = 'all')}
					>
						Todas ({data.orders.length})
					</Button>
					<Button
						size="sm"
						variant={filterStatus === 'unconfirmed' ? 'default' : 'outline'}
						class={filterStatus !== 'unconfirmed' && unconfirmedOrdersCount > 0 ? 'border-purple-500/40 text-purple-700 bg-purple-500/10' : ''}
						onclick={() => (filterStatus = 'unconfirmed')}
					>
						Por Confirmar ({unconfirmedOrdersCount})
					</Button>
					<Button
						size="sm"
						variant={filterStatus === 'pending' ? 'default' : 'outline'}
						onclick={() => (filterStatus = 'pending')}
					>
						Confirmadas / Pendientes ({pendingOrdersCount})
					</Button>
					<Button
						size="sm"
						variant={filterStatus === 'completed' ? 'default' : 'outline'}
						onclick={() => (filterStatus = 'completed')}
					>
						Completadas ({completedOrdersCount})
					</Button>
					<Button
						size="sm"
						variant={filterStatus === 'cancelled' ? 'default' : 'outline'}
						onclick={() => (filterStatus = 'cancelled')}
					>
						Canceladas
					</Button>
				</div>
			</div>

			<!-- Filtro secundario por Estado de Pago -->
			<div class="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 text-xs">
				<span class="font-medium text-muted-foreground">Estado de Pago:</span>
				<button
					type="button"
					onclick={() => (filterPayment = 'all')}
					class="rounded-lg px-2.5 py-1 font-medium transition-colors {filterPayment === 'all'
						? 'bg-primary/10 text-primary'
						: 'text-muted-foreground hover:bg-muted'}"
				>
					Todos
				</button>
				<button
					type="button"
					onclick={() => (filterPayment = 'pending')}
					class="rounded-lg px-2.5 py-1 font-medium transition-colors {filterPayment === 'pending'
						? 'bg-red-500/15 text-red-700'
						: 'text-muted-foreground hover:bg-muted'}"
				>
					Sin Pagar
				</button>
				<button
					type="button"
					onclick={() => (filterPayment = 'partially_paid')}
					class="rounded-lg px-2.5 py-1 font-medium transition-colors {filterPayment ===
					'partially_paid'
						? 'bg-amber-500/15 text-amber-700'
						: 'text-muted-foreground hover:bg-muted'}"
				>
					Pago Parcial (Seña)
				</button>
				<button
					type="button"
					onclick={() => (filterPayment = 'paid')}
					class="rounded-lg px-2.5 py-1 font-medium transition-colors {filterPayment === 'paid'
						? 'bg-emerald-500/15 text-emerald-700'
						: 'text-muted-foreground hover:bg-muted'}"
				>
					Pagado
				</button>
			</div>
		</CardHeader>

		<CardContent class="p-4 pt-2 sm:p-6 sm:pt-4">
			{#if filteredOrders.length > 0}
				<div class="space-y-6">
					<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
						{#each paginatedOrders as order (order.id)}
							{@const pendingItemsCount = order.items.filter(
								(i) => i.status === 'pending_delivery'
							).length}
							<div
								class="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all duration-150 hover:border-primary/40 hover:shadow-sm"
							>
								<!-- Encabezado de la Tarjeta -->
								<div class="space-y-2.5">
									<!-- Fila superior: ID / SKU y Estado de la Orden -->
									<div class="flex items-center justify-between gap-2">
										<span class="inline-flex items-center rounded bg-muted/80 px-2 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
											{order.orderNumber}
										</span>

										<!-- Estado de la Orden -->
										<div class="shrink-0">
											{#if order.status === 'unconfirmed'}
												<Badge variant="outline" class="border-purple-500/40 bg-purple-500/10 text-purple-700 text-[11px] font-bold animate-pulse">
													{ORDER_STATUS_LABELS.unconfirmed}
												</Badge>
											{:else if order.status === 'pending'}
												<Badge variant="outline" class="border-amber-500/40 bg-amber-500/10 text-amber-700 text-[11px]">
													{ORDER_STATUS_LABELS.pending}
												</Badge>
											{:else if order.status === 'completed'}
												<Badge variant="outline" class="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 text-[11px]">
													{ORDER_STATUS_LABELS.completed}
												</Badge>
											{:else}
												<Badge variant="outline" class="border-red-500/40 bg-red-500/10 text-red-700 text-[11px]">
													{ORDER_STATUS_LABELS.cancelled}
												</Badge>
											{/if}
										</div>
									</div>

									<!-- Nombre del cliente en su propia línea -->
									<div class="space-y-0.5">
										<h3 class="text-base font-semibold text-foreground truncate" title={order.customerName}>
											{order.customerName}
										</h3>
										<p class="text-[11px] text-muted-foreground">
											Creada: {formatDateTime(order.createdAt)}
										</p>
									</div>

									<!-- Fecha y tipo de entrega -->
									<div class="flex items-center gap-2 text-xs">
										{#if order.deliveryDate}
											<div class="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 font-medium text-foreground">
												<Calendar class="size-3.5 text-primary shrink-0" />
												<span>Entrega: {formatDateTime(order.deliveryDate)}</span>
											</div>
										{:else}
											<div class="inline-flex items-center gap-1.5 rounded-md bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground">
												<Zap class="size-3 text-muted-foreground shrink-0" />
												<span>Entrega Inmediata</span>
											</div>
										{/if}
									</div>

									{#if order.notes}
										<p class="rounded-md bg-muted/30 px-2.5 py-1.5 text-xs italic text-muted-foreground border border-border/40">
											"{order.notes}"
										</p>
									{/if}

									{#if order.transactionId}
										<div class="inline-flex items-center gap-1.5 rounded-md bg-sky-500/10 px-2 py-0.5 text-[11px] font-mono text-sky-800 border border-sky-500/20">
											<span class="font-sans font-semibold">Tx ID:</span>
											<span>{order.transactionId}</span>
										</div>
									{/if}

									<!-- Separador y Lista de Ítems -->
									<div class="border-t border-border/60 pt-3">
										<p class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
											Ítems de la Orden ({order.items.length})
										</p>
										<div class="space-y-1.5 max-h-44 overflow-y-auto pr-1">
											{#each order.items as line (line.id)}
												<div class="flex items-start justify-between gap-2 rounded-lg bg-muted/20 p-2 text-xs">
													<div class="min-w-0 flex-1 space-y-0.5">
														<div class="flex items-baseline gap-1.5">
															<span class="font-mono font-bold text-foreground shrink-0">
																{line.quantity}x
															</span>
															<span class="font-medium text-foreground" title={line.productName}>
																{line.productName}
															</span>
														</div>
														{#if line.notes}
															<p class="text-[11px] text-muted-foreground italic">
																"{line.notes}"
															</p>
														{/if}
													</div>

													<div class="shrink-0 pt-0.5">
														{#if line.status === 'delivered'}
															<span class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
																<Check class="size-2.5" />
																Entregado
															</span>
														{:else if line.status === 'pending_delivery'}
															<span class="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
																<Clock class="size-2.5" />
																Pendiente
															</span>
														{:else}
															<span class="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground line-through">
																Cancelado
															</span>
														{/if}
													</div>
												</div>
											{/each}
										</div>
									</div>
								</div>

								<!-- Footer de la Tarjeta: Total y Acciones -->
								<div class="mt-4 border-t border-border/60 pt-3 space-y-3">
									<div class="flex items-center justify-between gap-2">
										<div class="flex items-baseline gap-2">
											<span class="text-xs font-medium text-muted-foreground">Total:</span>
											<span class="font-mono text-base font-bold text-foreground">
												{formatCurrency(order.totalAmount)}
											</span>
										</div>

										<div>
											{#if order.status === 'completed' || order.paymentStatus === 'paid'}
												<span class="rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
													Pagado
												</span>
											{:else if order.paymentStatus === 'partially_paid'}
												<span class="rounded bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
													Seña: {formatCurrency(order.paidAmount)}
												</span>
											{:else}
												<span class="rounded bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-700">
													Sin pagar
												</span>
											{/if}
										</div>
									</div>

									{#if order.status === 'unconfirmed'}
										<div class="flex items-center gap-2 pt-1">
											<Button
												type="button"
												size="sm"
												variant="outline"
												class="h-9 gap-1 px-2.5 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
												title="Cancelar / Rechazar orden"
												onclick={() => (cancellingOrderId = order.id)}
											>
												<X class="size-3.5" />
												<span>Rechazar</span>
											</Button>

											<Button
												type="button"
												size="sm"
												variant="outline"
												class="h-9 gap-1 px-2.5 text-xs font-medium"
												title="Ver listado de ítems y detalle"
												onclick={() => (viewingOrderId = order.id)}
											>
												<Eye class="size-3.5" />
												<span>Ver</span>
											</Button>

											<Button
												type="button"
												size="sm"
												class="flex-1 h-9 gap-1.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
												title="Confirmar orden por caja/encargado"
												onclick={() => {
													confirmingOrderId = order.id;
													confirmDepositAmount = order.paidAmount;
													confirmTransactionId = order.transactionId ?? '';
												}}
											>
												<Check class="size-3.5" />
												<span>Confirmar Pedido</span>
											</Button>
										</div>
									{:else if order.status === 'pending'}
										<div class="flex items-center gap-2 pt-1">
											<Button
												type="button"
												size="sm"
												variant="outline"
												class="h-9 gap-1 px-2.5 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
												title="Cancelar orden"
												onclick={() => (cancellingOrderId = order.id)}
											>
												<X class="size-3.5" />
												<span>Cancelar</span>
											</Button>

											<Button
												type="button"
												size="sm"
												variant="outline"
												class="flex-1 h-9 gap-1.5 text-xs font-medium"
												title="Ver listado de ítems y detalle de la orden"
												onclick={() => (viewingOrderId = order.id)}
											>
												<Eye class="size-3.5" />
												<span>Ver Ítems</span>
											</Button>

											<Button
												type="button"
												size="sm"
												class="flex-1 h-9 gap-1.5 text-xs font-semibold"
												title="Entregar orden y marcar como finalizada"
												onclick={() => (deliveringOrderId = order.id)}
											>
												<Check class="size-3.5" />
												<span>Entregar</span>
											</Button>
										</div>
									{:else if order.status === 'completed'}
										<div class="grid grid-cols-2 gap-2 pt-1">
											<Button
												type="button"
												size="sm"
												variant="outline"
												class="h-9 gap-1.5 text-xs font-medium"
												title="Ver listado de ítems y detalle de la orden"
												onclick={() => (viewingOrderId = order.id)}
											>
												<Eye class="size-3.5" />
												<span>Ver Ítems</span>
											</Button>

											<div class="flex h-9 items-center justify-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-700">
												<Check class="size-3.5" />
												<span>Finalizada</span>
											</div>
										</div>
									{:else}
										<div class="grid grid-cols-2 gap-2 pt-1">
											<Button
												type="button"
												size="sm"
												variant="outline"
												class="h-9 gap-1.5 text-xs font-medium"
												title="Ver listado de ítems y detalle de la orden"
												onclick={() => (viewingOrderId = order.id)}
											>
												<Eye class="size-3.5" />
												<span>Ver Ítems</span>
											</Button>

											<div class="flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 text-xs font-medium text-muted-foreground">
												<span>Cancelada</span>
											</div>
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>

					<TablePagination
						bind:currentPage
						bind:pageSize
						totalItems={filteredOrders.length}
						itemLabel="órdenes"
					/>
				</div>
			{:else}
				<div class="rounded-xl border border-dashed border-border p-12 text-center">
					<ShoppingBag class="mx-auto size-10 text-muted-foreground/60" />
					<p class="mt-3 text-base font-medium text-foreground">
						Todavía no hay órdenes registradas con este filtro
					</p>
					<p class="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
						Usa el botón "Nueva Orden de Compra" para registrar órdenes de mostrador u órdenes por encargo con fecha de entrega y señas.
					</p>
					<Button class="mt-4" href="/orders/new">
						<Plus class="size-4" />
						<span>Crear Primera Orden</span>
					</Button>
				</div>
			{/if}
		</CardContent>
	</Card>
{/snippet}

{#snippet newOrderModal()}
	<!-- ========================================================================
	     MODAL 1: Asistente de Venta Rápida (Buscador, Atajos, Flujo por Ítem y Checkout)
	     ======================================================================== -->
	{#if showNewOrderModal}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
			role="dialog"
			aria-modal="true"
			aria-labelledby="new-order-modal-title"
		>
			<div class="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
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
										{draftLines.length} {draftLines.length === 1 ? 'producto cargado' : 'productos cargados'}
									</Badge>
								{:else if orderModalView === 'item_config'}
									<Badge variant="outline" class="border-primary/40 bg-primary/10 text-primary text-xs">
										Configurando ítem
									</Badge>
								{:else}
									<Badge variant="outline" class="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 text-xs">
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
								onclick={() => (showNewOrderModal = false)}
							>
								<X class="size-4" />
							</Button>
						</div>
					</div>
				</div>

				{#if data.salesProducts.length === 0}
					<div class="space-y-4 p-8 text-center">
						<Tag class="mx-auto size-10 text-muted-foreground" />
						<p class="text-base font-semibold text-foreground">
							Primero debes habilitar al menos un Producto para Venta
						</p>
						<p class="mx-auto max-w-md text-sm text-muted-foreground">
							Ve a la pestaña "Productos para Venta" dentro de Inventario para asociar tus productos finales con un precio comercial.
						</p>
						<div class="flex justify-center gap-3 pt-2">
							<Button variant="outline" onclick={() => (showNewOrderModal = false)}>
								Cerrar
							</Button>
							<Button href="/inventory?tab=products">
								Ir a Productos para Venta →
							</Button>
						</div>
					</div>
				{:else}
					<!-- ======================================================== -->
					<!-- VISTA 1: CATÁLOGO, BUSCADOR, ATAJOS Y TARJETAS CARGADAS   -->
					<!-- ======================================================== -->
					{#if orderModalView === 'catalog'}
						<div class="flex-1 overflow-y-auto p-6 space-y-6">
							<!-- 1. Buscador Rápido de Productos -->
							<div class="space-y-2">
								<Label for="order-prod-search" class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
									Buscador de Productos
								</Label>
								<div class="relative">
									<Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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

								<!-- Resultados de la búsqueda instantánea -->
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
																<span class="font-mono text-xs font-semibold text-muted-foreground">
																	[{prod.code}]
																</span>
																<span class="font-medium text-sm text-foreground group-hover:text-primary">
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
															<span class="rounded bg-primary/20 px-2 py-1 text-xs font-semibold text-primary">
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
										<Label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
															<span class="rounded bg-primary/10 px-1 py-0.2 text-[9px] font-bold text-primary">
																Combo
															</span>
														{/if}
													</div>
													<h4 class="mt-1 line-clamp-2 text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
														{prod.name}
													</h4>
													<div class="mt-2 font-mono text-xs font-bold text-emerald-600">
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
									<!-- Fallback de sugeridos si no configuró atajos -->
									<div class="rounded-xl border border-dashed border-border p-4 bg-muted/10 space-y-3">
										<div class="flex items-center justify-between">
											<p class="text-xs text-muted-foreground">
												Aún no tienes atajos marcados. Toca la estrella ⭐ para fijar productos frecuentes, o toca cualquiera de estos sugeridos:
											</p>
										</div>
										<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
											{#each suggestedFallbackProducts as prod (prod.id)}
												<button
													type="button"
													onclick={() => startConfiguringProduct(prod)}
													class="group relative flex flex-col justify-between rounded-xl border border-border bg-card p-2.5 text-left transition-all hover:border-primary hover:bg-muted/10 cursor-pointer active:scale-[0.98]"
												>
													<div class="flex flex-col pr-5">
														<span class="font-mono text-[10px] text-muted-foreground">{prod.code}</span>
														<span class="line-clamp-1 text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{prod.name}</span>
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
										<Label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
											Productos en la Orden ({draftLines.length})
										</Label>
									</div>
									<span class="font-mono text-sm font-bold text-foreground">
										Subtotal: {formatCurrency(draftTotalAmount)}
									</span>
								</div>

								{#if draftLines.length === 0}
									<div class="rounded-xl border border-dashed border-border/80 bg-muted/5 p-8 text-center">
										<ShoppingBag class="mx-auto size-8 text-muted-foreground/40" />
										<p class="mt-2 text-sm font-medium text-foreground">
											La orden está vacía
										</p>
										<p class="text-xs text-muted-foreground">
											Toca un atajo rápido arriba o busca un producto para comenzar a armar la venta.
										</p>
									</div>
								{:else}
									<div class="space-y-2.5">
										{#each draftLines as line, idx (line.key)}
											<div class="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-2xs transition-all hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between">
												<div class="min-w-0 flex-1 space-y-1">
													<div class="flex flex-wrap items-center gap-2">
														<span class="rounded bg-muted px-2 py-0.5 font-mono text-xs font-bold text-foreground">
															{line.quantity} ×
														</span>
														<span class="font-semibold text-sm text-foreground">
															{line.productName}
														</span>
														{#if line.fulfillmentType === 'immediate'}
															<Badge variant="outline" class="gap-1 border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-700">
																<Zap class="size-2.5" />
																Venta Inmediata
															</Badge>
														{:else}
															<Badge variant="outline" class="gap-1 border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700">
																<Clock class="size-2.5" />
																Por Encargo
															</Badge>
														{/if}
													</div>

													<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
														<span>Unitario: {formatCurrency(line.unitPrice)}</span>
														{#if line.fulfillmentType === 'preorder' && line.deliveryDate}
															<span class="flex items-center gap-1 font-mono text-amber-700">
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

												<div class="flex items-center justify-between gap-3 border-t border-border/40 pt-2 sm:border-t-0 sm:pt-0">
													<!-- Control rápido de cantidad -->
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
														<span class="flex h-7 w-8 items-center justify-center border border-input bg-background font-mono text-xs font-bold">
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
						<div class="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-4">
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
									<Button
										type="button"
										variant="outline"
										onclick={() => (showNewOrderModal = false)}
									>
										Cerrar
									</Button>
								{/if}
							</div>

							<div class="flex items-center gap-3">
								<div class="text-right">
									<span class="block text-[11px] text-muted-foreground">Total de la Orden</span>
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

					<!-- ======================================================== -->
					<!-- VISTA 2: CONFIGURACIÓN PASO A PASO DEL ÍTEM SELECCIONADO  -->
					<!-- ======================================================== -->
					{#if orderModalView === 'item_config' && configuringProduct}
						<div class="flex-1 overflow-y-auto p-6 space-y-6">
							<!-- Tarjeta del Producto Seleccionado -->
							<div class="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4">
								<div>
									<div class="flex items-center gap-2">
										<span class="font-mono text-xs font-bold text-primary">
											[{configuringProduct.code}]
										</span>
										<h3 class="text-base font-bold text-foreground">
											{configuringProduct.name}
										</h3>
										{#if configuringProduct.isCombo}
											<Badge variant="secondary" class="text-[10px]">
												Combo
											</Badge>
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

							<!-- SUB-PASO 1: CANTIDAD -->
							{#if itemWizardStep === 'quantity'}
								<div class="space-y-4">
									<div>
										<h4 class="text-sm font-semibold text-foreground">
											Paso 1: ¿Cuántas unidades deseas agregar?
										</h4>
										<p class="text-xs text-muted-foreground">
											Ajusta la cantidad con los botones o escribe el número directamente.
										</p>
									</div>

									<!-- Control de cantidad y precio -->
									<div class="grid grid-cols-1 gap-4 rounded-xl border border-border bg-muted/15 p-4 sm:grid-cols-2">
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
											<span class="text-xs text-muted-foreground">Precio Unitario Calculado</span>
											<span class="font-mono text-base font-bold {modalItemPriceCalc.appliedTier ? 'text-emerald-600' : 'text-foreground'}">
												{formatCurrency(modalItemPriceCalc.unitPrice)}
											</span>
											{#if modalItemPriceCalc.appliedTier}
												<span class="text-[11px] text-emerald-700 font-semibold">
													✨ {modalItemPriceCalc.discountPct}% OFF por escala (≥{modalItemPriceCalc.appliedTier.minQuantity}u)
												</span>
											{/if}
										</div>
									</div>
								</div>
							{/if}

							<!-- SUB-PASO 2: MODALIDAD (VENTA O PEDIDO) -->
							{#if itemWizardStep === 'type'}
								<div class="space-y-4">
									<div>
										<h4 class="text-sm font-semibold text-foreground">
											Paso 2: ¿Cómo se entregará este producto?
										</h4>
										<p class="text-xs text-muted-foreground">
											Selecciona si es una venta en el momento para entregar ya, o un pedido por encargo para otra fecha.
										</p>
									</div>

									<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
										<!-- Botón Orden Inmediata: agrega directo sin pedir fecha ni nota -->
										<button
											type="button"
											onclick={finishAddingImmediateItem}
											class="group flex flex-col justify-between rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/5 p-6 text-left transition-all hover:border-emerald-500 hover:bg-emerald-500/10 hover:shadow-md cursor-pointer active:scale-[0.98]"
										>
											<div class="space-y-2">
												<div class="flex size-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-700">
													<Zap class="size-5" />
												</div>
												<h3 class="text-base font-bold text-foreground group-hover:text-emerald-700">
													Orden Inmediata
												</h3>
												<p class="text-xs text-muted-foreground leading-relaxed">
													Se entrega y despacha ahora en el mostrador. Descuenta el stock en el acto.
												</p>
											</div>
											<div class="mt-4 flex items-center justify-between border-t border-emerald-500/20 pt-3">
												<span class="text-xs font-semibold text-emerald-700">
													Listo en el acto
												</span>
												<span class="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-xs">
													Agregar ya →
												</span>
											</div>
										</button>

										<!-- Botón Orden por Encargo: avanza a fecha y notas -->
										<button
											type="button"
											onclick={() => (itemWizardStep = 'preorder_details')}
											class="group flex flex-col justify-between rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 p-6 text-left transition-all hover:border-amber-500 hover:bg-amber-500/10 hover:shadow-md cursor-pointer active:scale-[0.98]"
										>
											<div class="space-y-2">
												<div class="flex size-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700">
													<Clock class="size-5" />
												</div>
												<h3 class="text-base font-bold text-foreground group-hover:text-amber-700">
													Orden por Encargo
												</h3>
												<p class="text-xs text-muted-foreground leading-relaxed">
													Para elaborar y entregar en un día y horario futuro. Producción Just-In-Time.
												</p>
											</div>
											<div class="mt-4 flex items-center justify-between border-t border-amber-500/20 pt-3">
												<span class="text-xs font-semibold text-amber-700">
													Pautar entrega
												</span>
												<span class="rounded-lg bg-amber-600 px-3 py-1 text-xs font-bold text-white shadow-xs">
													Configurar horario →
												</span>
											</div>
										</button>
									</div>
								</div>
							{/if}

							<!-- SUB-PASO 3: DETALLES DE PEDIDO (FECHA, HORA Y NOTA) -->
							{#if itemWizardStep === 'preorder_details'}
								<div class="space-y-5">
									<div>
										<h4 class="text-sm font-semibold text-foreground">
											Paso 3: Fecha de Entrega y Notas del Encargo
										</h4>
										<p class="text-xs text-muted-foreground">
											Especifica cuándo debe estar listo y agrega indicaciones para la elaboración.
										</p>
									</div>

									<div class="rounded-xl border border-border bg-card p-4 space-y-3">
										<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
											<div class="space-y-1.5">
												<Label for="item-modal-delivery-date" class="text-xs font-semibold">
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
													<Label for="item-modal-delivery-time" class="text-xs font-semibold">
														Hora Pactada
													</Label>
													<span class="text-[10px] text-muted-foreground font-mono">Paso: 15 min</span>
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

						<!-- Navegación del Mini-Wizard por Producto -->
						<div class="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-4">
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

					<!-- ======================================================== -->
					<!-- VISTA 3: CHECKOUT FINAL, CLIENTE Y COBRO                  -->
					<!-- ======================================================== -->
					{#if orderModalView === 'checkout'}
						<form
							method="POST"
							action="?/createOrder"
							class="flex flex-1 flex-col overflow-hidden"
							use:enhance={() => {
								return async ({ result, update }) => {
									await update();
									if (result.type === 'success') {
										showNewOrderModal = false;
									}
								};
							}}
						>
							<input type="hidden" name="businessId" value={data.activeBusiness.id} />
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
										<h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
														<span class="text-[10px] text-emerald-700 bg-emerald-500/10 px-1.5 py-0.2 rounded font-medium">Inmediata</span>
													{:else}
														<span class="text-[10px] text-amber-700 bg-amber-500/10 px-1.5 py-0.2 rounded font-medium">Encargo</span>
													{/if}
												</div>
												<span class="font-mono font-semibold">{formatCurrency(l.quantity * l.unitPrice)}</span>
											</div>
										{/each}
									</div>

									<div class="flex items-center justify-between border-t border-border pt-2">
										<span class="text-xs font-semibold text-muted-foreground">Total General</span>
										<span class="font-mono text-base font-bold text-foreground">
											{formatCurrency(draftTotalAmount)}
										</span>
									</div>
								</div>

								<!-- Datos del Cliente -->
								<div class="rounded-xl border border-border bg-card p-4 space-y-3">
									<div class="flex items-center justify-between">
										<Label for="chk-customer" class="text-xs font-semibold">Cliente</Label>
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
									<Label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
										Modalidad de Cobro
									</Label>

									<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
										<!-- Cobro Total -->
										<button
											type="button"
											onclick={() => {
												draftPaymentStatus = 'paid';
												draftPaidAmount = Number(draftTotalAmount.toFixed(2));
											}}
											class="flex flex-col justify-between rounded-xl border p-4 text-left transition-all {draftPaymentStatus === 'paid'
												? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20'
												: 'border-border bg-card hover:bg-muted/30'}"
										>
											<div class="space-y-1">
												<div class="flex items-center justify-between">
													<span class="text-xs font-bold text-foreground">Cobro Total</span>
													<Check class="size-4 {draftPaymentStatus === 'paid' ? 'text-emerald-600' : 'text-transparent'}" />
												</div>
												<p class="text-[11px] text-muted-foreground">Abona el 100% ahora</p>
											</div>
											<div class="mt-3 font-mono text-sm font-bold text-emerald-600">
												{formatCurrency(draftTotalAmount)}
											</div>
										</button>

										<!-- Seña / Pago Parcial -->
										<button
											type="button"
											onclick={() => {
												draftPaymentStatus = 'partially_paid';
												if (draftPaidAmount <= 0 || draftPaidAmount >= draftTotalAmount) {
													setDepositPercentage(50);
												}
											}}
											class="flex flex-col justify-between rounded-xl border p-4 text-left transition-all {draftPaymentStatus === 'partially_paid'
												? 'border-sky-500 bg-sky-500/10 ring-2 ring-sky-500/20'
												: 'border-border bg-card hover:bg-muted/30'}"
										>
											<div class="space-y-1">
												<div class="flex items-center justify-between">
													<span class="text-xs font-bold text-foreground">Seña / Parcial</span>
													<CreditCard class="size-4 {draftPaymentStatus === 'partially_paid' ? 'text-sky-600' : 'text-muted-foreground'}" />
												</div>
												<p class="text-[11px] text-muted-foreground">Deja un adelanto</p>
											</div>
											<div class="mt-3 font-mono text-sm font-bold text-sky-600">
												{formatCurrency(draftPaidAmount)}
											</div>
										</button>

										<!-- Al Retirar -->
										<button
											type="button"
											onclick={() => {
												draftPaymentStatus = 'pending';
												draftPaidAmount = 0;
											}}
											class="flex flex-col justify-between rounded-xl border p-4 text-left transition-all {draftPaymentStatus === 'pending'
												? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/20'
												: 'border-border bg-card hover:bg-muted/30'}"
										>
											<div class="space-y-1">
												<div class="flex items-center justify-between">
													<span class="text-xs font-bold text-foreground">Al Retirar</span>
													<Clock class="size-4 {draftPaymentStatus === 'pending' ? 'text-amber-600' : 'text-muted-foreground'}" />
												</div>
												<p class="text-[11px] text-muted-foreground">Paga al entregar</p>
											</div>
											<div class="mt-3 font-mono text-sm font-bold text-amber-600">
												$ 0,00 ahora
											</div>
										</button>
									</div>

									<!-- Control de monto de seña si es pago parcial -->
									{#if draftPaymentStatus === 'partially_paid'}
										<div class="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 space-y-3">
											<div class="flex flex-wrap items-center justify-between gap-2">
												<Label for="step-paid-amount" class="text-xs font-semibold text-foreground">
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
									<Label for="chk-notes" class="text-xs font-semibold">Notas Generales de la Orden</Label>
									<Input
										id="chk-notes"
										bind:value={draftNotes}
										placeholder="Ej. Retira por sucursal centro, embalar para viaje..."
										class="h-10 text-sm"
									/>
								</div>
							</div>

							<!-- Acciones de Confirmación -->
							<div class="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-4">
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
{/snippet}

{#snippet viewOrderModal()}
	<!-- ========================================================================
	     MODAL 2: Detalle de Orden y Entrega Just-In-Time por Línea
	     ======================================================================== -->
	{#if viewingOrder}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
			role="dialog"
			aria-modal="true"
		>
			<div class="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
				<!-- Header -->
				<div class="flex items-start justify-between gap-4 border-b border-border bg-muted/20 p-6">
					<div class="space-y-1.5">
						<div class="flex items-center gap-2">
							<span class="rounded-md bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-bold text-primary">
								{viewingOrder.orderNumber}
							</span>
							<Badge variant="outline">
								{ORDER_STATUS_LABELS[viewingOrder.status]}
							</Badge>
							<Badge variant="secondary">
								{PAYMENT_STATUS_LABELS[viewingOrder.status === 'completed' ? 'paid' : viewingOrder.paymentStatus]}
							</Badge>
						</div>
						<h2 class="text-xl font-bold text-foreground">
							{viewingOrder.customerName}
						</h2>
						<div class="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
							<span>Creada: {formatDateTime(viewingOrder.createdAt)}</span>
							{#if viewingOrder.deliveryDate}
								<span>·</span>
								<span class="inline-flex items-center gap-1 font-medium text-foreground">
									<Calendar class="size-3.5 text-primary" />
									Entrega: {formatDateTime(viewingOrder.deliveryDate)}
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
						onclick={() => (viewingOrderId = null)}
					>
						<X class="size-4" />
					</Button>
				</div>

				<!-- Contenido: Lista de Ítems (Solo Lectura) -->
				<div class="max-h-[65vh] space-y-4 overflow-y-auto p-6">
					{#if viewingOrder.notes}
						<div class="rounded-xl border border-border bg-muted/30 p-3 text-xs italic text-muted-foreground">
							<strong class="font-semibold text-foreground not-italic">Nota de la orden: </strong>
							"{viewingOrder.notes}"
						</div>
					{/if}

					<div class="overflow-x-auto rounded-xl border border-border">
						<table class="w-full text-left text-sm">
							<thead class="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
								<tr>
									<th class="py-3 pr-3 pl-4 font-semibold">Producto / Ítem</th>
									<th class="px-3 py-3 text-right font-semibold">Cant.</th>
									<th class="px-3 py-3 text-right font-semibold">Unitario</th>
									<th class="px-3 py-3 text-right font-semibold">Subtotal</th>
									<th class="py-3 pr-4 pl-3 text-right font-semibold">Estado</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border/60">
								{#each viewingOrder.items as line (line.id)}
									<tr class="hover:bg-muted/10">
										<td class="py-3 pr-3 pl-4">
											<p class="font-medium text-foreground">{line.productName}</p>
											{#if line.notes}
												<p class="mt-0.5 text-xs text-muted-foreground italic">
													"{line.notes}"
												</p>
											{/if}
										</td>
										<td class="px-3 py-3 text-right font-mono text-xs font-bold text-foreground">
											{line.quantity}
										</td>
										<td class="px-3 py-3 text-right font-mono text-xs text-muted-foreground">
											{formatCurrency(line.unitPrice)}
										</td>
										<td class="px-3 py-3 text-right font-mono text-xs font-semibold text-foreground">
											{formatCurrency(line.quantity * line.unitPrice)}
										</td>
										<td class="py-3 pr-4 pl-3 text-right">
											<Badge
												variant="outline"
												class="text-[10px] {line.status === 'delivered' || viewingOrder.status === 'completed'
													? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
													: line.status === 'pending_delivery'
														? 'border-amber-500/40 bg-amber-500/10 text-amber-700'
														: 'border-red-500/40 bg-red-500/10 text-red-700'}"
											>
												{line.status === 'delivered' || viewingOrder.status === 'completed'
													? 'Entregado'
													: line.status === 'pending_delivery'
														? 'Pendiente'
														: 'Cancelado'}
											</Badge>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Resumen Financiero -->
					<div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-4 text-sm">
						<div class="flex items-center gap-3 text-xs">
							{#if viewingOrder.status === 'completed' || viewingOrder.paymentStatus === 'paid'}
								<span class="rounded bg-emerald-500/15 px-2 py-1 font-semibold text-emerald-700">
									Totalmente Pagado
								</span>
							{:else if viewingOrder.paymentStatus === 'partially_paid'}
								<div>
									<span class="text-muted-foreground">Seña pagada: </span>
									<strong class="font-mono text-amber-700">
										{formatCurrency(viewingOrder.paidAmount)}
									</strong>
									<span class="mx-2 text-muted-foreground">·</span>
									<span class="text-muted-foreground">Saldo pendiente: </span>
									<strong class="font-mono text-foreground">
										{formatCurrency(Math.max(0, viewingOrder.totalAmount - viewingOrder.paidAmount))}
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
								{formatCurrency(viewingOrder.totalAmount)}
							</span>
						</div>
					</div>
				</div>

				<!-- Footer: Solo botón Cerrar (Solo Lectura) -->
				<div class="flex items-center justify-end border-t border-border bg-muted/20 px-6 py-4">
					<Button type="button" size="sm" onclick={() => (viewingOrderId = null)}>
						Cerrar
					</Button>
				</div>
			</div>
		</div>
	{/if}
{/snippet}

{#snippet payOrderModal()}
	<!-- ========================================================================
	     MODAL 3: Registrar Pago / Seña
	     ======================================================================== -->
	{#if payingOrder}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
			role="dialog"
			aria-modal="true"
		>
			<div class="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
				<div class="flex items-start justify-between gap-4 border-b border-border p-6">
					<div class="space-y-1">
						<span class="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
							{payingOrder.orderNumber}
						</span>
						<h2 class="text-lg font-bold text-foreground">
							Actualizar Pago — {payingOrder.customerName}
						</h2>
						<p class="text-xs text-muted-foreground">
							Total de la orden: <strong>{formatCurrency(payingOrder.totalAmount)}</strong> (Abonado actual: {formatCurrency(payingOrder.paidAmount)})
						</p>
					</div>
					<Button
						type="button"
						size="icon"
						variant="ghost"
						class="size-8"
						onclick={() => (payingOrderId = null)}
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
								payingOrderId = null;
							}
						};
					}}
				>
					<div class="space-y-4 p-6">
						<input type="hidden" name="businessId" value={data.activeBusiness.id} />
						<input type="hidden" name="orderId" value={payingOrder.id} />

						<div class="space-y-2">
							<Label for="pay-status">Estado de Pago</Label>
							<select
								id="pay-status"
								name="paymentStatus"
								bind:value={payModalStatus}
								onchange={() => {
									if (payModalStatus === 'paid') payModalAmount = payingOrder.totalAmount;
									else if (payModalStatus === 'pending') payModalAmount = 0;
								}}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
							>
								<option value="paid">Pagado Total ({formatCurrency(payingOrder.totalAmount)})</option>
								<option value="partially_paid">Pago Parcial / Seña</option>
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
								max={payingOrder.totalAmount}
								bind:value={payModalAmount}
								class="h-10 font-mono"
								required
							/>
						</div>
					</div>

					<div class="flex items-center justify-end gap-3 border-t border-border bg-muted/20 px-6 py-4">
						<Button type="button" variant="outline" onclick={() => (payingOrderId = null)}>
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
{/snippet}

{#snippet cancelOrderModal()}
	<!-- ========================================================================
	     MODAL 4: Confirmar Cancelación de Orden
	     ======================================================================== -->
	{#if cancellingOrder}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
			role="dialog"
			aria-modal="true"
		>
			<div class="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
				<div class="space-y-3 p-6">
					<div class="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
						<AlertTriangle class="size-5" />
					</div>
					<div class="space-y-1.5">
						<h2 class="text-lg font-bold text-foreground">
							¿Cancelar la orden {cancellingOrder.orderNumber}?
						</h2>
						<p class="text-sm text-muted-foreground">
							Los encargos pendientes de esta orden quedarán cancelados y dejarán de comprometer sub-ensambles a futuro.
						</p>
					</div>
				</div>

				<div class="flex items-center justify-end gap-2.5 border-t border-border bg-muted/20 px-6 py-4">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onclick={() => (cancellingOrderId = null)}
					>
						Volver
					</Button>
					<form
						method="POST"
						action="?/cancelOrder"
						use:enhance={() => {
							return async ({ update }) => {
								await update();
								cancellingOrderId = null;
							};
						}}
					>
						<input type="hidden" name="businessId" value={data.activeBusiness.id} />
						<input type="hidden" name="orderId" value={cancellingOrder.id} />
						<Button type="submit" variant="destructive" size="sm">
							Sí, cancelar orden
						</Button>
					</form>
				</div>
			</div>
		</div>
	{/if}
{/snippet}

{#snippet deliverOrderModal()}
	<!-- ========================================================================
	     MODAL 5: Confirmar Entrega de Orden
	     ======================================================================== -->
	{#if deliveringOrder}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
			role="dialog"
			aria-modal="true"
		>
			<div class="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
				<div class="space-y-3 p-6">
					<div class="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
						<Check class="size-5" />
					</div>
					<div class="space-y-1.5">
						<h2 class="text-lg font-bold text-foreground">
							¿Confirmar entrega de la orden {deliveringOrder.orderNumber}?
						</h2>
						<p class="text-sm text-muted-foreground">
							Se registrará la entrega para <strong>{deliveringOrder.customerName}</strong>, se descontarán los insumos correspondientes y la orden pasará a estar <strong>Finalizada</strong>.
						</p>
					</div>
				</div>

				<div class="flex items-center justify-end gap-2.5 border-t border-border bg-muted/20 px-6 py-4">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onclick={() => (deliveringOrderId = null)}
					>
						Cancelar
					</Button>
					<form
						method="POST"
						action="?/completeOrder"
						use:enhance={() => {
							return async ({ update }) => {
								await update();
								deliveringOrderId = null;
							};
						}}
					>
						<input type="hidden" name="businessId" value={data.activeBusiness.id} />
						<input type="hidden" name="orderId" value={deliveringOrder.id} />
						<Button type="submit" size="sm" class="gap-1.5">
							<Check class="size-3.5" />
							<span>Sí, entregar orden</span>
						</Button>
					</form>
				</div>
			</div>
		</div>
	{/if}
{/snippet}

{#snippet confirmOrderModal()}
	<!-- ========================================================================
	     MODAL 6: Confirmar Pedido (Caja / Encargado)
	     ======================================================================== -->
	{#if confirmingOrder}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
			role="dialog"
			aria-modal="true"
		>
			<div class="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
				<div class="flex items-center justify-between border-b border-border p-5">
					<div class="flex items-center gap-2.5">
						<div class="flex size-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-700">
							<Check class="size-5" />
						</div>
						<div>
							<h3 class="text-base font-bold text-foreground">
								Confirmar Pedido {confirmingOrder.orderNumber}
							</h3>
							<p class="text-xs text-muted-foreground">
								Validación de caja / encargado
							</p>
						</div>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onclick={() => (confirmingOrderId = null)}
						class="size-8 text-muted-foreground hover:text-foreground"
						title="Cerrar modal"
					>
						<X class="size-4" />
					</Button>
				</div>

				<form
					method="POST"
					action="?/confirmOrder"
					use:enhance={() => {
						return async ({ update }) => {
							await update();
							confirmingOrderId = null;
						};
					}}
					class="p-5 space-y-4 text-xs"
				>
					<input type="hidden" name="businessId" value={data.activeBusiness.id} />
					<input type="hidden" name="orderId" value={confirmingOrder.id} />

					<!-- Resumen del pedido -->
					<div class="rounded-xl border border-border bg-muted/20 p-3 space-y-1.5">
						<div class="flex justify-between">
							<span class="text-muted-foreground">Cliente:</span>
							<span class="font-semibold text-foreground">{confirmingOrder.customerName}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-muted-foreground">Total de la Orden:</span>
							<span class="font-mono font-bold text-foreground">{formatCurrency(confirmingOrder.totalAmount)}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-muted-foreground">Ítems a confirmar:</span>
							<span class="font-mono text-muted-foreground">{confirmingOrder.items.length} productos</span>
						</div>
					</div>

					<p class="text-muted-foreground text-[11px] leading-relaxed">
						Al confirmar, el pedido comenzará a descontar stock inmediato de sus productos y se contabilizará en la previsión de insumos y recetas de cocina.
					</p>

					<!-- Monto de Seña / Pago (Opcional) -->
					<div class="space-y-1.5">
						<Label class="text-xs font-semibold text-foreground">
							Monto de Seña / Pago Recibido ($) <span class="text-muted-foreground font-normal">(Opcional)</span>
						</Label>
						<Input
							type="number"
							step="100"
							min="0"
							max={confirmingOrder.totalAmount}
							name="paidAmount"
							bind:value={confirmDepositAmount}
							class="h-9 font-mono text-xs font-bold"
						/>
						<span class="text-[10px] text-muted-foreground">
							Total orden: {formatCurrency(confirmingOrder.totalAmount)}. Si no se abonó nada, puedes dejarlo en 0.
						</span>
					</div>

					<!-- ID de Transacción (Opcional) -->
					<div class="space-y-1.5">
						<Label class="text-xs font-semibold text-foreground">
							ID de Transacción / Comprobante <span class="text-muted-foreground font-normal">(Opcional)</span>
						</Label>
						<Input
							type="text"
							name="transactionId"
							placeholder="Ej. TRANS-847291, N° de ticket o comprobante MP..."
							bind:value={confirmTransactionId}
							class="h-9 text-xs font-mono"
						/>
					</div>

					<div class="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={() => (confirmingOrderId = null)}
						>
							Volver
						</Button>
						<Button
							type="submit"
							size="sm"
							class="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-xs"
						>
							<Check class="size-3.5" />
							<span>Confirmar Pedido</span>
						</Button>
					</div>
				</form>
			</div>
		</div>
	{/if}
{/snippet}

<AppShell
	user={data.user}
	activeBusiness={data.activeBusiness}
	businesses={data.businesses}
	currentSection="orders"
	title="Órdenes de Compra"
	description="Gestión integral de órdenes con entrega inmediata en mostrador y órdenes programadas por encargo"
	{headerActions}
>
	{@render salesSummary()}
	{@render orderFiltersAndList()}

	{@render newOrderModal()}
	{@render viewOrderModal()}
	{@render payOrderModal()}
	{@render cancelOrderModal()}
	{@render deliverOrderModal()}
	{@render confirmOrderModal()}
</AppShell>
