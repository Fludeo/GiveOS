import { error, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import { updateSalesProductSchema } from '#lib/schemas/sales-product.schema';
import * as editProductActions from './_actions';

export const load: PageServerLoad = async ({ params, url, locals }) => {
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

	const product = salesProducts.find((p) => p.id === params.id);
	if (!product) {
		throw error(404, 'Producto para venta no encontrado');
	}

	const form = await superValidate(
		{
			businessId: activeBusiness.id,
			name: product.name,
			description: product.description,
			salePrice: product.salePrice,
			isActive: product.isActive,
			isShortcut: product.isShortcut,
			components: product.components.map((c) => ({
				itemId: c.itemId,
				quantity: c.quantity
			})),
			pricingTiers: product.pricingTiers ?? []
		},
		zod4(updateSalesProductSchema)
	);

	return {
		user: locals.user,
		activeBusiness,
		businesses: memberships.map((m) => ({ ...m.business, role: m.role })),
		items,
		recipeSummaries,
		product,
		form
	};
};

export const actions: Actions = {
	...editProductActions
};
