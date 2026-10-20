import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getServices } from '#lib/server/container';

async function resolveBusinessOrRedirect(userId: string, requestedBusinessId?: string | null) {
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

export const actions: Actions = {
	updateBusiness: async ({ request, locals, url }) => {
		if (!locals.user) throw redirect(302, '/login');
		const formData = await request.formData();
		const businessIdParam =
			String(formData.get('businessId') ?? '') || url.searchParams.get('business');
		const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

		const name = String(formData.get('name') ?? '').trim();
		const description = String(formData.get('description') ?? '').trim();
		const whatsapp = String(formData.get('whatsapp') ?? '').trim();
		const openingHours = String(formData.get('openingHours') ?? '').trim();

		const { businessService } = getServices();
		try {
			await businessService.updateBusinessForUser(locals.user.id, activeBusiness.id, {
				name,
				description,
				whatsapp,
				openingHours
			});
			return {
				success: true,
				message: 'Los datos y horarios del negocio se actualizaron correctamente.'
			};
		} catch (e) {
			return fail(400, {
				error: e instanceof Error ? e.message : 'No se pudo actualizar la configuración.'
			});
		}
	}
};
