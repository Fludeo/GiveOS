import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getServices } from '#lib/server/container';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const { businessService } = getServices();
	const memberships = await businessService.listUserBusinesses(locals.user.id);

	// Si ya tiene negocio configurado, redirigir al panel principal
	if (memberships.length > 0) {
		throw redirect(302, '/');
	}

	return {
		user: locals.user
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const { businessService } = getServices();
		const formData = await request.formData();

		const name = String(formData.get('name') ?? '').trim();
		const description = String(formData.get('description') ?? '').trim();
		const whatsapp = String(formData.get('whatsapp') ?? '').trim();
		const openingHours = String(formData.get('openingHours') ?? '').trim();

		let createdMembership;
		try {
			createdMembership = await businessService.createBusinessForUser({
				userId: locals.user.id,
				name,
				description,
				whatsapp,
				openingHours
			});
		} catch (e) {
			return fail(400, {
				name,
				description,
				whatsapp,
				openingHours,
				error: e instanceof Error ? e.message : 'No se pudo registrar el negocio.'
			});
		}

		throw redirect(302, `/?business=${createdMembership.business.id}`);
	}
};
