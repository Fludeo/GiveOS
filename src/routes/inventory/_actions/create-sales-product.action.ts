import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';

export async function createSalesProductAction({ request, locals, url }: RequestEvent) {
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
}
