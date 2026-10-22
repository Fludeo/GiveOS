import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';

export async function createBusinessAction({ request, locals }: RequestEvent) {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const { businessService } = getServices();
	const formData = await request.formData();

	const name = String(formData.get('name') ?? '').trim();
	const description = String(formData.get('description') ?? '').trim();
	const whatsapp = String(formData.get('whatsapp') ?? '').trim();
	const openingHours = String(formData.get('openingHours') ?? '').trim();

	let createdMembership;
	try {
		createdMembership = await businessService.createBusinessForUser({
			userId: locals.user.id,
			name,
			description,
			whatsapp,
			openingHours
		});
	} catch (e) {
		return fail(400, {
			name,
			description,
			whatsapp,
			openingHours,
			error: e instanceof Error ? e.message : 'No se pudo registrar el negocio.'
		});
	}

	throw redirect(302, `/?business=${createdMembership.business.id}`);
}
