import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';

export async function produceOrdersBatchAction({ request, locals, url }: RequestEvent) {
	if (!locals.user) throw redirect(302, '/login');
	const formData = await request.formData();
	const businessIdParam =
		String(formData.get('businessId') ?? '') || url.searchParams.get('business');
	const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

	const { orderService } = getServices();
	const singleOrderId = String(formData.get('orderId') ?? '').trim();
	const orderIdsJson = String(formData.get('orderIdsJson') ?? '[]');
	const useDisplayStock =
		formData.get('useDisplayStock') === 'true' || formData.get('useDisplayStock') === 'on';

	let orderIds: string[] = [];
	if (singleOrderId) {
		orderIds = [singleOrderId];
	} else {
		try {
			const parsed = JSON.parse(orderIdsJson);
			if (Array.isArray(parsed)) {
				orderIds = parsed.map((id) => String(id).trim()).filter(Boolean);
			}
		} catch {
			return fail(400, { error: 'Formato de pedidos seleccionados inválido.' });
		}
	}

	if (orderIds.length === 0) {
		return fail(400, { error: 'Debes seleccionar al menos un pedido pendiente para producir.' });
	}

	try {
		const { processedOrdersCount, processedLinesCount } = await orderService.produceOrdersBatch(
			activeBusiness.id,
			orderIds,
			useDisplayStock
		);

		return {
			success: true,
			message:
				processedOrdersCount === 1
					? `Pedido producido y marcado como Listo para entregar (${processedLinesCount} ${processedLinesCount === 1 ? 'ítem' : 'ítems'} descontados de inventario).`
					: `${processedOrdersCount} pedidos producidos y marcados como Listos para entregar (${processedLinesCount} ítems descontados de inventario).`
		};
	} catch (e) {
		return fail(400, {
			error: e instanceof Error ? e.message : 'Error al registrar la producción de los pedidos.'
		});
	}
}
