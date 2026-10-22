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
	const isPrepTimeScalable = formData.has('isPrepTimeScalable')
		? formData.get('isPrepTimeScalable') === 'true' || formData.get('isPrepTimeScalable') === 'on'
		: existing.isPrepTimeScalable;
	const prepTimeMinutes = formData.has('prepTimeMinutes')
		? Number(formData.get('prepTimeMinutes') ?? 0)
		: existing.prepTimeMinutes;
	const passiveTimeMinutes = formData.has('passiveTimeMinutes')
		? Number(formData.get('passiveTimeMinutes') ?? 0)
		: existing.passiveTimeMinutes;
	const notes = formData.has('notes')
		? String(formData.get('notes') ?? '').trim() || null
		: existing.notes;

	let recipeConfig = existing.recipeConfig;
	if (formData.has('isMakeToOrder') || formData.has('yieldQuantity')) {
		const isMakeToOrder = formData.has('isMakeToOrder')
			? formData.get('isMakeToOrder') === 'true' || formData.get('isMakeToOrder') === 'on'
			: Boolean(existing.recipeConfig?.isMakeToOrder);

		recipeConfig = {
			yieldQuantity: Number.isFinite(yieldQuantity) && yieldQuantity > 0 ? yieldQuantity : 1,
			activeTimeMinutes: existing.recipeConfig?.activeTimeMinutes ?? 0,
			passiveTimeMinutes: existing.recipeConfig?.passiveTimeMinutes ?? 0,
			isScalable: existing.recipeConfig?.isScalable ?? false,
			isMakeToOrder,
			operationalCosts: existing.recipeConfig?.operationalCosts ?? [],
			notes
		};
	}

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
			recipeConfig,
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
