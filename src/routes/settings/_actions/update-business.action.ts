import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';

export async function updateBusinessAction({ request, locals, url }: RequestEvent) {
	if (!locals.user) throw redirect(302, '/login');
	const formData = await request.formData();
	const businessIdParam =
		String(formData.get('businessId') ?? '') || url.searchParams.get('business');
	const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

	const name = String(formData.get('name') ?? '').trim();
	const description = String(formData.get('description') ?? '').trim();
	const whatsapp = String(formData.get('whatsapp') ?? '').trim();
	const openingHours = String(formData.get('openingHours') ?? '').trim();

	const { businessService } = getServices();
	try {
		await businessService.updateBusinessForUser(locals.user.id, activeBusiness.id, {
			name,
			description,
			whatsapp,
			openingHours
		});
		return {
			success: true,
			message: 'Los datos y horarios del negocio se actualizaron correctamente.'
		};
	} catch (e) {
		return fail(400, {
			error: e instanceof Error ? e.message : 'No se pudo actualizar la configuración.'
		});
	}
}
