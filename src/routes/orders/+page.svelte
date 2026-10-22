<script lang="ts">
	import { replaceState } from '$app/navigation';
	import type { PageProps } from './$types';
	import type { OrderWithItems } from '#lib/features/orders/domain/order.entity';
	import AppShell from '#lib/components/layout/app-shell.svelte';
	import { Button } from '#lib/components/ui/button';
	import Plus from '@lucide/svelte/icons/plus';
	import Tag from '@lucide/svelte/icons/tag';
	import { toast } from '#lib/components/ui/toast';

	// Componentes modulares
	import OrdersSummaryCards from './_components/sections/orders-summary-cards.svelte';
	import OrdersListSection from './_components/sections/orders-list-section.svelte';
	import NewOrderModal from './_components/modals/new-order-modal.svelte';
	import ViewOrderModal from './_components/modals/view-order-modal.svelte';
	import PayOrderModal from './_components/modals/pay-order-modal.svelte';
	import CancelOrderModal from './_components/modals/cancel-order-modal.svelte';
	import DeliverOrderModal from './_components/modals/deliver-order-modal.svelte';
	import ConfirmOrderModal from './_components/modals/confirm-order-modal.svelte';

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

{#snippet headerActions()}
	<Button variant="outline" href="/inventory?tab=products">
		<Tag class="size-4" />
		<span>Catálogo de Venta ({data.salesProducts.length})</span>
	</Button>
	<Button
		onclick={() => (showNewOrderModal = true)}
		variant="secondary"
		class="gap-1.5 font-bold shadow-xs cursor-pointer"
	>
		<Plus class="size-4" />
		<span>Nueva Orden Rápida</span>
	</Button>
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
	<!-- 1. Tarjetas de Resumen y KPIs -->
	<OrdersSummaryCards orders={data.orders} />

	<!-- 2. Listado, Filtros y Paginación de Órdenes -->
	<OrdersListSection
		orders={data.orders}
		onViewOrder={(order: OrderWithItems) => (viewingOrderId = order.id)}
		onPayOrder={(order: OrderWithItems) => (payingOrderId = order.id)}
		onDeliverOrder={(order: OrderWithItems) => (deliveringOrderId = order.id)}
		onCancelOrder={(order: OrderWithItems) => (cancellingOrderId = order.id)}
		onConfirmOrder={(order: OrderWithItems) => (confirmingOrderId = order.id)}
	/>

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
</AppShell>
