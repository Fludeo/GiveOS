import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';

export async function toggleShortcutAction({ request, locals, url }: RequestEvent) {
	if (!locals.user) throw redirect(302, '/login');
	const formData = await request.formData();
	const businessIdParam =
		String(formData.get('businessId') ?? '') || url.searchParams.get('business');
	const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

	const { orderService } = getServices();
	const productId = String(formData.get('productId') ?? '');

	try {
		const updated = await orderService.toggleSalesProductShortcut(productId, activeBusiness.id);
		return {
			success: true,
			message: updated.isShortcut
				? `"${updated.name}" agregado a atajos rápidos.`
				: `"${updated.name}" removido de atajos rápidos.`
		};
	} catch (e) {
		return fail(400, {
			error: e instanceof Error ? e.message : 'Error al actualizar atajo.'
		});
	}
}
