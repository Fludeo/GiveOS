import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: { description: 'The database connection string.' },
	BETTER_AUTH_SECRET: { description: 'Secret key for Better Auth.' },
	ORIGIN: { description: 'Base origin URL for Better Auth.' }
});
