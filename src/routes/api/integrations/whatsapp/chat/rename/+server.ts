import { json, type RequestHandler } from '@sveltejs/kit';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import { getServices } from '#lib/server/container';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'No autorizado' }, { status: 401 });
	}

	const body = await request.json().catch(() => ({}));
	const { businessId, phone, name, channel } = body;

	if (!businessId || !phone || !name?.trim()) {
		return json({ error: 'businessId, phone y name son requeridos' }, { status: 400 });
	}

	await resolveBusinessOrRedirect(locals.user.id, businessId);

	const { chatService } = getServices();
	try {
		await chatService.updateContactName(businessId, phone, name.trim(), channel);
		return json({ success: true, name: name.trim() });
	} catch (e: any) {
		console.error('[API Chat Rename] Error:', e);
		return json({ error: e.message || 'Error al actualizar nombre' }, { status: 500 });
	}
};
