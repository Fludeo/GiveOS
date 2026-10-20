import type { RequestEvent } from '@sveltejs/kit';
import { building } from '$app/env';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { getServices } from '#lib/server/container';
import { runMigrations } from '#lib/server/db/migrate';

export const init = async () => {
	if (!building) {
		await runMigrations();
	}
};

export const handle = async ({
	event,
	resolve
}: {
	event: RequestEvent;
	resolve: (event: RequestEvent) => Promise<Response>;
}) => {
	if (building) {
		return resolve(event);
	}

	const { authService, betterAuth } = getServices();
	const sessionData = await authService.getSession(event.request.headers);

	if (sessionData) {
		event.locals.user = sessionData.user;
		event.locals.session = sessionData.session;
	} else {
		event.locals.user = null;
		event.locals.session = null;
	}

	return svelteKitHandler({ event, resolve, auth: betterAuth, building });
};
