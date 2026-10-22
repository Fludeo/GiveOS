import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import type { UnitOfMeasure } from '#lib/features/items/domain/item.entity';
import { resolveBusinessOrRedirect } from './resolve-business';

export async function addRecipeLineAction({ request, locals, url }: RequestEvent) {
	if (!locals.user) throw redirect(302, '/login');
	const formData = await request.formData();
	const businessIdParam =
		String(formData.get('businessId') ?? '') || url.searchParams.get('business');
	const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

	const { recipeService } = getServices();
	const parentItemId = String(formData.get('parentItemId') ?? '');
	const componentItemId = String(formData.get('componentItemId') ?? '');
	const quantity = Number(formData.get('quantity') ?? 0);
	const unit = String(formData.get('unit') ?? 'g') as UnitOfMeasure;
	const notes = String(formData.get('notes') ?? '').trim() || null;

	try {
		await recipeService.addLine(activeBusiness.id, {
			parentItemId,
			componentItemId,
			quantity,
			unit,
			notes
		});
		return { success: true, message: 'Ingrediente agregado a la receta correctamente.' };
	} catch (e) {
		return fail(400, {
			error: e instanceof Error ? e.message : 'Error al agregar línea a la receta.'
		});
	}
}
