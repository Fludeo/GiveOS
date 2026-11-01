import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { getServices } from '#lib/server/container';
import type { ItemType, UnitOfMeasure } from '#lib/features/items/domain/item.entity';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import { updateItemSchema } from '#lib/schemas/item.schema';

export async function updateItemAction({ request, locals, url }: RequestEvent) {
	if (!locals.user) throw redirect(302, '/login');

	const form = await superValidate(request, zod4(updateItemSchema));
	if (!form.valid) {
		return fail(400, { form });
	}

	const businessIdParam =
		form.data.businessId || url.searchParams.get('business');
	const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

	const { itemService } = getServices();
	const existing = await itemService.getItemById(form.data.id, activeBusiness.id);
	if (!existing) {
		return fail(404, { form, error: 'Ítem no encontrado.' });
	}

	const name = form.data.name.trim() || existing.name;
	const type = (form.data.type as ItemType) || existing.type;
	const baseUnit = (form.data.baseUnit as UnitOfMeasure) || existing.baseUnit;
	const referenceCost = form.data.referenceCost ?? existing.referenceCost;
	const purchaseQuantity = form.data.purchaseQuantity ?? existing.purchaseQuantity;
	const yieldQuantity = form.data.yieldQuantity ?? existing.yieldQuantity;
	const minStock = form.data.minStock ?? existing.minStock;
	const notes = form.data.notes?.trim() || null;

	let recipeConfig = existing.recipeConfig;
	if (form.data.isMakeToOrder !== undefined || form.data.yieldQuantity !== undefined) {
		const isMakeToOrder = form.data.isMakeToOrder ?? Boolean(existing.recipeConfig?.isMakeToOrder);

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
		const updated = await itemService.updateItem(form.data.id, activeBusiness.id, {
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
		return message(form, `Ficha técnica de "${updated.name}" (${updated.code}) actualizada.`);
	} catch (e) {
		return fail(400, { form, error: e instanceof Error ? e.message : 'Error al actualizar el ítem.' });
	}
}
