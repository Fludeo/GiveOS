import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import { createItemSchema } from '#lib/schemas/item.schema';

export async function createItemAction({ request, locals, url }: RequestEvent) {
	if (!locals.user) throw redirect(302, '/login');

	const form = await superValidate(request, zod4(createItemSchema));
	if (!form.valid) {
		return fail(400, { form });
	}

	const businessIdParam =
		form.data.businessId || url.searchParams.get('business');
	const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

	const { itemService } = getServices();

	try {
		const created = await itemService.createItem({
			businessId: activeBusiness.id,
			name: form.data.name.trim(),
			type: form.data.type as any,
			baseUnit: form.data.baseUnit as any,
			referenceCost: form.data.referenceCost,
			purchaseQuantity: form.data.purchaseQuantity,
			yieldQuantity: form.data.yieldQuantity,
			prepTimeMinutes: Math.round(form.data.prepTimeMinutes),
			passiveTimeMinutes: Math.round(form.data.passiveTimeMinutes),
			isPrepTimeScalable: form.data.isPrepTimeScalable,
			currentStock: form.data.currentStock,
			minStock: form.data.minStock,
			notes: form.data.notes?.trim() || null
		});

		return {
			form,
			success: true,
			message: `Ítem "${created.name}" creado correctamente.`
		};
	} catch (e) {
		return fail(400, {
			form,
			error: e instanceof Error ? e.message : 'Error al crear el ítem.'
		});
	}
}
