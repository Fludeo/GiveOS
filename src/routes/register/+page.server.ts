import { redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import { registerSchema } from '#lib/schemas/auth.schema';
import * as registerActions from './_actions';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(302, '/');
	}
	const form = await superValidate(zod4(registerSchema));
	return { form };
};

export const actions: Actions = {
	...registerActions
};
