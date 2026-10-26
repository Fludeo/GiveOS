import { json, type RequestHandler } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'No autorizado' }, { status: 401 });
	}

	const body = await request.json().catch(() => ({}));
	const businessId = body.businessId;
	const isLogout = Boolean(body.isLogout);

	if (!businessId) {
		return json({ error: 'businessId requerido' }, { status: 400 });
	}

	await resolveBusinessOrRedirect(locals.user.id, businessId);

	const { whatsAppSessionManager } = getServices();
	await whatsAppSessionManager.disconnect(businessId, isLogout);

	return json({ success: true });
};
