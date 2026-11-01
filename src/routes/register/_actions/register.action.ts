import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { getServices } from '#lib/server/container';
import { registerSchema } from '#lib/schemas/auth.schema';

export async function registerAction({ request }: RequestEvent) {
	const form = await superValidate(request, zod4(registerSchema));
	if (!form.valid) {
		return fail(400, { form });
	}

	const { authService } = getServices();
	try {
		await authService.signUp(
			{
				name: form.data.name.trim(),
				email: form.data.email.trim(),
				password: form.data.password
			},
			request.headers
		);
	} catch (e) {
		return fail(400, {
			form,
			error:
				e instanceof Error && e.message
					? e.message
					: 'No se pudo completar el registro. Verifica si el correo ya está registrado.'
		});
	}

	throw redirect(302, '/onboarding');
}
