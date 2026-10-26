import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';

export const load: PageServerLoad = async ({ url, locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const requestedBusinessId = url.searchParams.get('business');
	const { memberships, activeBusiness } = await resolveBusinessOrRedirect(
		locals.user.id,
		requestedBusinessId
	);

	return {
		user: locals.user,
		activeBusiness,
		businesses: memberships.map((m) => ({ ...m.business, role: m.role }))
	};
};
