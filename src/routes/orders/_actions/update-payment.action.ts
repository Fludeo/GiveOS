import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import {
	PAYMENT_STATUSES,
	type PaymentStatus
} from '#lib/features/orders/domain/order.entity';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';

export async function updatePaymentAction({ request, locals, url }: RequestEvent) {
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
	const transactionId = String(formData.get('transactionId') ?? '').trim() || null;

	try {
		const updated = await orderService.updateOrderPayment(
			activeBusiness.id,
			orderId,
			Number.isFinite(paidAmount) && paidAmount >= 0 ? paidAmount : 0,
			paymentStatus,
			transactionId
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
}
