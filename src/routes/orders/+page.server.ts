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

	const { orderService } = getServices();

	const [orders, salesProducts] = await Promise.all([
		orderService.listOrders(activeBusiness.id),
		orderService.listSalesProducts(activeBusiness.id)
	]);

	return {
		user: locals.user,
		activeBusiness,
		businesses: memberships.map((m) => ({ ...m.business, role: m.role })),
		orders,
		salesProducts: salesProducts.filter((p) => p.isActive),
		openNewModalOnLoad: url.searchParams.get('new') === '1',
		createdOrderNumber: url.searchParams.get('created')
	};
};

export const actions: Actions = {
	...orderActions
};
