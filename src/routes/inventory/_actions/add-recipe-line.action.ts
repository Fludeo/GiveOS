import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import { addRecipeLineSchema } from '$lib/schemas/recipe-line.schema';

export async function addRecipeLineAction({ request, locals, url }: RequestEvent) {
	if (!locals.user) throw redirect(302, '/login');

	const form = await superValidate(request, zod4(addRecipeLineSchema));
	if (!form.valid) {
		return fail(400, { form });
	}

	const businessIdParam =
		form.data.businessId || url.searchParams.get('business');
	const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

	const { recipeService } = getServices();

	try {
		await recipeService.addLine(activeBusiness.id, {
			parentItemId: form.data.parentItemId,
			componentItemId: form.data.componentItemId,
			quantity: form.data.quantity,
			unit: form.data.unit,
			notes: form.data.notes?.trim() || null
		});
		return {
			form,
			success: true,
			message: 'Ingrediente agregado a la receta correctamente.'
		};
	} catch (e) {
		return fail(400, {
			form,
			error: e instanceof Error ? e.message : 'Error al agregar línea a la receta.'
		});
	}
}
