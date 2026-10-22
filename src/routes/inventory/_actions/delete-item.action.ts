import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';

export async function deleteItemAction({ request, locals, url }: RequestEvent) {
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
}
