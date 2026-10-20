import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import type { AppDb } from '#lib/server/db/index';
import * as schema from '#lib/server/db/schema';
import type {
	AuthSession,
	AuthUser,
	SignInEmailInput,
	SignUpEmailInput
} from '../domain/auth.entity';
import type { IAuthRepository } from '../domain/auth.repository';

export function createBetterAuthInstance(db: AppDb) {
	const origin = process.env.ORIGIN || process.env.BETTER_AUTH_URL || 'http://localhost:5173';
	const secret =
		process.env.BETTER_AUTH_SECRET ||
		'cakes-super-secret-key-for-local-development-2026';

	return betterAuth({
		baseURL: origin,
		secret: secret,
		database: drizzleAdapter(db as any, {
			provider: 'pg',
			schema: {
				user: schema.user,
				session: schema.session,
				account: schema.account,
				verification: schema.verification
			}
		}),
		emailAndPassword: {
			enabled: true
		},
		plugins: [sveltekitCookies(getRequestEvent)]
	});
}

export type BetterAuthInstance = ReturnType<typeof createBetterAuthInstance>;

export class BetterAuthRepository implements IAuthRepository {
	constructor(private readonly auth: BetterAuthInstance) {}

	async getSession(headers: Headers): Promise<{ user: AuthUser; session: AuthSession } | null> {
		const res = await this.auth.api.getSession({ headers });
		if (!res) return null;
		return {
			user: {
				id: res.user.id,
				name: res.user.name,
				email: res.user.email,
				image: res.user.image
			},
			session: {
				id: res.session.id,
				userId: res.session.userId,
				expiresAt: new Date(res.session.expiresAt)
			}
		};
	}

	async signInWithEmail(
		input: SignInEmailInput,
		headers: Headers
	): Promise<{ user: AuthUser }> {
		const res = await this.auth.api.signInEmail({
			body: {
				email: input.email,
				password: input.password
			},
			headers
		});

		return {
			user: {
				id: res.user.id,
				name: res.user.name,
				email: res.user.email,
				image: res.user.image
			}
		};
	}

	async signUpWithEmail(
		input: SignUpEmailInput,
		headers: Headers
	): Promise<{ user: AuthUser }> {
		const res = await this.auth.api.signUpEmail({
			body: {
				name: input.name,
				email: input.email,
				password: input.password
			},
			headers
		});

		return {
			user: {
				id: res.user.id,
				name: res.user.name,
				email: res.user.email,
				image: res.user.image
			}
		};
	}

	async signOut(headers: Headers): Promise<void> {
		await this.auth.api.signOut({ headers });
	}
}
