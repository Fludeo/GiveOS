import type {
	AuthSession,
	AuthUser,
	SignInEmailInput,
	SignUpEmailInput
} from '../domain/auth.entity';
import type { IAuthRepository } from '../domain/auth.repository';

export class AuthService {
	constructor(private readonly authRepo: IAuthRepository) {}

	async getSession(headers: Headers): Promise<{ user: AuthUser; session: AuthSession } | null> {
		return this.authRepo.getSession(headers);
	}

	async signIn(input: SignInEmailInput, headers: Headers): Promise<{ user: AuthUser }> {
		const email = input.email.trim().toLowerCase();
		if (!email || !input.password) {
			throw new Error('Debes ingresar correo electrónico y contraseña.');
		}
		return this.authRepo.signInWithEmail(
			{
				email,
				password: input.password
			},
			headers
		);
	}

	async signUp(input: SignUpEmailInput, headers: Headers): Promise<{ user: AuthUser }> {
		const name = input.name.trim();
		const email = input.email.trim().toLowerCase();

		if (!name) {
			throw new Error('El nombre es obligatorio.');
		}
		if (!email) {
			throw new Error('El correo electrónico es obligatorio.');
		}
		if (!input.password || input.password.length < 8) {
			throw new Error('La contraseña debe tener al menos 8 caracteres.');
		}

		return this.authRepo.signUpWithEmail(
			{
				name,
				email,
				password: input.password
			},
			headers
		);
	}

	async signOut(headers: Headers): Promise<void> {
		await this.authRepo.signOut(headers);
	}
}
