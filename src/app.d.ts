import type { AuthSession, AuthUser } from '#lib/features/auth/domain/auth.entity';

declare global {
	namespace App {
		interface Locals {
			user: AuthUser | null;
			session: AuthSession | null;
		}
	}
}

export {};
