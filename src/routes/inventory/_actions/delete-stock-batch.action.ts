import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';

export async function deleteStockBatchAction({ request, locals, url }: RequestEvent) {
	if (!locals.user) throw redirect(302, '/login');
	const formData = await request.formData();
	const businessIdParam =
		String(formData.get('businessId') ?? '') || url.searchParams.get('business');
	const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

	const { itemService, recipeService } = getServices();
	const id = String(formData.get('id') ?? '');
	const batchId = String(formData.get('batchId') ?? '');

	try {
		const existing = await itemService.getItemById(id, activeBusiness.id);
		if (!existing) {
			return fail(404, { error: 'Ítem no encontrado.' });
		}

		if (existing.type === 'prepared') {
			const { parent, restoredComponents, removedBatch } = await recipeService.revertProducedBatch(
				activeBusiness.id,
				id,
				batchId
			);
			const restoredMsg =
				restoredComponents.length > 0
					? ` Se devolvieron los insumos consumidos al inventario.`
					: '';
			return {
				success: true,
				message: `Carga de elaboración eliminada (-${removedBatch.remainingQuantity} ${parent.baseUnit} de "${parent.name}").${restoredMsg}`
			};
		} else {
			const { item, removedBatch } = await itemService.deleteStockBatch(
				id,
				activeBusiness.id,
				batchId
			);
			return {
				success: true,
				message: `Carga de stock eliminada (-${removedBatch.remainingQuantity} ${item.baseUnit} de "${item.name}").`
			};
		}
	} catch (e) {
		return fail(400, {
			error: e instanceof Error ? e.message : 'Error al eliminar la carga de stock.'
		});
	}
}
