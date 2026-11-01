import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import { createSalesProductSchema } from '#lib/schemas/sales-product.schema';

export async function createSalesProductAction({ request, locals, url }: RequestEvent) {
	if (!locals.user) throw redirect(302, '/login');

	const form = await superValidate(request, zod4(createSalesProductSchema));
	if (!form.valid) {
		return fail(400, { form });
	}

	const businessIdParam =
		form.data.businessId || url.searchParams.get('business');
	const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

	const { orderService } = getServices();

	try {
		const created = await orderService.createSalesProduct({
			businessId: activeBusiness.id,
			code: form.data.code?.trim().toUpperCase() || undefined,
			name: form.data.name.trim(),
			components: form.data.components,
			pricingTiers: form.data.pricingTiers,
			salePrice: form.data.salePrice,
			description: form.data.description?.trim() || null,
			isActive: true,
			isShortcut: form.data.isShortcut
		});

		throw redirect(
			303,
			`/inventory?tab=products&createdProduct=${encodeURIComponent(created.name)}`
		);
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e && (e as { status: number }).status === 303) {
			throw e;
		}
		return fail(400, {
			form,
			error: e instanceof Error ? e.message : 'Error al crear el producto de venta.'
		});
	}
}

