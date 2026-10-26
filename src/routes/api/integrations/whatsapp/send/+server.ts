import { json, type RequestHandler } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'No autorizado' }, { status: 401 });
	}

	const body = await request.json().catch(() => ({}));
	const { businessId, to, text } = body;

	if (!businessId || !to || !text?.trim()) {
		return json({ error: 'businessId, to y text son requeridos' }, { status: 400 });
	}

	await resolveBusinessOrRedirect(locals.user.id, businessId);

	const { whatsAppSessionManager } = getServices();
	try {
		const sentMessage = await whatsAppSessionManager.sendMessage(businessId, to, text.trim());
		return json({ success: true, message: sentMessage });
	} catch (e: any) {
		console.error('[API WhatsApp Send] Error:', e);
		return json({ error: e.message || 'Error al enviar mensaje' }, { status: 500 });
	}
};
