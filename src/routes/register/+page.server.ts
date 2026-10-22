import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as registerActions from './_actions';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(302, '/');
	}
	return {};
};

export const actions: Actions = {
	...registerActions
};
