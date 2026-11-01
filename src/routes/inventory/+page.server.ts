import { redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import { addRecipeLineSchema } from '$lib/schemas/recipe-line.schema';
import { saveRecipeOperationalCostsSchema } from '$lib/schemas/recipe-operational-costs.schema';
import { createItemSchema, updateItemSchema } from '$lib/schemas/item.schema';
import { createSalesProductSchema, updateSalesProductSchema } from '$lib/schemas/sales-product.schema';
import { addStockBatchSchema } from '$lib/schemas/stock-batch.schema';
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

	const addRecipeLineForm = await superValidate(zod4(addRecipeLineSchema));
	const recipeCostsForm = await superValidate(zod4(saveRecipeOperationalCostsSchema));
	const createItemForm = await superValidate(zod4(createItemSchema));
	const newSalesProductForm = await superValidate(zod4(createSalesProductSchema));
	const editSalesProductForm = await superValidate(zod4(updateSalesProductSchema));
	const adjustItemForm = await superValidate(zod4(updateItemSchema));
	const editRecipeItemForm = await superValidate(zod4(updateItemSchema));
	const addStockBatchForm = await superValidate(zod4(addStockBatchSchema));

	return {
		user: locals.user,
		activeBusiness,
		businesses: memberships.map((m: any) => ({ ...m.business, role: m.role })),
		items,
		recipeSummaries,
		selectedRecipeTree,
		salesProducts,
		initialTab,
		restockItemId: url.searchParams.get('restock'),
		addRecipeLineForm,
		recipeCostsForm,
		createItemForm,
		newSalesProductForm,
		editSalesProductForm,
		adjustItemForm,
		editRecipeItemForm,
		addStockBatchForm
	};
};

export const actions: Actions = {
	...inventoryActions
};
