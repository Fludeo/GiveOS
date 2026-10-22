import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';

export async function quickRestockAction({ request, locals, url }: RequestEvent) {
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
