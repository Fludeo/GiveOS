import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import { getDb } from '#lib/server/db/index';
import { salesProducts } from '#lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { DEFAULT_BOT_PROMPT } from '#lib/features/ai/domain/bot-prompt.constants';

export const load: PageServerLoad = async ({ url, locals }) => {
	// Seguridad: solo disponible en entorno de desarrollo local o con variable habilitadora
	const isEnabled = process.env.NODE_ENV !== 'production' || process.env.ENABLE_CHAT_TEST === 'true';
	if (!isEnabled) {
		throw error(404, 'Ruta de prueba de chat no disponible');
	}

	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const requestedBusinessId = url.searchParams.get('business');
	const { memberships, activeBusiness } = await resolveBusinessOrRedirect(
		locals.user.id,
		requestedBusinessId
	);

	const db = getDb();
	const products = await db.query.salesProducts.findMany({
		where: and(
			eq(salesProducts.businessId, activeBusiness.id),
			eq(salesProducts.isActive, true)
		)
	});

	const initialPrompt =
		activeBusiness.settings?.integrations?.bot?.systemPrompt || DEFAULT_BOT_PROMPT;

	return {
		user: locals.user,
		activeBusiness,
		businesses: memberships.map((m) => ({ ...m.business, role: m.role })),
		initialPrompt,
		productsCount: products.length,
		products
	};
};
