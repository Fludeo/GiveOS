import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from './resolve-business';

export async function deleteStockBatchAction({ request, locals, url }: RequestEvent) {
	if (!locals.user) throw redirect(302, '/login');
	const formData = await request.formData();
	const businessIdParam =
		String(formData.get('businessId') ?? '') || url.searchParams.get('business');
	const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

	const { itemService } = getServices();
	const id = String(formData.get('id') ?? '');
	const batchId = String(formData.get('batchId') ?? '');

	try {
		const { item, removedBatch } = await itemService.deleteStockBatch(
			id,
			activeBusiness.id,
			batchId
		);
		return {
			success: true,
			message: `Carga de stock eliminada (-${removedBatch.remainingQuantity} ${item.baseUnit} de "${item.name}").`
		};
	} catch (e) {
		return fail(400, {
			error: e instanceof Error ? e.message : 'Error al eliminar la carga de stock.'
		});
	}
}
