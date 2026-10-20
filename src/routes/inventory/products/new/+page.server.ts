import { fail, redirect } from '@sveltejs/kit';
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

	return {
		user: locals.user,
		activeBusiness,
		businesses: memberships.map((m) => ({ ...m.business, role: m.role })),
		items,
		recipeSummaries,
		existingCodes: salesProducts.map((p) => p.code)
	};
};

export const actions: Actions = {
	createSalesProduct: async ({ request, locals, url }) => {
		if (!locals.user) throw redirect(302, '/login');
		const formData = await request.formData();
		const businessIdParam =
			String(formData.get('businessId') ?? '') || url.searchParams.get('business');
		const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

		const { orderService } = getServices();
		const code = String(formData.get('code') ?? '').trim().toUpperCase() || undefined;
		const name = String(formData.get('name') ?? '').trim();
		const componentsJson = String(formData.get('componentsJson') ?? '[]');
		const pricingTiersJson = String(formData.get('pricingTiersJson') ?? '[]');
		const salePrice = Number(formData.get('salePrice') ?? 0);
		const description = String(formData.get('description') ?? '').trim() || null;
		const isShortcut = formData.get('isShortcut') === 'true';

		try {
			const components = JSON.parse(componentsJson) as Array<{
				itemId: string;
				quantity: number;
			}>;
			const pricingTiers = JSON.parse(pricingTiersJson) as PriceTier[];

			const created = await orderService.createSalesProduct({
				businessId: activeBusiness.id,
				code,
				name,
				components,
				pricingTiers,
				salePrice: Number.isFinite(salePrice) && salePrice >= 0 ? salePrice : 0,
				description,
				isActive: true,
				isShortcut
			});

			throw redirect(
				303,
				`/inventory?tab=products&createdProduct=${encodeURIComponent(created.name)}`
			);
		} catch (e) {
			if (e && typeof e === 'object' && 'status' in e && (e as { status: number }).status === 303) {
				throw e;
			}
			return fail(400, {
				error: e instanceof Error ? e.message : 'Error al crear el producto de venta.'
			});
		}
	}
};
