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
	const { businessId, orderId, paidAmount, sendWhatsApp = true, channel = 'whatsapp' } = body;

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

	const payment = typeof paidAmount === 'number' && paidAmount >= 0 ? paidAmount : order.totalAmount;
	const paymentStatus = payment >= order.totalAmount ? ('paid' as const) : ('partially_paid' as const);

	// Actualizar pedido a confirmado (status: 'pending' en el Loop Comercial) y registrar pago
	await db
		.update(orders)
		.set({
			status: 'pending',
			paymentStatus,
			paidAmount: payment,
			updatedAt: new Date()
		})
		.where(eq(orders.id, orderId));

	// Notificar al cliente por el canal de mensajería activo si hay un contacto registrado
	const customerContact = order.transactionId?.trim();
	if (customerContact && sendWhatsApp) {
		const { chatService } = getServices();
		const currency = '$';
		const msg = `¡Hola ${order.customerName}! 🎉 Confirmamos el pago de ${currency}${payment.toLocaleString('es-AR')} para tu pedido #${order.orderNumber}. Ya está agendado e ingresó al horno/producción. ¡Muchas gracias por tu compra! 🍰`;
		chatService.sendMessage(businessId, customerContact, msg, channel).catch((err) => {
			console.error('[Confirm Order] Error enviando notificación al cliente:', err);
		});
	}

	return json({
		success: true,
		order: {
			id: order.id,
			orderNumber: order.orderNumber,
			status: 'pending',
			paymentStatus,
			paidAmount: payment
		}
	});
};
