import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getServices } from '#lib/server/container';

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
	signOut: async ({ request }) => {
		const { authService } = getServices();
		await authService.signOut(request.headers);
		throw redirect(302, '/login');
	}
};
