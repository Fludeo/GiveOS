import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getServices } from '#lib/server/container';
import type { PriceTier } from '#lib/features/orders/domain/order.entity';

async function resolveBusinessOrRedirect(userId: string, requestedBusinessId?: string | null) {
	const { businessService } = getServices();
	const memberships = await businessService.listUserBusinesses(userId);
	if (memberships.length === 0) {
		throw redirect(302, '/onboarding');
	}
	const activeBusiness =
		(requestedBusinessId
			? memberships.find((m) => m.business.id === requestedBusinessId)?.business
			: null) ?? memberships[0].business;

	return {
		memberships,
		activeBusiness
	};
}

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

	return {
		user: locals.user,
		activeBusiness,
		businesses: memberships.map((m) => ({ ...m.business, role: m.role })),
		items,
		recipeSummaries,
		product
	};
};

export const actions: Actions = {
	updateSalesProduct: async ({ params, request, locals, url }) => {
		if (!locals.user) throw redirect(302, '/login');
		const formData = await request.formData();
		const businessIdParam =
			String(formData.get('businessId') ?? '') || url.searchParams.get('business');
		const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

		const { orderService } = getServices();
		const name = String(formData.get('name') ?? '').trim();
		const componentsJson = String(formData.get('componentsJson') ?? '[]');
		const pricingTiersJson = String(formData.get('pricingTiersJson') ?? '[]');
		const salePrice = Number(formData.get('salePrice') ?? 0);
		const description = String(formData.get('description') ?? '').trim() || null;
		const isActive = formData.get('isActive') === 'true';
		const isShortcut = formData.get('isShortcut') === 'true';

		try {
			const components = JSON.parse(componentsJson) as Array<{
				itemId: string;
				quantity: number;
			}>;
			const pricingTiers = JSON.parse(pricingTiersJson) as PriceTier[];

			const updated = await orderService.updateSalesProduct(params.id, activeBusiness.id, {
				name,
				components,
				pricingTiers,
				salePrice: Number.isFinite(salePrice) && salePrice >= 0 ? salePrice : 0,
				description,
				isActive,
				isShortcut
			});

			throw redirect(
				303,
				`/inventory?tab=products&updatedProduct=${encodeURIComponent(updated.name)}`
			);
		} catch (e) {
			if (e && typeof e === 'object' && 'status' in e && (e as { status: number }).status === 303) {
				throw e;
			}
			return fail(400, {
				error: e instanceof Error ? e.message : 'Error al actualizar el producto de venta.'
			});
		}
	}
};
