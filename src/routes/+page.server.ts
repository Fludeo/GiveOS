import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as rootActions from './_actions';

export const load: PageServerLoad = async ({ url, locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const selectedItem = url.searchParams.get('item');
	if (selectedItem) {
		throw redirect(302, `/inventory?tab=recipes&item=${encodeURIComponent(selectedItem)}`);
	}

	throw redirect(302, '/dashboard');
};

export const actions: Actions = {
	...rootActions
};
