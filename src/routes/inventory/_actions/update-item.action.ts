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
	const name = String(formData.get('name') ?? '').trim();
	const type = String(formData.get('type') ?? 'raw_material') as ItemType;
	const baseUnit = String(formData.get('baseUnit') ?? 'g') as UnitOfMeasure;
	const referenceCost = Number(formData.get('referenceCost') ?? 0);
	const purchaseQuantity = Number(formData.get('purchaseQuantity') ?? 1);
	const yieldQuantity = Number(formData.get('yieldQuantity') ?? 1);
	const prepTimeMinutes = formData.has('prepTimeMinutes')
		? Number(formData.get('prepTimeMinutes') ?? 0)
		: undefined;
	const notes = String(formData.get('notes') ?? '').trim() || null;

	try {
		const updated = await itemService.updateItem(id, activeBusiness.id, {
			name,
			type,
			baseUnit,
			referenceCost: Number.isFinite(referenceCost) ? referenceCost : 0,
			purchaseQuantity:
				Number.isFinite(purchaseQuantity) && purchaseQuantity > 0 ? purchaseQuantity : 1,
			yieldQuantity: Number.isFinite(yieldQuantity) && yieldQuantity > 0 ? yieldQuantity : 1,
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
