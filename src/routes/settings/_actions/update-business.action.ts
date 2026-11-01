import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import { updateBusinessSchema } from '$lib/schemas/business.schema';

export async function updateBusinessAction({ request, locals, url }: RequestEvent) {
	if (!locals.user) throw redirect(302, '/login');

	const form = await superValidate(request, zod4(updateBusinessSchema));
	if (!form.valid) {
		return fail(400, { form });
	}

	const businessIdParam =
		form.data.businessId || url.searchParams.get('business');
	const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

	const { businessService } = getServices();
	try {
		await businessService.updateBusinessForUser(locals.user.id, activeBusiness.id, {
			name: form.data.name.trim(),
			description: form.data.description?.trim() ?? '',
			whatsapp: form.data.whatsapp?.trim() ?? '',
			openingHours: form.data.openingHours?.trim() ?? '',
			settings: form.data.settings ?? activeBusiness.settings ?? {}
		});
		return {
			form,
			success: true,
			message: 'Los datos y horarios del negocio se actualizaron correctamente.'
		};
	} catch (e) {
		return fail(400, {
			form,
			error: e instanceof Error ? e.message : 'No se pudo actualizar la configuración.'
		});
	}
}
