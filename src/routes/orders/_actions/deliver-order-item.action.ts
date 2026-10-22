import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';

export async function deliverOrderItemAction({ request, locals, url }: RequestEvent) {
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
}
