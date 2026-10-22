import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';

export async function removeRecipeLineAction({ request, locals, url }: RequestEvent) {
	if (!locals.user) throw redirect(302, '/login');
	const formData = await request.formData();
	const businessIdParam =
		String(formData.get('businessId') ?? '') || url.searchParams.get('business');
	const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

	const { recipeService } = getServices();
	const lineId = String(formData.get('lineId') ?? '');

	try {
		await recipeService.removeLine(activeBusiness.id, lineId);
		return { success: true, message: 'Ingrediente quitado de la receta.' };
	} catch (e) {
		return fail(400, {
			error: e instanceof Error ? e.message : 'Error al eliminar línea de la receta.'
		});
	}
}
