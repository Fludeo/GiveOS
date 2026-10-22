import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import type { ItemType, UnitOfMeasure } from '#lib/features/items/domain/item.entity';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';

export async function updateItemAction({ request, locals, url }: RequestEvent) {
	if (!locals.user) throw redirect(302, '/login');
	const formData = await request.formData();
	const businessIdParam =
		String(formData.get('businessId') ?? '') || url.searchParams.get('business');
	const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

	const { itemService } = getServices();
	const id = String(formData.get('id') ?? '');

	const existing = await itemService.getItemById(id, activeBusiness.id);
	if (!existing) {
		return fail(404, { error: 'Ítem no encontrado.' });
	}

	const name = formData.has('name') ? String(formData.get('name') ?? '').trim() : existing.name;
	const type = formData.has('type') ? (String(formData.get('type')) as ItemType) : existing.type;
	const baseUnit = formData.has('baseUnit')
		? (String(formData.get('baseUnit')) as UnitOfMeasure)
		: existing.baseUnit;
	const referenceCost = formData.has('referenceCost')
		? Number(formData.get('referenceCost'))
		: existing.referenceCost;
	const purchaseQuantity = formData.has('purchaseQuantity')
		? Number(formData.get('purchaseQuantity'))
		: existing.purchaseQuantity;
	const yieldQuantity = formData.has('yieldQuantity')
		? Number(formData.get('yieldQuantity'))
		: existing.yieldQuantity;
	const minStock = formData.has('minStock')
		? Number(formData.get('minStock'))
		: existing.minStock;
	const prepTimeMinutes = formData.has('prepTimeMinutes')
		? Number(formData.get('prepTimeMinutes') ?? 0)
		: existing.prepTimeMinutes;
	const notes = formData.has('notes')
		? String(formData.get('notes') ?? '').trim() || null
		: existing.notes;

	try {
		const updated = await itemService.updateItem(id, activeBusiness.id, {
			name,
			type,
			baseUnit,
			referenceCost: Number.isFinite(referenceCost) ? referenceCost : 0,
			purchaseQuantity:
				Number.isFinite(purchaseQuantity) && purchaseQuantity > 0 ? purchaseQuantity : 1,
			yieldQuantity: Number.isFinite(yieldQuantity) && yieldQuantity > 0 ? yieldQuantity : 1,
			minStock: Number.isFinite(minStock) && minStock >= 0 ? minStock : 0,
			prepTimeMinutes:
				prepTimeMinutes !== undefined && Number.isFinite(prepTimeMinutes) && prepTimeMinutes >= 0
					? Math.round(prepTimeMinutes)
					: undefined,
			notes
		});
		return {
			success: true,
			message: `Ficha técnica de "${updated.name}" (${updated.code}) actualizada.`
		};
	} catch (e) {
		return fail(400, { error: e instanceof Error ? e.message : 'Error al actualizar el ítem.' });
	}
}
