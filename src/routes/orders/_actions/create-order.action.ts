import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import {
	PAYMENT_STATUSES,
	type CreateOrderLineInput,
	type PaymentStatus
} from '#lib/features/orders/domain/order.entity';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';

export async function createOrderAction({ request, locals, url }: RequestEvent) {
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
	const transactionId = String(formData.get('transactionId') ?? '').trim() || null;
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
			transactionId,
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
}
