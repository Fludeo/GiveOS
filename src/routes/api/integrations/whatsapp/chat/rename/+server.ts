import { json, type RequestHandler } from '@sveltejs/kit';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import { DatabaseChatRepository } from '#lib/features/integrations/whatsapp/infrastructure/database-chat-repository';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'No autorizado' }, { status: 401 });
	}

	const body = await request.json().catch(() => ({}));
	const { businessId, phone, name } = body;

	if (!businessId || !phone || !name?.trim()) {
		return json({ error: 'businessId, phone y name son requeridos' }, { status: 400 });
	}

	await resolveBusinessOrRedirect(locals.user.id, businessId);

	try {
		await DatabaseChatRepository.updateContactName(businessId, phone, name.trim());
		return json({ success: true, name: name.trim() });
	} catch (e: any) {
		console.error('[API WhatsApp Rename] Error:', e);
		return json({ error: e.message || 'Error al actualizar nombre' }, { status: 500 });
	}
};
