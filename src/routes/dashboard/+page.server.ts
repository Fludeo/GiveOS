import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getServices } from '#lib/server/container';
import {
	ITEM_TYPES,
	UNITS_OF_MEASURE,
	type ItemType,
	type UnitOfMeasure
} from '#lib/features/items/domain/item.entity';

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
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const requestedBusinessId = url.searchParams.get('business');
	const { memberships, activeBusiness } = await resolveBusinessOrRedirect(
		locals.user.id,
		requestedBusinessId
	);

	const { itemService, recipeService, orderService } = getServices();

	const [items, recipeSummaries, preorderForecast, salesProducts, orders] = await Promise.all([
		itemService.listItems(activeBusiness.id),
		recipeService.getAllRecipeSummaries(activeBusiness.id),
		orderService.getPreorderForecast(activeBusiness.id),
		orderService.listSalesProducts(activeBusiness.id),
		orderService.listOrders(activeBusiness.id)
	]);

	return {
		user: locals.user,
		activeBusiness,
		businesses: memberships.map((m) => ({ ...m.business, role: m.role })),
		items,
		recipeSummaries,
		preorderForecast,
		salesProducts: salesProducts.filter((p) => p.isActive),
		orders
	};
};

export const actions: Actions = {
	createItem: async ({ request, locals, url }) => {
		if (!locals.user) throw redirect(302, '/login');
		const formData = await request.formData();
		const businessIdParam =
			String(formData.get('businessId') ?? '') || url.searchParams.get('business');
		const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

		const { itemService } = getServices();
		const name = String(formData.get('name') ?? '').trim();
		const type = String(formData.get('type') ?? 'raw_material') as ItemType;
		const baseUnit = String(formData.get('baseUnit') ?? 'g') as UnitOfMeasure;
		const referenceCost = Number(formData.get('referenceCost') ?? 0);
		const purchaseQuantity = Number(formData.get('purchaseQuantity') ?? 1);
		const yieldQuantity = Number(formData.get('yieldQuantity') ?? 1);
		const currentStock = Number(formData.get('currentStock') ?? 0);
		const minStock = Number(formData.get('minStock') ?? 0);
		const notes = String(formData.get('notes') ?? '').trim() || null;

		if (!ITEM_TYPES.includes(type)) {
			return fail(400, { error: 'Tipo de ítem inválido.' });
		}
		if (!UNITS_OF_MEASURE.includes(baseUnit)) {
			return fail(400, { error: 'Unidad de medida inválida.' });
		}

		try {
			const created = await itemService.createItem({
				businessId: activeBusiness.id,
				name,
				type,
				baseUnit,
				referenceCost: Number.isFinite(referenceCost) ? referenceCost : 0,
				purchaseQuantity:
					Number.isFinite(purchaseQuantity) && purchaseQuantity > 0 ? purchaseQuantity : 1,
				yieldQuantity: Number.isFinite(yieldQuantity) && yieldQuantity > 0 ? yieldQuantity : 1,
				currentStock: Number.isFinite(currentStock) && currentStock >= 0 ? currentStock : 0,
				minStock: Number.isFinite(minStock) && minStock >= 0 ? minStock : 0,
				notes
			});
			return {
				success: true,
				message: `Ítem "${created.name}" (${created.code}) dado de alta correctamente.`
			};
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Error al dar de alta el ítem.' });
		}
	},

	quickRestock: async ({ request, locals, url }) => {
		if (!locals.user) throw redirect(302, '/login');
		const formData = await request.formData();
		const businessIdParam =
			String(formData.get('businessId') ?? '') || url.searchParams.get('business');
		const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

		const { itemService } = getServices();
		const id = String(formData.get('id') ?? '');
		const currentStock = Number(formData.get('currentStock') ?? 0);
		const minStock = Number(formData.get('minStock') ?? 0);

		try {
			const updated = await itemService.updateItem(id, activeBusiness.id, {
				currentStock: Number.isFinite(currentStock) && currentStock >= 0 ? currentStock : 0,
				minStock: Number.isFinite(minStock) && minStock >= 0 ? minStock : 0
			});
			return {
				success: true,
				message: `Stock de "${updated.name}" (${updated.code}) actualizado a ${updated.currentStock} ${updated.baseUnit}.`
			};
		} catch (e) {
			return fail(400, {
				error: e instanceof Error ? e.message : 'Error al actualizar el stock.'
			});
		}
	}
};
