import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';

export async function loginAction({ request }: RequestEvent) {
	const { authService } = getServices();
	const formData = await request.formData();
	const email = String(formData.get('email') ?? '').trim();
	const password = String(formData.get('password') ?? '');

	try {
		await authService.signIn({ email, password }, request.headers);
	} catch (e) {
		return fail(400, {
			email,
			error:
				e instanceof Error && e.message
					? 'Credenciales inválidas. Verifica tu correo y contraseña.'
					: 'No se pudo iniciar sesión.'
		});
	}

	throw redirect(302, '/');
}
