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

	const [items, recipeSummaries, salesProducts] = await Promise.all([
		itemService.listItems(activeBusiness.id),
		recipeService.getAllRecipeSummaries(activeBusiness.id),
		orderService.listSalesProducts(activeBusiness.id)
	]);

	const selectedParam = url.searchParams.get('item');
	const defaultItem =
		items.find((i) => i.id === selectedParam) ??
		items.find((i) => i.type === 'finished_product') ??
		items.find((i) => i.type === 'sub_assembly') ??
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
				message: `Ítem "${created.name}" (${created.code}) registrado en inventario.`,
				createdItemId: created.id
			};
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Error al registrar el ítem.' });
		}
	},

	updateItem: async ({ request, locals, url }) => {
		if (!locals.user) throw redirect(302, '/login');
		const formData = await request.formData();
		const businessIdParam =
			String(formData.get('businessId') ?? '') || url.searchParams.get('business');
		const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

		const { itemService } = getServices();
		const id = String(formData.get('id') ?? '');
		const name = String(formData.get('name') ?? '').trim();
		const type = String(formData.get('type') ?? 'raw_material') as ItemType;
		const baseUnit = String(formData.get('baseUnit') ?? 'g') as UnitOfMeasure;
		const referenceCost = Number(formData.get('referenceCost') ?? 0);
		const purchaseQuantity = Number(formData.get('purchaseQuantity') ?? 1);
		const yieldQuantity = Number(formData.get('yieldQuantity') ?? 1);
		const notes = String(formData.get('notes') ?? '').trim() || null;

		try {
			const updated = await itemService.updateItem(id, activeBusiness.id, {
				name,
				type,
				baseUnit,
				referenceCost: Number.isFinite(referenceCost) ? referenceCost : 0,
				purchaseQuantity:
					Number.isFinite(purchaseQuantity) && purchaseQuantity > 0 ? purchaseQuantity : 1,
				yieldQuantity: Number.isFinite(yieldQuantity) && yieldQuantity > 0 ? yieldQuantity : 1,
				notes
			});
			return {
				success: true,
				message: `Ficha técnica de "${updated.name}" (${updated.code}) actualizada.`
			};
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Error al actualizar el ítem.' });
		}
	},

	updateStockAndCost: async ({ request, locals, url }) => {
		if (!locals.user) throw redirect(302, '/login');
		const formData = await request.formData();
		const businessIdParam =
			String(formData.get('businessId') ?? '') || url.searchParams.get('business');
		const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

		const { itemService, recipeService } = getServices();
		const id = String(formData.get('id') ?? '');
		const currentStock = Number(formData.get('currentStock') ?? 0);
		const minStock = Number(formData.get('minStock') ?? 0);
		const referenceCost = Number(formData.get('referenceCost') ?? 0);
		const purchaseQuantity = Number(formData.get('purchaseQuantity') ?? 1);

		try {
			const existing = await itemService.getItemById(id, activeBusiness.id);
			if (!existing) {
				return fail(404, { error: 'Ítem no encontrado.' });
			}

			const targetStock = Number.isFinite(currentStock) && currentStock >= 0 ? currentStock : 0;
			const stockDelta = targetStock - existing.currentStock;

			// Si es un sub-ensamble o producto final y se incrementa su stock, descontar proporcionalmente sus ingredientes de la receta
			if (existing.type !== 'raw_material' && stockDelta > 0) {
				await recipeService.produceItemBatch(activeBusiness.id, id, stockDelta);
			}

			const updated = await itemService.updateItem(id, activeBusiness.id, {
				currentStock: targetStock,
				minStock: Number.isFinite(minStock) && minStock >= 0 ? minStock : 0,
				referenceCost: Number.isFinite(referenceCost) && referenceCost >= 0 ? referenceCost : 0,
				purchaseQuantity:
					Number.isFinite(purchaseQuantity) && purchaseQuantity > 0 ? purchaseQuantity : 1
			});
			return {
				success: true,
				message:
					existing.type !== 'raw_material' && stockDelta > 0
						? `Stock de "${updated.name}" incrementado (+${stockDelta} ${updated.baseUnit}) e ingredientes de su receta descontados.`
						: `Existencias y costos de "${updated.name}" (${updated.code}) actualizados.`
			};
		} catch (e) {
			return fail(400, {
				error: e instanceof Error ? e.message : 'Error al actualizar el inventario.'
			});
		}
	},

	deleteItem: async ({ request, locals, url }) => {
		if (!locals.user) throw redirect(302, '/login');
		const formData = await request.formData();
		const businessIdParam =
			String(formData.get('businessId') ?? '') || url.searchParams.get('business');
		const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

		const { itemService } = getServices();
		const id = String(formData.get('id') ?? '');
		try {
			await itemService.deleteItem(id, activeBusiness.id);
			return { success: true, message: 'Ítem eliminado del inventario.' };
		} catch {
			return fail(400, {
				error:
					'No se puede eliminar este ítem porque está vinculado a una receta o a un producto de venta.'
			});
		}
	},

	addRecipeLine: async ({ request, locals, url }) => {
		if (!locals.user) throw redirect(302, '/login');
		const formData = await request.formData();
		const businessIdParam =
			String(formData.get('businessId') ?? '') || url.searchParams.get('business');
		const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

		const { recipeService } = getServices();
		const parentItemId = String(formData.get('parentItemId') ?? '');
		const componentItemId = String(formData.get('componentItemId') ?? '');
		const quantity = Number(formData.get('quantity') ?? 0);
		const unit = String(formData.get('unit') ?? 'g') as UnitOfMeasure;
		const notes = String(formData.get('notes') ?? '').trim() || null;

		try {
			await recipeService.addLine(activeBusiness.id, {
				parentItemId,
				componentItemId,
				quantity,
				unit,
				notes
			});
			return { success: true, message: 'Ingrediente agregado a la receta correctamente.' };
		} catch (e) {
			return fail(400, {
				error: e instanceof Error ? e.message : 'Error al agregar línea a la receta.'
			});
		}
	},

	updateRecipeYield: async ({ request, locals, url }) => {
		if (!locals.user) throw redirect(302, '/login');
		const formData = await request.formData();
		const businessIdParam =
			String(formData.get('businessId') ?? '') || url.searchParams.get('business');
		const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

		const { itemService } = getServices();
		const id = String(formData.get('id') ?? '');
		const yieldQuantity = Number(formData.get('yieldQuantity') ?? 1);

		if (!Number.isFinite(yieldQuantity) || yieldQuantity <= 0) {
			return fail(400, { error: 'El rendimiento del lote debe ser un número mayor a 0.' });
		}

		try {
			const updated = await itemService.updateItem(id, activeBusiness.id, {
				yieldQuantity
			});
			return {
				success: true,
				message: `Rendimiento de la receta para "${updated.name}" actualizado a ${yieldQuantity} ${updated.baseUnit}.`
			};
		} catch (e) {
			return fail(400, {
				error: e instanceof Error ? e.message : 'Error al actualizar el rendimiento de la receta.'
			});
		}
	},

	removeRecipeLine: async ({ request, locals, url }) => {
		if (!locals.user) throw redirect(302, '/login');
		const formData = await request.formData();
		const businessIdParam =
			String(formData.get('businessId') ?? '') || url.searchParams.get('business');
		const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

		const { recipeService } = getServices();
		const lineId = String(formData.get('lineId') ?? '');

		try {
			await recipeService.removeLine(activeBusiness.id, lineId);
			return { success: true, message: 'Ingrediente quitado de la receta.' };
		} catch (e) {
			return fail(400, {
				error: e instanceof Error ? e.message : 'Error al eliminar línea de la receta.'
			});
		}
	},

	createSalesProduct: async ({ request, locals, url }) => {
		if (!locals.user) throw redirect(302, '/login');
		const formData = await request.formData();
		const businessIdParam =
			String(formData.get('businessId') ?? '') || url.searchParams.get('business');
		const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

		const { orderService } = getServices();
		const name = String(formData.get('name') ?? '').trim();
		const componentsJson = String(formData.get('componentsJson') ?? '[]');
		const salePrice = Number(formData.get('salePrice') ?? 0);
		const description = String(formData.get('description') ?? '').trim() || null;
		const isShortcut = formData.get('isShortcut') === 'true';

		try {
			const components = JSON.parse(componentsJson) as Array<{
				itemId: string;
				quantity: number;
			}>;
			const created = await orderService.createSalesProduct({
				businessId: activeBusiness.id,
				name,
				components,
				salePrice: Number.isFinite(salePrice) && salePrice >= 0 ? salePrice : 0,
				description,
				isActive: true,
				isShortcut
			});
			return {
				success: true,
				message: `Producto para venta "${created.name}" (${created.code}) creado correctamente.`
			};
		} catch (e) {
			return fail(400, {
				error: e instanceof Error ? e.message : 'Error al crear el producto de venta.'
			});
		}
	},

	updateSalesProduct: async ({ request, locals, url }) => {
		if (!locals.user) throw redirect(302, '/login');
		const formData = await request.formData();
		const businessIdParam =
			String(formData.get('businessId') ?? '') || url.searchParams.get('business');
		const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

		const { orderService } = getServices();
		const id = String(formData.get('id') ?? '');
		const name = String(formData.get('name') ?? '').trim();
		const componentsJson = String(formData.get('componentsJson') ?? '[]');
		const salePrice = Number(formData.get('salePrice') ?? 0);
		const description = String(formData.get('description') ?? '').trim() || null;
		const isActive = formData.get('isActive') === 'true';
		const isShortcut = formData.has('isShortcut') ? formData.get('isShortcut') === 'true' : undefined;

		try {
			const components = JSON.parse(componentsJson) as Array<{
				itemId: string;
				quantity: number;
			}>;
			const updated = await orderService.updateSalesProduct(id, activeBusiness.id, {
				name,
				components,
				salePrice: Number.isFinite(salePrice) && salePrice >= 0 ? salePrice : 0,
				description,
				isActive,
				isShortcut
			});
			return {
				success: true,
				message: `Producto de venta "${updated.name}" (${updated.code}) actualizado.`
			};
		} catch (e) {
			return fail(400, {
				error: e instanceof Error ? e.message : 'Error al actualizar el producto de venta.'
			});
		}
	},

	deleteSalesProduct: async ({ request, locals, url }) => {
		if (!locals.user) throw redirect(302, '/login');
		const formData = await request.formData();
		const businessIdParam =
			String(formData.get('businessId') ?? '') || url.searchParams.get('business');
		const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

		const { orderService } = getServices();
		const id = String(formData.get('id') ?? '');

		try {
			await orderService.deleteSalesProduct(id, activeBusiness.id);
			return { success: true, message: 'Producto de venta eliminado.' };
		} catch {
			return fail(400, {
				error: 'No se puede eliminar este producto de venta porque tiene órdenes registradas.'
			});
		}
	},

	toggleSalesProductShortcut: async ({ request, locals, url }) => {
		if (!locals.user) throw redirect(302, '/login');
		const formData = await request.formData();
		const businessIdParam =
			String(formData.get('businessId') ?? '') || url.searchParams.get('business');
		const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

		const { orderService } = getServices();
		const id = String(formData.get('id') ?? '');

		try {
			const updated = await orderService.toggleSalesProductShortcut(id, activeBusiness.id);
			return {
				success: true,
				message: updated.isShortcut
					? `"${updated.name}" marcado como atajo de venta rápida.`
					: `"${updated.name}" desmarcado de atajos rápidos.`
			};
		} catch (e) {
			return fail(400, {
				error: e instanceof Error ? e.message : 'Error al cambiar atajo rápido.'
			});
		}
	}
};
