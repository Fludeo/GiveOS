import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import type { RecipeOperationalCost } from '#lib/features/items/domain/item.entity';
import { saveRecipeOperationalCostsSchema } from '#lib/schemas/recipe-operational-costs.schema';

export async function saveRecipeOperationalCostsAction({ request, locals, url }: RequestEvent) {
	if (!locals.user) throw redirect(302, '/login');

	const form = await superValidate(request, zod4(saveRecipeOperationalCostsSchema));
	if (!form.valid) {
		return fail(400, { form });
	}

	const businessIdParam =
		form.data.businessId || url.searchParams.get('business');
	const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

	const { itemService } = getServices();
	const itemId = form.data.itemId;

	const item = await itemService.getItemById(itemId, activeBusiness.id);
	if (!item) {
		return fail(404, { form, error: 'Elaboración no encontrada.' });
	}

	const companyResources = activeBusiness.settings?.operationalCosts ?? [];

	// Normalizar costos asegurando que el nombre, tipo y tarifa por hora provengan de la configuración si hay coincidencia
	const normalizedCosts: RecipeOperationalCost[] = form.data.costs.map((c) => {
		const matched = companyResources.find(
			(r) => (c.resourceId && r.id === c.resourceId) || r.name.toLowerCase() === (c.name || '').toLowerCase()
		);

		return {
			id: c.id || crypto.randomUUID(),
			resourceId: matched?.id ?? c.resourceId,
			name: matched?.name ?? (c.name ? String(c.name).trim() : 'Recurso'),
			type: matched?.type ?? (c.type === 'passive' ? 'passive' : 'active'),
			durationMinutes: Math.max(0, Number(c.durationMinutes) || 0),
			ratePerHour: matched ? matched.ratePerHour : Math.max(0, Number(c.ratePerHour) || 0),
			isScalable: Boolean(c.isScalable),
			notes: c.notes ? String(c.notes).trim() : null
		};
	});

	const activeMinutes = normalizedCosts
		.filter((c) => c.type === 'active')
		.reduce((sum, c) => sum + c.durationMinutes, 0);
	const passiveMinutes = normalizedCosts
		.filter((c) => c.type === 'passive')
		.reduce((sum, c) => sum + c.durationMinutes, 0);

	const currentRecipeConfig = item.recipeConfig ?? {
		yieldQuantity: item.yieldQuantity > 0 ? item.yieldQuantity : 1,
		activeTimeMinutes: activeMinutes,
		passiveTimeMinutes: passiveMinutes,
		notes: item.notes
	};

	const updatedConfig = {
		...currentRecipeConfig,
		activeTimeMinutes: activeMinutes,
		passiveTimeMinutes: passiveMinutes,
		isScalable:
			normalizedCosts.length > 0
				? normalizedCosts.every((c) => Boolean(c.isScalable))
				: Boolean(currentRecipeConfig.isScalable),
		operationalCosts: normalizedCosts
	};

	try {
		await itemService.updateItem(itemId, activeBusiness.id, {
			recipeConfig: updatedConfig
		});

		return {
			form,
			success: true,
			message: 'Costos operativos y tiempos de la receta actualizados exitosamente.'
		};
	} catch (e) {
		return fail(400, {
			form,
			error: e instanceof Error ? e.message : 'Error al guardar los costos operativos.'
		});
	}
}
