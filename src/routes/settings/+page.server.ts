import { redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import { getServices } from '#lib/server/container';
import { DEFAULT_BOT_CONFIG, type BotSettingsConfig } from '#lib/features/ai/domain/bot-config.entity';
import { updateBusinessSchema } from '#lib/schemas/business.schema';
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
	const initialWhatsAppSession =
		typeof whatsAppSessionManager.getSessionInfoAsync === 'function'
			? await whatsAppSessionManager.getSessionInfoAsync(activeBusiness.id)
			: whatsAppSessionManager.getSessionInfo(activeBusiness.id);

	const savedBot = activeBusiness.settings?.integrations?.bot || {};
	const botSettings: BotSettingsConfig = {
		...DEFAULT_BOT_CONFIG,
		...savedBot
	};

	const form = await superValidate(
		{
			businessId: activeBusiness.id,
			name: activeBusiness.name,
			description: activeBusiness.description ?? '',
			whatsapp: activeBusiness.whatsapp ?? '',
			openingHours: activeBusiness.openingHours ?? '',
			settings: (activeBusiness.settings as Record<string, any>) ?? {}
		},
		zod4(updateBusinessSchema)
	);

	return {
		user: locals.user,
		activeBusiness,
		businesses: memberships.map((m) => ({ ...m.business, role: m.role })),
		initialWhatsAppSession,
		botSettings,
		form
	};
};

export const actions: Actions = {
	...settingsActions
};
