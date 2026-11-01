import { redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import { createSalesProductSchema } from '$lib/schemas/sales-product.schema';
import * as newProductActions from './_actions';

export const load: PageServerLoad = async ({ url, locals }) => {
	if (!locals.user) throw redirect(302, '/login');

	const requestedBusinessId = url.searchParams.get('business');
	const { memberships, activeBusiness } = await resolveBusinessOrRedirect(
		locals.user.id,
		requestedBusinessId
	);

	const { itemService, recipeService, orderService } = getServices();

	const [items, recipeSummaries, salesProducts] = await Promise.all([
		itemService.listItems(activeBusiness.id),
		recipeService.getAllRecipeSummaries(activeBusiness.id),
		orderService.listSalesProducts(activeBusiness.id)
	]);

	const form = await superValidate(zod4(createSalesProductSchema));

	return {
		user: locals.user,
		activeBusiness,
		businesses: memberships.map((m) => ({ ...m.business, role: m.role })),
		items,
		recipeSummaries,
		existingCodes: salesProducts.map((p) => p.code),
		form
	};
};

export const actions: Actions = {
	...newProductActions
};

