import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from './resolve-business';

export async function deleteSalesProductAction({ request, locals, url }: RequestEvent) {
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
}
