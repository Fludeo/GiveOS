import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import { getServices } from '#lib/server/container';
import { DEFAULT_BOT_PROMPT } from '#lib/features/ai/domain/bot-prompt.constants';
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

	const botSettings = {
		enabled: activeBusiness.settings?.integrations?.bot?.enabled ?? false,
		systemPrompt: activeBusiness.settings?.integrations?.bot?.systemPrompt || DEFAULT_BOT_PROMPT
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
