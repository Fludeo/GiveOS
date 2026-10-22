import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from './resolve-business';

export async function addStockBatchAction({ request, locals, url }: RequestEvent) {
	if (!locals.user) throw redirect(302, '/login');
	const formData = await request.formData();
	const businessIdParam =
		String(formData.get('businessId') ?? '') || url.searchParams.get('business');
	const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

	const { itemService, recipeService } = getServices();
	const id = String(formData.get('id') ?? '');
	const quantity = Number(formData.get('quantity') ?? 0);
	const totalCost = Number(formData.get('totalCost') ?? 0);
	const supplier = String(formData.get('supplier') ?? '').trim() || null;
	const notes = String(formData.get('notes') ?? '').trim() || null;

	try {
		const existing = await itemService.getItemById(id, activeBusiness.id);
		if (!existing) {
			return fail(404, { error: 'Ítem no encontrado.' });
		}

		if (existing.type === 'prepared') {
			const prod = await recipeService.produceItemBatch(activeBusiness.id, id, quantity, notes);
			const hasDeducted = prod.consumedComponents.length > 0;
			return {
				success: true,
				message: hasDeducted
					? `Producción registrada: +${quantity} ${prod.parent.baseUnit} de "${prod.parent.name}" e ingredientes de receta descontados.`
					: `Stock de elaboración aumentado: +${quantity} ${prod.parent.baseUnit} de "${prod.parent.name}".`
			};
		} else {
			const { item, addedBatch } = await itemService.addStockBatch(id, activeBusiness.id, {
				quantity,
				totalCost,
				supplier,
				notes
			});
			const formattedUnitCost = new Intl.NumberFormat('es-AR', {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			}).format(addedBatch.unitCost);
			return {
				success: true,
				message: `Carga exitosa: +${addedBatch.initialQuantity} ${item.baseUnit} de "${item.name}" ($ ${formattedUnitCost} / ${item.baseUnit}).`
			};
		}
	} catch (e) {
		return fail(400, {
			error: e instanceof Error ? e.message : 'Error al registrar la carga de stock.'
		});
	}
}
