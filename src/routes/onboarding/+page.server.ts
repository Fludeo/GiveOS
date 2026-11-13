import { redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import { getServices } from '#lib/server/container';
import { createBusinessSchema } from '#lib/schemas/business.schema';
import * as onboardingActions from './_actions';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const { businessService } = getServices();
	const memberships = await businessService.listUserBusinesses(locals.user.id);

	if (memberships.length > 0) {
		throw redirect(302, '/');
	}

	const form = await superValidate(zod4(createBusinessSchema));

	return {
		user: locals.user,
		form
	};
};

export const actions: Actions = {
	...onboardingActions
};
