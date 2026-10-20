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
};
