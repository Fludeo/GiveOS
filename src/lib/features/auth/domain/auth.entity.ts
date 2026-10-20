export interface AuthUser {
	id: string;
	name: string;
	email: string;
	image?: string | null;
}

export interface AuthSession {
	id: string;
	userId: string;
	expiresAt: Date;
}

export interface SignInEmailInput {
	email: string;
	password: string;
}

export interface SignUpEmailInput {
	name: string;
	email: string;
	password: string;
}
