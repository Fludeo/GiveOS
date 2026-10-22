import { redirect, type RequestEvent } from '@sveltejs/kit';
import { getServices } from '#lib/server/container';

export async function signOutAction({ request }: RequestEvent) {
	const { authService } = getServices();
	await authService.signOut(request.headers);
	throw redirect(302, '/login');
}
