import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import { addStockBatchSchema } from '$lib/schemas/stock-batch.schema';

export async function addStockBatchAction({ request, locals, url }: RequestEvent) {
	if (!locals.user) throw redirect(302, '/login');

	const form = await superValidate(request, zod4(addStockBatchSchema));
	if (!form.valid) {
		return fail(400, { form });
	}

	const businessIdParam =
		form.data.businessId || url.searchParams.get('business');
	const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

	const { itemService, recipeService } = getServices();
	const id = form.data.id;
	const quantity = form.data.quantity;
	const totalCost = form.data.totalCost;
	const supplier = form.data.supplier?.trim() || null;
	const notes = form.data.notes?.trim() || null;

	try {
		const existing = await itemService.getItemById(id, activeBusiness.id);
		if (!existing) {
			return fail(404, { form, error: 'Ítem no encontrado.' });
		}

		if (existing.type === 'prepared') {
			const prod = await recipeService.produceItemBatch(activeBusiness.id, id, quantity, notes);
			const hasDeducted = prod.consumedComponents.length > 0;
			return message(
				form,
				hasDeducted
					? `Producción registrada: +${quantity} ${prod.parent.baseUnit} de "${prod.parent.name}" e ingredientes de receta descontados.`
					: `Stock de elaboración aumentado: +${quantity} ${prod.parent.baseUnit} de "${prod.parent.name}".`
			);
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
			return message(
				form,
				`Carga exitosa: +${addedBatch.initialQuantity} ${item.baseUnit} de "${item.name}" ($ ${formattedUnitCost} / ${item.baseUnit}).`
			);
		}
	} catch (e) {
		return fail(400, {
			form,
			error: e instanceof Error ? e.message : 'Error al registrar la carga de stock.'
		});
	}
}
