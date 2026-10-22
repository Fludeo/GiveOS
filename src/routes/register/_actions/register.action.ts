import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';

export async function registerAction({ request }: RequestEvent) {
	const { authService } = getServices();
	const formData = await request.formData();
	const name = String(formData.get('name') ?? '').trim();
	const email = String(formData.get('email') ?? '').trim();
	const password = String(formData.get('password') ?? '');
	const confirmPassword = String(formData.get('confirmPassword') ?? '');

	if (password !== confirmPassword) {
		return fail(400, {
			name,
			email,
			error: 'Las contraseñas no coinciden.'
		});
	}

	try {
		await authService.signUp({ name, email, password }, request.headers);
	} catch (e) {
		return fail(400, {
			name,
			email,
			error:
				e instanceof Error && e.message
					? e.message
					: 'No se pudo completar el registro. Verifica si el correo ya está registrado.'
		});
	}

	throw redirect(302, '/onboarding');
}
