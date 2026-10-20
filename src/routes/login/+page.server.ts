import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getServices } from '#lib/server/container';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(302, '/');
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request }) => {
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
};
