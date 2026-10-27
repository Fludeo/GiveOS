import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import { getServices } from '#lib/server/container';
import { DEFAULT_BOT_CONFIG, type BotSettingsConfig } from '#lib/features/ai/domain/bot-config.entity';
import * as settingsActions from './_actions';

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
		botSettings
	};
};

export const actions: Actions = {
	...settingsActions
};
