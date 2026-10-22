import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';

export async function confirmOrderAction({ request, locals, url }: RequestEvent) {
	if (!locals.user) throw redirect(302, '/login');
	const formData = await request.formData();
	const businessIdParam =
		String(formData.get('businessId') ?? '') || url.searchParams.get('business');
	const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

	const { orderService } = getServices();
	const orderId = String(formData.get('orderId') ?? '');
	const paidAmountRaw = formData.get('paidAmount');
	const paidAmount =
		paidAmountRaw !== null && paidAmountRaw !== '' ? Number(paidAmountRaw) : undefined;
	const transactionId = String(formData.get('transactionId') ?? '').trim() || null;

	try {
		const updated = await orderService.confirmOrder(activeBusiness.id, orderId, {
			paidAmount,
			transactionId
		});
		return {
			success: true,
			message: `Orden ${updated.orderNumber} confirmada con éxito.`
		};
	} catch (e) {
		return fail(400, {
			error: e instanceof Error ? e.message : 'Error al confirmar la orden.'
		});
	}
}
