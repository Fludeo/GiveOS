import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import { getServices } from '#lib/server/container';
import { getDb } from '#lib/server/db/index';
import { orders, orderItems } from '#lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { DatabaseChatRepository } from '#lib/features/integrations/whatsapp/infrastructure/database-chat-repository';
import { DEFAULT_BOT_CONFIG, type BotSettingsConfig } from '#lib/features/ai/domain/bot-config.entity';

export const load: PageServerLoad = async ({ url, locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const requestedBusinessId = url.searchParams.get('business');
	const { memberships, activeBusiness } = await resolveBusinessOrRedirect(
		locals.user.id,
		requestedBusinessId
	);

	const { whatsAppSessionManager } = getServices();
	const initialWhatsAppSession =
		typeof whatsAppSessionManager.getSessionInfoAsync === 'function'
			? await whatsAppSessionManager.getSessionInfoAsync(activeBusiness.id)
			: whatsAppSessionManager.getSessionInfo(activeBusiness.id);

	// Determinar si el negocio tiene credenciales guardadas en DB o configuración activa
	const hasConfiguredSession = !!(
		initialWhatsAppSession.phone ||
		activeBusiness.settings?.integrations?.whatsapp?.phone ||
		activeBusiness.settings?.integrations?.whatsapp?.status === 'connected'
	);

	// Cargar historial de mensajes persistidos desde PostgreSQL
	const dbMessages = await DatabaseChatRepository.getConversationsWithMessages(activeBusiness.id);
	if (dbMessages.length > 0) {
		initialWhatsAppSession.messages = dbMessages;
		if (typeof whatsAppSessionManager.syncHolderMessages === 'function') {
			whatsAppSessionManager.syncHolderMessages(activeBusiness.id, dbMessages);
		}
	}

	// Cargar pedidos no confirmados de este negocio junto con sus ítems
	const db = getDb();
	const rawUnconfirmedOrders = await db.query.orders.findMany({
		where: and(
			eq(orders.businessId, activeBusiness.id),
			eq(orders.status, 'unconfirmed')
		),
		orderBy: [desc(orders.createdAt)]
	});

	const unconfirmedOrders = await Promise.all(
		rawUnconfirmedOrders.map(async (ord) => {
			const items = await db.query.orderItems.findMany({
				where: eq(orderItems.orderId, ord.id)
			});
			return {
				...ord,
				items
			};
		})
	);

	// Configuración del bot
	const savedBot = activeBusiness.settings?.integrations?.bot || {};
	const botSettings: BotSettingsConfig = {
		...DEFAULT_BOT_CONFIG,
		...savedBot
	};

	return {
		user: locals.user,
		activeBusiness,
		businesses: memberships.map((m) => ({ ...m.business, role: m.role })),
		initialWhatsAppSession,
		hasConfiguredSession,
		unconfirmedOrders,
		botSettings
	};
};
