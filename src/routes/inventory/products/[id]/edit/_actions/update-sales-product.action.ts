import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import { updateSalesProductSchema } from '$lib/schemas/sales-product.schema';

export async function updateSalesProductAction({ params, request, locals, url }: RequestEvent) {
	if (!locals.user) throw redirect(302, '/login');

	const form = await superValidate(request, zod4(updateSalesProductSchema));
	if (!form.valid) {
		return fail(400, { form });
	}

	const businessIdParam =
		form.data.businessId || url.searchParams.get('business');
	const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

	const { orderService } = getServices();

	try {
		const updated = await orderService.updateSalesProduct(params.id!, activeBusiness.id, {
			name: form.data.name.trim(),
			components: form.data.components,
			pricingTiers: form.data.pricingTiers,
			salePrice: form.data.salePrice,
			description: form.data.description?.trim() || null,
			isActive: form.data.isActive,
			isShortcut: form.data.isShortcut
		});

		throw redirect(
			303,
			`/inventory?tab=products&updatedProduct=${encodeURIComponent(updated.name)}`
		);
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e && (e as { status: number }).status === 303) {
			throw e;
		}
		return fail(400, {
			form,
			error: e instanceof Error ? e.message : 'Error al actualizar el producto de venta.'
		});
	}
}
