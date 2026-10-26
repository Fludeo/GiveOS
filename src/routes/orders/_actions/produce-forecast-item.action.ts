import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';

export async function produceForecastItemAction({ request, locals, url }: RequestEvent) {
	if (!locals.user) throw redirect(302, '/login');
	const formData = await request.formData();
	const businessIdParam =
		String(formData.get('businessId') ?? '') || url.searchParams.get('business');
	const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

	const { recipeService } = getServices();
	const itemId = String(formData.get('itemId') ?? '').trim();
	const quantity = Number(formData.get('quantity') ?? 0);

	if (!itemId || !Number.isFinite(quantity) || quantity <= 0) {
		return fail(400, { error: 'La cantidad a producir debe ser mayor a 0.' });
	}

	try {
		const { parent } = await recipeService.produceItemBatch(
			activeBusiness.id,
			itemId,
			quantity,
			'Producción desde Predicciones'
		);

		return {
			success: true,
			message: `Producción completada: +${quantity} ${parent.baseUnit} de "${parent.name}" en stock (insumos descontados).`
		};
	} catch (e) {
		return fail(400, {
			error: e instanceof Error ? e.message : 'Error al producir el faltante.'
		});
	}
}
