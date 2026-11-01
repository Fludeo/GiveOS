import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { getServices } from '#lib/server/container';
import type { PaymentStatus } from '#lib/features/orders/domain/order.entity';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import { updatePaymentSchema } from '$lib/schemas/order.schema';

export async function updatePaymentAction({ request, locals, url }: RequestEvent) {
	if (!locals.user) throw redirect(302, '/login');

	const form = await superValidate(request, zod4(updatePaymentSchema));
	if (!form.valid) {
		return fail(400, { form });
	}

	const businessIdParam =
		form.data.businessId || url.searchParams.get('business');
	const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

	const { orderService } = getServices();
	const { orderId, paidAmount, paymentStatus, transactionId } = form.data;

	try {
		const updated = await orderService.updateOrderPayment(
			activeBusiness.id,
			orderId,
			paidAmount,
			paymentStatus as PaymentStatus | undefined,
			transactionId?.trim() || null
		);
		return message(form, `Pago de la orden ${updated.orderNumber} actualizado.`);
	} catch (e) {
		return fail(400, {
			form,
			error: e instanceof Error ? e.message : 'Error al actualizar el pago.'
		});
	}
}
