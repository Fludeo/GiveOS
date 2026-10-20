import type {
	AuthSession,
	AuthUser,
	SignInEmailInput,
	SignUpEmailInput
} from './auth.entity';

export interface IAuthRepository {
	getSession(headers: Headers): Promise<{ user: AuthUser; session: AuthSession } | null>;
	signInWithEmail(
		input: SignInEmailInput,
		headers: Headers
	): Promise<{ user: AuthUser }>;
	signUpWithEmail(
		input: SignUpEmailInput,
		headers: Headers
	): Promise<{ user: AuthUser }>;
	signOut(headers: Headers): Promise<void>;
}
