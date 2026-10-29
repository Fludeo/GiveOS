import { json, type RequestHandler } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'No autorizado' }, { status: 401 });
	}

	const body = await request.json().catch(() => ({}));
	const { businessId, phone, channel = 'whatsapp' } = body;

	if (!businessId || !phone) {
		return json({ error: 'businessId y phone son requeridos' }, { status: 400 });
	}

	await resolveBusinessOrRedirect(locals.user.id, businessId);

	const { chatService } = getServices();
	await chatService.clearChatHistory(businessId, phone, channel);

	return json({ success: true });
};
