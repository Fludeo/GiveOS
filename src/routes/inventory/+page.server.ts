import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from './_actions/resolve-business';
import * as inventoryActions from './_actions';

export const load: PageServerLoad = async ({ url, locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

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

	const selectedParam = url.searchParams.get('item');
	const defaultItem =
		items.find((i) => i.id === selectedParam) ??
		items.find((i) => i.type === 'prepared') ??
		items[0] ??
		null;

	const selectedRecipeTree = defaultItem
		? await recipeService.getRecipeTree(activeBusiness.id, defaultItem.id)
		: null;

	const tabParam = url.searchParams.get('tab');
	const initialTab: 'stock' | 'recipes' | 'products' =
		tabParam === 'recipes' || tabParam === 'bom'
			? 'recipes'
			: tabParam === 'products'
				? 'products'
				: tabParam === 'stock'
					? 'stock'
					: selectedParam
						? 'recipes'
						: 'stock';

	return {
		user: locals.user,
		activeBusiness,
		businesses: memberships.map((m) => ({ ...m.business, role: m.role })),
		items,
		recipeSummaries,
		selectedRecipeTree,
		salesProducts,
		initialTab,
		restockItemId: url.searchParams.get('restock')
	};
};

export const actions: Actions = {
	...inventoryActions
};
