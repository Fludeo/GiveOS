import type { RequestHandler } from './$types';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import type { RealtimeEvent } from '#lib/features/integrations/whatsapp/domain/whatsapp.entity';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return new Response('No autorizado', { status: 401 });
	}

	const businessId = url.searchParams.get('businessId') || url.searchParams.get('business');
	if (!businessId) {
		return new Response('businessId requerido', { status: 400 });
	}

	// Verificar acceso del usuario a este negocio
	try {
		await resolveBusinessOrRedirect(locals.user.id, businessId);
	} catch (e) {
		return new Response('Acceso no autorizado al negocio', { status: 403 });
	}

	const { whatsAppSessionManager } = getServices();
	const sessionInfo = whatsAppSessionManager.getSessionInfo(businessId);

	let keepAliveTimer: NodeJS.Timeout | null = null;
	let unsubscribe: (() => void) | null = null;

	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();

			function sendEvent(event: RealtimeEvent) {
				const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
				controller.enqueue(encoder.encode(payload));
			}

			// 1. Emitir estado inicial actual
			sendEvent({
				type: 'whatsapp:status',
				businessId,
				status: sessionInfo.status,
				phone: sessionInfo.phone,
				pushName: sessionInfo.pushName
			});

			if (sessionInfo.qr) {
				sendEvent({
					type: 'whatsapp:qr',
					businessId,
					qr: sessionInfo.qr
				});
			}

			// 2. Suscribirse a eventos del manager
			unsubscribe = whatsAppSessionManager.subscribe(businessId, (event) => {
				sendEvent(event);
			});

			// 3. Keep-alive cada 25 segundos para mantener el canal abierto
			keepAliveTimer = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(': ping\n\n'));
				} catch (_) {}
			}, 25000);
		},
		cancel() {
			if (keepAliveTimer) clearInterval(keepAliveTimer);
			if (unsubscribe) unsubscribe();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream; charset=utf-8',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
