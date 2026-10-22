import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from './resolve-business';

export async function toggleSalesProductShortcutAction({ request, locals, url }: RequestEvent) {
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
