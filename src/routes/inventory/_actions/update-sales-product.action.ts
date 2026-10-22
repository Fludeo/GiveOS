import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from './resolve-business';

export async function updateSalesProductAction({ request, locals, url }: RequestEvent) {
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
}
