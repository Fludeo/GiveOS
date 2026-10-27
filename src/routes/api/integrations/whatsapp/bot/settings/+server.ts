import { json, type RequestHandler } from '@sveltejs/kit';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import { getDb } from '#lib/server/db/index';
import { businesses } from '#lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'No autorizado' }, { status: 401 });
	}

	const body = await request.json().catch(() => ({}));
	const { businessId, enabled, systemPrompt } = body;

	if (!businessId) {
		return json({ error: 'businessId requerido' }, { status: 400 });
	}

	await resolveBusinessOrRedirect(locals.user.id, businessId);

	const db = getDb();
	const existing = await db.query.businesses.findFirst({
		where: eq(businesses.id, businessId)
	});

	if (!existing) {
		return json({ error: 'Negocio no encontrado' }, { status: 404 });
	}

	const currentSettings = existing.settings || {};
	const currentIntegrations = currentSettings.integrations || {};

	const updatedSettings = {
		...currentSettings,
		integrations: {
			...currentIntegrations,
			bot: {
				enabled: typeof enabled === 'boolean' ? enabled : false,
				systemPrompt: typeof systemPrompt === 'string' ? systemPrompt : undefined,
				updatedAt: new Date().toISOString()
			}
		}
	};

	await db
		.update(businesses)
		.set({ settings: updatedSettings })
		.where(eq(businesses.id, businessId));

	return json({
		success: true,
		botSettings: updatedSettings.integrations.bot
	});
};
