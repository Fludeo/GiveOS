import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { ForecastHorizon } from '#lib/features/orders/domain/order.entity';
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

	const { itemService, orderService, recipeService } = getServices();

	const preserveDisplayStock = url.searchParams.get('preserveDisplay') === '1';
	const horizonParam = url.searchParams.get('horizon');
	const validHorizons: ForecastHorizon[] = [
		'today',
		'1d',
		'2d',
		'3d',
		'4d',
		'5d',
		'6d',
		'7d',
		'all'
	];
	const forecastHorizon: ForecastHorizon = validHorizons.includes(horizonParam as ForecastHorizon)
		? (horizonParam as ForecastHorizon)
		: 'all';

	const [items, orders, salesProducts, preorderForecast, recipeSummaries] = await Promise.all([
		itemService.listItems(activeBusiness.id),
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
		items,
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
