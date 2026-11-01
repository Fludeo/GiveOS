import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { getServices } from '#lib/server/container';
import { loginSchema } from '$lib/schemas/auth.schema';

export async function loginAction({ request }: RequestEvent) {
	const form = await superValidate(request, zod4(loginSchema));
	if (!form.valid) {
		return fail(400, { form });
	}

	const { authService } = getServices();
	try {
		await authService.signIn(
			{ email: form.data.email, password: form.data.password },
			request.headers
		);
	} catch (e) {
		return fail(400, {
			form,
			error:
				e instanceof Error && e.message
					? 'Credenciales inválidas. Verifica tu correo y contraseña.'
					: 'No se pudo iniciar sesión.'
		});
	}

	throw redirect(302, '/');
}
