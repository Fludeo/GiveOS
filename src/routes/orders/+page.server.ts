import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getServices } from '#lib/server/container';
import {
	PAYMENT_STATUSES,
	type CreateOrderLineInput,
	type PaymentStatus
} from '#lib/features/orders/domain/order.entity';

async function resolveBusinessOrRedirect(userId: string, requestedBusinessId?: string | null) {
	const { businessService } = getServices();
	const memberships = await businessService.listUserBusinesses(userId);
	if (memberships.length === 0) {
		throw redirect(302, '/onboarding');
	}
	const activeBusiness =
		(requestedBusinessId
			? memberships.find((m) => m.business.id === requestedBusinessId)?.business
			: null) ?? memberships[0].business;

	return {
		memberships,
		activeBusiness
	};
}

export const load: PageServerLoad = async ({ url, locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const requestedBusinessId = url.searchParams.get('business');
	const { memberships, activeBusiness } = await resolveBusinessOrRedirect(
		locals.user.id,
		requestedBusinessId
	);

	const { orderService } = getServices();

	const [orders, salesProducts] = await Promise.all([
		orderService.listOrders(activeBusiness.id),
		orderService.listSalesProducts(activeBusiness.id)
	]);

	return {
		user: locals.user,
		activeBusiness,
		businesses: memberships.map((m) => ({ ...m.business, role: m.role })),
		orders,
		salesProducts: salesProducts.filter((p) => p.isActive),
		openNewModalOnLoad: url.searchParams.get('new') === '1',
		createdOrderNumber: url.searchParams.get('created')
	};
};

export const actions: Actions = {
	createOrder: async ({ request, locals, url }) => {
		if (!locals.user) throw redirect(302, '/login');
		const formData = await request.formData();
		const businessIdParam =
			String(formData.get('businessId') ?? '') || url.searchParams.get('business');
		const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

		const { orderService } = getServices();
		const customerName = String(formData.get('customerName') ?? '').trim() || 'Cliente Mostrador';
		const paymentStatusRaw = String(formData.get('paymentStatus') ?? 'pending') as PaymentStatus;
		const paymentStatus = PAYMENT_STATUSES.includes(paymentStatusRaw)
			? paymentStatusRaw
			: 'pending';
		const paidAmount = Number(formData.get('paidAmount') ?? 0);
		const deliveryDateRaw = String(formData.get('deliveryDate') ?? '').trim();
		const notes = String(formData.get('notes') ?? '').trim() || null;
		const linesJson = String(formData.get('linesJson') ?? '[]');

		let parsedLines: CreateOrderLineInput[] = [];
		try {
			parsedLines = JSON.parse(linesJson);
		} catch {
			return fail(400, { error: 'Formato de líneas de orden inválido.' });
		}

		let deliveryDate: Date | null = null;
		if (deliveryDateRaw) {
			const d = new Date(deliveryDateRaw);
			if (!Number.isNaN(d.getTime())) {
				deliveryDate = d;
			}
		}

		try {
			const created = await orderService.createOrder({
				businessId: activeBusiness.id,
				customerName,
				paymentStatus,
				paidAmount: Number.isFinite(paidAmount) && paidAmount >= 0 ? paidAmount : 0,
				deliveryDate,
				notes,
				lines: parsedLines
			});

			const immediateCount = created.items.filter(
				(i) => i.fulfillmentType === 'immediate'
			).length;
			const preorderCount = created.items.filter(
				(i) => i.fulfillmentType === 'preorder'
			).length;

			return {
				success: true,
				message: `Orden ${created.orderNumber} creada (${immediateCount} entregados ahora · ${preorderCount} por encargo).`
			};
		} catch (e) {
			return fail(400, {
				error: e instanceof Error ? e.message : 'Error al registrar la orden.'
			});
		}
	},

	deliverOrderItem: async ({ request, locals, url }) => {
		if (!locals.user) throw redirect(302, '/login');
		const formData = await request.formData();
		const businessIdParam =
			String(formData.get('businessId') ?? '') || url.searchParams.get('business');
		const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

		const { orderService } = getServices();
		const orderId = String(formData.get('orderId') ?? '');
		const lineId = String(formData.get('lineId') ?? '');

		try {
			const updated = await orderService.deliverOrderItemJustInTime(
				activeBusiness.id,
				orderId,
				lineId
			);
			return {
				success: true,
				message: `Ítem entregado Just-In-Time (+1 producido con consumo de su Receta y -1 entregado) en ${updated.orderNumber}.`
			};
		} catch (e) {
			return fail(400, {
				error: e instanceof Error ? e.message : 'Error al entregar el ítem de la orden.'
			});
		}
	},

	completeOrder: async ({ request, locals, url }) => {
		if (!locals.user) throw redirect(302, '/login');
		const formData = await request.formData();
		const businessIdParam =
			String(formData.get('businessId') ?? '') || url.searchParams.get('business');
		const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

		const { orderService } = getServices();
		const orderId = String(formData.get('orderId') ?? '');

		try {
			const updated = await orderService.completeOrderJustInTime(activeBusiness.id, orderId);
			return {
				success: true,
				message: `Orden ${updated.orderNumber} completada Just-In-Time (sub-ensambles e insumos descontados).`
			};
		} catch (e) {
			return fail(400, {
				error: e instanceof Error ? e.message : 'Error al completar la orden.'
			});
		}
	},

	updatePayment: async ({ request, locals, url }) => {
		if (!locals.user) throw redirect(302, '/login');
		const formData = await request.formData();
		const businessIdParam =
			String(formData.get('businessId') ?? '') || url.searchParams.get('business');
		const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

		const { orderService } = getServices();
		const orderId = String(formData.get('orderId') ?? '');
		const paidAmount = Number(formData.get('paidAmount') ?? 0);
		const paymentStatusRaw = String(formData.get('paymentStatus') ?? '') as PaymentStatus;
		const paymentStatus = PAYMENT_STATUSES.includes(paymentStatusRaw)
			? paymentStatusRaw
			: undefined;

		try {
			const updated = await orderService.updateOrderPayment(
				activeBusiness.id,
				orderId,
				Number.isFinite(paidAmount) && paidAmount >= 0 ? paidAmount : 0,
				paymentStatus
			);
			return {
				success: true,
				message: `Pago de la orden ${updated.orderNumber} actualizado.`
			};
		} catch (e) {
			return fail(400, {
				error: e instanceof Error ? e.message : 'Error al actualizar el pago.'
			});
		}
	},

	cancelOrder: async ({ request, locals, url }) => {
		if (!locals.user) throw redirect(302, '/login');
		const formData = await request.formData();
		const businessIdParam =
			String(formData.get('businessId') ?? '') || url.searchParams.get('business');
		const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

		const { orderService } = getServices();
		const orderId = String(formData.get('orderId') ?? '');

		try {
			const updated = await orderService.cancelOrder(activeBusiness.id, orderId);
			return {
				success: true,
				message: `Orden ${updated.orderNumber} cancelada.`
			};
		} catch (e) {
			return fail(400, {
				error: e instanceof Error ? e.message : 'Error al cancelar la orden.'
			});
		}
	},

	toggleShortcut: async ({ request, locals, url }) => {
		if (!locals.user) throw redirect(302, '/login');
		const formData = await request.formData();
		const businessIdParam =
			String(formData.get('businessId') ?? '') || url.searchParams.get('business');
		const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

		const { orderService } = getServices();
		const productId = String(formData.get('productId') ?? '');

		try {
			const updated = await orderService.toggleSalesProductShortcut(productId, activeBusiness.id);
			return {
				success: true,
				message: updated.isShortcut
					? `"${updated.name}" agregado a atajos rápidos.`
					: `"${updated.name}" removido de atajos rápidos.`
			};
		} catch (e) {
			return fail(400, {
				error: e instanceof Error ? e.message : 'Error al actualizar atajo.'
			});
		}
	}
};
