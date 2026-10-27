import { json, type RequestHandler } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'No autorizado' }, { status: 401 });
	}

	const body = await request.json().catch(() => ({}));
	const { businessId, messageKey, messageId, messageIds, phone } = body;

	if (!businessId || (!messageKey && !phone && !messageId && (!messageIds || messageIds.length === 0))) {
		return json(
			{ error: 'businessId y al menos uno de (phone, messageKey, messageId, messageIds) son requeridos' },
			{ status: 400 }
		);
	}

	await resolveBusinessOrRedirect(locals.user.id, businessId);

	const { whatsAppSessionManager } = getServices();

	if (phone || (messageIds && messageIds.length > 0)) {
		const ok = await whatsAppSessionManager.markSessionAsRead(businessId, phone || '', messageIds);
		return json({ success: ok });
	}

	const ok = await whatsAppSessionManager.markAsRead(businessId, messageKey, messageId);

	return json({ success: ok });
};
