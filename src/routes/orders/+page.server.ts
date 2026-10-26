import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import * as orderActions from './_actions';

export const load: PageServerLoad = async ({ url, locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const requestedBusinessId = url.searchParams.get('business');
	const { memberships, activeBusiness } = await resolveBusinessOrRedirect(
		locals.user.id,
		requestedBusinessId
	);

	const { orderService, recipeService } = getServices();

	const preserveDisplayStock = url.searchParams.get('preserveDisplay') === '1';
	const horizonParam = url.searchParams.get('horizon');
	const forecastHorizon: 'today' | '3d' | '7d' | 'all' =
		horizonParam === 'today' || horizonParam === '3d' || horizonParam === '7d'
			? horizonParam
			: 'all';

	const [orders, salesProducts, preorderForecast, recipeSummaries] = await Promise.all([
		orderService.listOrders(activeBusiness.id),
		orderService.listSalesProducts(activeBusiness.id),
		orderService.getPreorderForecast(activeBusiness.id, preserveDisplayStock, forecastHorizon),
		recipeService.getAllRecipeSummaries(activeBusiness.id)
	]);

	const requestedTab = url.searchParams.get('tab');
	const initialTab: 'orders' | 'upcoming' | 'forecast' | 'loop' =
		requestedTab === 'upcoming' || requestedTab === 'forecast' || requestedTab === 'loop'
			? requestedTab
			: 'orders';

	return {
		user: locals.user,
		activeBusiness,
		businesses: memberships.map((m) => ({ ...m.business, role: m.role })),
		orders,
		salesProducts: salesProducts.filter((p) => p.isActive),
		allSalesProducts: salesProducts,
		preorderForecast,
		recipeSummaries,
		preserveDisplayStock,
		forecastHorizon,
		initialTab,
		openNewModalOnLoad: url.searchParams.get('new') === '1',
		createdOrderNumber: url.searchParams.get('created')
	};
};

export const actions: Actions = {
	...orderActions
};
