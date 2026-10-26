import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';

export async function completeOrderAction({ request, locals, url }: RequestEvent) {
	if (!locals.user) throw redirect(302, '/login');
	const formData = await request.formData();
	const businessIdParam =
		String(formData.get('businessId') ?? '') || url.searchParams.get('business');
	const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

	const { orderService } = getServices();
	const orderId = String(formData.get('orderId') ?? '');
	const useDisplayStock =
		formData.get('useDisplayStock') === 'true' || formData.get('useDisplayStock') === 'on';

	try {
		const updated = await orderService.completeOrderJustInTime(
			activeBusiness.id,
			orderId,
			useDisplayStock
		);
		return {
			success: true,
			message: `Orden ${updated.orderNumber} completada Just-In-Time (sub-ensambles e insumos descontados).`
		};
	} catch (e) {
		return fail(400, {
			error: e instanceof Error ? e.message : 'Error al completar la orden.'
		});
	}
}
