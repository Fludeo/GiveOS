import { json, error, type RequestHandler } from '@sveltejs/kit';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import { getEcommerceBotService } from '#lib/features/ai/application/ecommerce-bot.service';

export const POST: RequestHandler = async ({ request, locals }) => {
	// Solo disponible en ambiente local/desarrollo o si está explícitamente habilitado
	const isEnabled = process.env.NODE_ENV !== 'production' || process.env.ENABLE_CHAT_TEST === 'true';
	if (!isEnabled) {
		throw error(404, 'Ruta de prueba de chat no disponible en producción');
	}

	if (!locals.user) {
		return json({ error: 'No autorizado' }, { status: 401 });
	}

	const body = await request.json().catch(() => ({}));
	const { businessId, messageText, chatHistory = [], customSystemPrompt } = body;

	if (!businessId || !messageText?.trim()) {
		return json({ error: 'businessId y messageText son requeridos' }, { status: 400 });
	}

	await resolveBusinessOrRedirect(locals.user.id, businessId);

	const botService = getEcommerceBotService();
	const startTime = Date.now();

	try {
		const output = await botService.processMessage({
			businessId,
			customerPhone: 'test-local-simulator',
			customerName: 'Tester Local',
			messageText: messageText.trim(),
			chatHistory,
			customSystemPrompt
		});

		const durationMs = Date.now() - startTime;

		return json({
			success: true,
			output,
			durationMs
		});
	} catch (err: any) {
		console.error('[API Chat Test] Error ejecutando bot:', err);
		return json(
			{
				error: err.message || 'Error procesando mensaje con IA local'
			},
			{ status: 500 }
		);
	}
};
