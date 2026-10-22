import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import type { UnitOfMeasure } from '#lib/features/items/domain/item.entity';
import { resolveBusinessOrRedirect } from './resolve-business';

export async function updateStockAndCostAction({ request, locals, url }: RequestEvent) {
	if (!locals.user) throw redirect(302, '/login');
	const formData = await request.formData();
	const businessIdParam =
		String(formData.get('businessId') ?? '') || url.searchParams.get('business');
	const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

	const { itemService, recipeService } = getServices();
	const id = String(formData.get('id') ?? '');
	const name = formData.has('name') ? String(formData.get('name') ?? '').trim() : undefined;
	const baseUnit = formData.has('baseUnit')
		? (String(formData.get('baseUnit') ?? '') as UnitOfMeasure)
		: undefined;
	const currentStock = Number(formData.get('currentStock') ?? 0);
	const minStock = Number(formData.get('minStock') ?? 0);
	const referenceCost = Number(formData.get('referenceCost') ?? 0);
	const purchaseQuantity = Number(formData.get('purchaseQuantity') ?? 1);

	try {
		const existing = await itemService.getItemById(id, activeBusiness.id);
		if (!existing) {
			return fail(404, { error: 'Ítem no encontrado.' });
		}

		const targetStock = Number.isFinite(currentStock) && currentStock >= 0 ? currentStock : 0;
		const stockDelta = targetStock - existing.currentStock;

		// Si es un producto preparado y se incrementa su stock, descontar proporcionalmente sus ingredientes de la receta
		if (existing.type !== 'raw_material' && stockDelta > 0) {
			await recipeService.produceItemBatch(activeBusiness.id, id, stockDelta);
		}

		const updated = await itemService.updateItem(id, activeBusiness.id, {
			name: name ? name : undefined,
			baseUnit: baseUnit ? baseUnit : undefined,
			currentStock: formData.has('currentStock') ? targetStock : undefined,
			minStock: Number.isFinite(minStock) && minStock >= 0 ? minStock : 0,
			referenceCost: Number.isFinite(referenceCost) && referenceCost >= 0 ? referenceCost : 0,
			purchaseQuantity:
				Number.isFinite(purchaseQuantity) && purchaseQuantity > 0 ? purchaseQuantity : 1
		});
		return {
			success: true,
			message:
				existing.type !== 'raw_material' && stockDelta > 0
					? `Stock de "${updated.name}" incrementado (+${stockDelta} ${updated.baseUnit}) e ingredientes de su receta descontados.`
					: `Existencias y costos de "${updated.name}" (${updated.code}) actualizados.`
		};
	} catch (e) {
		return fail(400, {
			error: e instanceof Error ? e.message : 'Error al actualizar el inventario.'
		});
	}
}
