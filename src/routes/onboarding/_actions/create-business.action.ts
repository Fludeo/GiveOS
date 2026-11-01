import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { getServices } from '#lib/server/container';
import { createBusinessSchema } from '$lib/schemas/business.schema';

export async function createBusinessAction({ request, locals }: RequestEvent) {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const form = await superValidate(request, zod4(createBusinessSchema));
	if (!form.valid) {
		return fail(400, { form });
	}

	const { businessService } = getServices();

	let createdMembership;
	try {
		createdMembership = await businessService.createBusinessForUser({
			userId: locals.user.id,
			name: form.data.name.trim(),
			description: form.data.description?.trim() ?? '',
			whatsapp: form.data.whatsapp?.trim() ?? '',
			openingHours: form.data.openingHours?.trim() ?? ''
		});
	} catch (e) {
		return fail(400, {
			form,
			error: e instanceof Error ? e.message : 'No se pudo registrar el negocio.'
		});
	}

	throw redirect(302, `/?business=${createdMembership.business.id}`);
}
