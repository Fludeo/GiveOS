import { json, type RequestHandler } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'No autorizado' }, { status: 401 });
	}

	const body = await request.json().catch(() => ({}));
	const businessId = body.businessId;
	const forceNew = Boolean(body.forceNew);

	if (!businessId) {
		return json({ error: 'businessId requerido' }, { status: 400 });
	}

	await resolveBusinessOrRedirect(locals.user.id, businessId);

	const { whatsAppSessionManager } = getServices();

	if (forceNew) {
		await whatsAppSessionManager.disconnect(businessId, true);
	}

	whatsAppSessionManager.connect(businessId).catch((err) => {
		console.error('[API WhatsApp Connect] Error:', err);
	});

	const info = whatsAppSessionManager.getSessionInfo(businessId);
	return json({ success: true, status: info.status, qr: info.qr });
};
