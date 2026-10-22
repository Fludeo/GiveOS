import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getServices } from '#lib/server/container';
import * as onboardingActions from './_actions';

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
	...onboardingActions
};
