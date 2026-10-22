import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from './resolve-business';

export async function updateRecipeYieldAction({ request, locals, url }: RequestEvent) {
	if (!locals.user) throw redirect(302, '/login');
	const formData = await request.formData();
	const businessIdParam =
		String(formData.get('businessId') ?? '') || url.searchParams.get('business');
	const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

	const { itemService } = getServices();
	const id = String(formData.get('id') ?? '');
	const yieldQuantity = Number(formData.get('yieldQuantity') ?? 1);
	const prepTimeMinutes = formData.has('prepTimeMinutes')
		? Number(formData.get('prepTimeMinutes') ?? 0)
		: undefined;

	if (!Number.isFinite(yieldQuantity) || yieldQuantity <= 0) {
		return fail(400, { error: 'El rendimiento del lote debe ser un número mayor a 0.' });
	}

	try {
		const updated = await itemService.updateItem(id, activeBusiness.id, {
			yieldQuantity,
			prepTimeMinutes:
				prepTimeMinutes !== undefined && Number.isFinite(prepTimeMinutes) && prepTimeMinutes >= 0
					? Math.round(prepTimeMinutes)
					: undefined
		});
		return {
			success: true,
			message: `Parámetros de la receta para "${updated.name}" actualizados (Rinde ${yieldQuantity} ${updated.baseUnit}${updated.prepTimeMinutes > 0 ? ` · ${updated.prepTimeMinutes} min` : ''}).`
		};
	} catch (e) {
		return fail(400, {
			error: e instanceof Error ? e.message : 'Error al actualizar los parámetros de la receta.'
		});
	}
}
