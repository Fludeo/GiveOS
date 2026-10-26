<script lang="ts">
	import { replaceState } from '$app/navigation';
	import type { PageProps } from './$types';
	import type { OrderWithItems } from '#lib/features/orders/domain/order.entity';
	import AppShell from '#lib/components/layout/app-shell.svelte';
	import { Button } from '#lib/components/ui/button';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import Boxes from '@lucide/svelte/icons/boxes';
	import { toast } from '#lib/components/ui/toast';

	// Componentes modulares
	import OrdersSummaryCards from './_components/sections/orders-summary-cards.svelte';
	import OrdersListSection from './_components/sections/orders-list-section.svelte';
	import OrdersDeliveriesWidget from './_components/sections/orders-deliveries-widget.svelte';
	import OrdersForecastSection from './_components/sections/orders-forecast-section.svelte';
	import NewOrderModal from './_components/modals/new-order-modal.svelte';
	import ViewOrderModal from './_components/modals/view-order-modal.svelte';
	import PayOrderModal from './_components/modals/pay-order-modal.svelte';
	import CancelOrderModal from './_components/modals/cancel-order-modal.svelte';
	import DeliverOrderModal from './_components/modals/deliver-order-modal.svelte';
	import ConfirmOrderModal from './_components/modals/confirm-order-modal.svelte';
	import ProduceOrdersModal from './_components/modals/produce-orders-modal.svelte';

	let { data }: PageProps = $props();

	// Pestaña activa: 'orders' | 'upcoming' | 'forecast'
	let activeTab = $state<'orders' | 'upcoming' | 'forecast' | null>(null);
	const currentTab = $derived<'orders' | 'upcoming' | 'forecast'>(
		activeTab ?? data.initialTab ?? 'orders'
	);

	function switchTab(tab: 'orders' | 'upcoming' | 'forecast') {
		activeTab = tab;
		if (typeof window !== 'undefined') {
			const url = new URL(window.location.href);
			url.searchParams.set('tab', tab);
			replaceState(url, {});
		}
	}

	$effect(() => {
		if (data.createdOrderNumber) {
			toast.success(
				`¡Orden ${data.createdOrderNumber} registrada con éxito!`,
				'Los productos y cobros han sido actualizados en el sistema.'
			);
			replaceState('/orders', {});
		}
	});

	$effect(() => {
		if (data.openNewModalOnLoad) {
			showNewOrderModal = true;
			replaceState('/orders', {});
		}
	});

	// Modales
	let showNewOrderModal = $state(false);
	let viewingOrderId = $state<string | null>(null);
	let payingOrderId = $state<string | null>(null);
	let cancellingOrderId = $state<string | null>(null);
	let deliveringOrderId = $state<string | null>(null);
	let confirmingOrderId = $state<string | null>(null);
	let producingOrders = $state<OrderWithItems[]>([]);
	let producingPeriodLabel = $state<string>('Seleccionados');

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
</script>

<svelte:head>
	<title>Órdenes de Compra — {data.activeBusiness.name}</title>
</svelte:head>

<AppShell
	user={data.user}
	activeBusiness={data.activeBusiness}
	businesses={data.businesses}
	currentSection="orders"
	title="Órdenes de Compra"
	description="Gestión de pedidos de mostrador, agenda de próximas entregas y previsión de demanda de insumos"
>
	<!-- Barra de Pestañas Unificada de Órdenes (Segmented Control 3 columnas en mobile) -->
	<div class="sticky top-2 z-20 grid grid-cols-3 gap-1 rounded-2xl border border-border bg-card/95 p-1.5 shadow-xs backdrop-blur-md sm:inline-flex sm:w-auto sm:gap-1.5">
		<button
			type="button"
			onclick={() => switchTab('orders')}
			class="inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs sm:px-3.5 sm:text-sm font-medium transition-colors cursor-pointer {currentTab ===
			'orders'
				? 'bg-primary text-primary-foreground shadow-xs font-semibold'
				: 'text-muted-foreground hover:text-foreground'}"
		>
			<ShoppingBag class="size-3.5 sm:size-4 shrink-0" />
			<span class="truncate sm:hidden">Pedidos</span>
			<span class="hidden sm:inline">Órdenes de Compra</span>
		</button>

		<button
			type="button"
			onclick={() => switchTab('upcoming')}
			class="inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs sm:px-3.5 sm:text-sm font-medium transition-colors cursor-pointer {currentTab ===
			'upcoming'
				? 'bg-primary text-primary-foreground shadow-xs font-semibold'
				: 'text-muted-foreground hover:text-foreground'}"
		>
			<CalendarClock class="size-3.5 sm:size-4 shrink-0" />
			<span class="truncate sm:hidden">Agenda</span>
			<span class="hidden sm:inline">Próximos Pedidos</span>
			{#if data.preorderForecast.pendingOrdersCount > 0}
				<span
					class="rounded-full px-1.5 py-0.2 text-[10px] font-bold shrink-0 {currentTab ===
					'upcoming'
						? 'bg-primary-foreground/20 text-primary-foreground'
						: 'bg-amber-500/15 text-amber-700 dark:text-amber-400'}"
				>
					{data.preorderForecast.pendingOrdersCount}
				</span>
			{/if}
		</button>

		<button
			type="button"
			onclick={() => switchTab('forecast')}
			class="inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs sm:px-3.5 sm:text-sm font-medium transition-colors cursor-pointer {currentTab ===
			'forecast'
				? 'bg-primary text-primary-foreground shadow-xs font-semibold'
				: 'text-muted-foreground hover:text-foreground'}"
		>
			<Boxes class="size-3.5 sm:size-4 shrink-0" />
			<span class="truncate sm:hidden">Demanda</span>
			<span class="hidden sm:inline">Demanda de Insumos & Ensambles</span>
			{#if data.preorderForecast.subAssemblyForecast.some((i) => i.isShortage) || data.preorderForecast.rawMaterialForecast.some((i) => i.isShortage)}
				<span
					class="size-2 rounded-full bg-red-500 shrink-0 sm:hidden"
					title="Hay faltantes de insumos o ensambles"
				></span>
				<span
					class="hidden sm:inline ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold {currentTab ===
					'forecast'
						? 'bg-primary-foreground/20 text-primary-foreground'
						: 'bg-red-500/15 text-red-700 dark:text-red-400'}"
				>
					Faltantes
				</span>
			{/if}
		</button>
	</div>

	{#if currentTab === 'orders'}
		<!-- 1. Tarjetas de Resumen y KPIs -->
		<OrdersSummaryCards
			orders={data.orders}
			salesProducts={data.allSalesProducts ?? data.salesProducts}
		/>

		<!-- 2. Listado, Filtros y Paginación de Órdenes -->
		<OrdersListSection
			orders={data.orders}
			onViewOrder={(order: OrderWithItems) => (viewingOrderId = order.id)}
			onPayOrder={(order: OrderWithItems) => (payingOrderId = order.id)}
			onDeliverOrder={(order: OrderWithItems) => (deliveringOrderId = order.id)}
			onCancelOrder={(order: OrderWithItems) => (cancellingOrderId = order.id)}
			onConfirmOrder={(order: OrderWithItems) => (confirmingOrderId = order.id)}
		/>
	{:else if currentTab === 'upcoming'}
		<!-- Agenda Completa de Próximos Pedidos con pestañas de 7 Días, +7 Días y Todos -->
		<OrdersDeliveriesWidget
			orders={data.orders}
			onViewOrder={(order: OrderWithItems) => (viewingOrderId = order.id)}
			onPayOrder={(order: OrderWithItems) => (payingOrderId = order.id)}
			onDeliverOrder={(order: OrderWithItems) => (deliveringOrderId = order.id)}
			onConfirmOrder={(order: OrderWithItems) => (confirmingOrderId = order.id)}
			onProduceOrders={(ordersToProduce: OrderWithItems[], periodLabel: string) => {
				producingOrders = ordersToProduce;
				producingPeriodLabel = periodLabel;
			}}
		/>
	{:else if currentTab === 'forecast'}
		<OrdersForecastSection
			forecast={data.preorderForecast}
			preserveDisplayStock={data.preserveDisplayStock}
			forecastHorizon={data.forecastHorizon}
			businessId={data.activeBusiness.id}
			recipeSummaries={data.recipeSummaries}
		/>
	{/if}

	<!-- 3. Modales Modulares -->
	<NewOrderModal
		bind:open={showNewOrderModal}
		salesProducts={data.salesProducts}
		businessId={data.activeBusiness.id}
		onClose={() => (showNewOrderModal = false)}
	/>

	<ViewOrderModal order={viewingOrder} onClose={() => (viewingOrderId = null)} />

	<PayOrderModal
		order={payingOrder}
		businessId={data.activeBusiness.id}
		onClose={() => (payingOrderId = null)}
	/>

	<CancelOrderModal
		order={cancellingOrder}
		businessId={data.activeBusiness.id}
		onClose={() => (cancellingOrderId = null)}
	/>

	<DeliverOrderModal
		order={deliveringOrder}
		businessId={data.activeBusiness.id}
		onClose={() => (deliveringOrderId = null)}
	/>

	<ConfirmOrderModal
		order={confirmingOrder}
		businessId={data.activeBusiness.id}
		onClose={() => (confirmingOrderId = null)}
	/>

	<ProduceOrdersModal
		orders={producingOrders}
		salesProducts={data.allSalesProducts ?? data.salesProducts}
		businessId={data.activeBusiness.id}
		periodLabel={producingPeriodLabel}
		onClose={() => (producingOrders = [])}
	/>
</AppShell>
