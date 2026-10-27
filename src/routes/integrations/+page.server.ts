import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const business = url.searchParams.get('business');
	const target = business ? `/messages?business=${business}` : '/messages';
	throw redirect(301, target);
};
