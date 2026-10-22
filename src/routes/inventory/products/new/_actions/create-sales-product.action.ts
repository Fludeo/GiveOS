import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import type { PriceTier } from '#lib/features/orders/domain/order.entity';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';

export async function createSalesProductAction({ request, locals, url }: RequestEvent) {
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
