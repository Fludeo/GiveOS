import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import { getServices } from '#lib/server/container';
import { getDb } from '#lib/server/db/index';
import { orders } from '#lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { DatabaseChatRepository } from '#lib/features/integrations/whatsapp/infrastructure/database-chat-repository';
import { DEFAULT_BOT_PROMPT } from '#lib/features/ai/application/ecommerce-bot.service';

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
	const initialWhatsAppSession = whatsAppSessionManager.getSessionInfo(activeBusiness.id);

	// Cargar historial de mensajes persistidos desde PostgreSQL
	const dbMessages = await DatabaseChatRepository.getConversationsWithMessages(activeBusiness.id);
	if (dbMessages.length > 0) {
		initialWhatsAppSession.messages = dbMessages;
	}

	// Cargar pedidos no confirmados de este negocio
	const db = getDb();
	const unconfirmedOrders = await db.query.orders.findMany({
		where: and(
			eq(orders.businessId, activeBusiness.id),
			eq(orders.status, 'unconfirmed')
		),
		orderBy: [desc(orders.createdAt)]
	});

	// Configuración del bot
	const botSettings = {
		enabled: activeBusiness.settings?.integrations?.bot?.enabled ?? false,
		systemPrompt: activeBusiness.settings?.integrations?.bot?.systemPrompt || DEFAULT_BOT_PROMPT
	};

	return {
		user: locals.user,
		activeBusiness,
		businesses: memberships.map((m) => ({ ...m.business, role: m.role })),
		initialWhatsAppSession,
		unconfirmedOrders,
		botSettings
	};
};
