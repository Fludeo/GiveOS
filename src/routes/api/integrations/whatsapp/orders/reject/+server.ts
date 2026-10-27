import { json, type RequestHandler } from '@sveltejs/kit';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import { getServices } from '#lib/server/container';
import { getDb } from '#lib/server/db/index';
import { orders } from '#lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'No autorizado' }, { status: 401 });
	}

	const body = await request.json().catch(() => ({}));
	const { businessId, orderId, reason, sendWhatsApp = true } = body;

	if (!businessId || !orderId) {
		return json({ error: 'businessId y orderId son requeridos' }, { status: 400 });
	}

	await resolveBusinessOrRedirect(locals.user.id, businessId);

	const db = getDb();
	const order = await db.query.orders.findFirst({
		where: and(eq(orders.id, orderId), eq(orders.businessId, businessId))
	});

	if (!order) {
		return json({ error: 'Pedido no encontrado' }, { status: 404 });
	}

	// Actualizar pedido a cancelado
	await db
		.update(orders)
		.set({
			status: 'cancelled',
			notes: reason ? `${order.notes || ''} [Rechazado: ${reason}]`.trim() : order.notes,
			updatedAt: new Date()
		})
		.where(eq(orders.id, orderId));

	// Notificar al cliente por WhatsApp si hay un teléfono registrado
	const customerPhone = order.transactionId?.replace(/\D/g, '');
	if (customerPhone && sendWhatsApp) {
		const { whatsAppSessionManager } = getServices();
		const sessionInfo = whatsAppSessionManager.getSessionInfo(businessId);

		if (sessionInfo.status === 'connected') {
			const reasonText = reason ? ` Motivo: ${reason}.` : '';
			const msg = `¡Hola ${order.customerName}! Te informamos que tu pedido #${order.orderNumber} no pudo ser confirmado.${reasonText} Si deseas consultar alternativas o reprogramar tu pedido, escríbenos por aquí. ¡Muchas gracias!`;
			whatsAppSessionManager.sendMessage(businessId, customerPhone, msg).catch((err) => {
				console.error('[Reject Order] Error enviando WhatsApp al cliente:', err);
			});
		}
	}

	return json({
		success: true,
		orderId: order.id,
		orderNumber: order.orderNumber,
		status: 'cancelled'
	});
};
