import { json, type RequestHandler } from '@sveltejs/kit';
import { getAssistantChatService } from '#lib/features/mcp/application/assistant-chat.service';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'No autorizado' }, { status: 401 });
	}

	const body = await request.json().catch(() => ({}));
	const { businessId, messageText, chatHistory = [], sessionId = null } = body;

	if (!businessId || !messageText?.trim()) {
		return json({ error: 'businessId y messageText son requeridos' }, { status: 400 });
	}

	await resolveBusinessOrRedirect(locals.user.id, businessId);

	const chatService = getAssistantChatService();
	const startTime = Date.now();

	try {
		const output = await chatService.processMessage({
			businessId,
			sessionId,
			messageText: messageText.trim(),
			chatHistory
		});

		const durationMs = Date.now() - startTime;

		return json({
			success: true,
			output,
			durationMs
		});
	} catch (err: any) {
		console.error('[API Assistant Chat] Error procesando mensaje:', err);
		return json(
			{
				error: err?.message || 'Error procesando mensaje con el asistente'
			},
			{ status: 500 }
		);
	}
};
