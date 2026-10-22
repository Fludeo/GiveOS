import { redirect } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';

export async function resolveBusinessOrRedirect(
	userId: string,
	requestedBusinessId?: string | null
) {
	const { businessService } = getServices();
	const memberships = await businessService.listUserBusinesses(userId);
	if (memberships.length === 0) {
		throw redirect(302, '/onboarding');
	}
	const activeBusiness =
		(requestedBusinessId
			? memberships.find((m) => m.business.id === requestedBusinessId)?.business
			: null) ?? memberships[0].business;

	return {
		memberships,
		activeBusiness
	};
}
