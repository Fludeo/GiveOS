import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { getServices } from '#lib/server/container';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import { createOrderSchema } from '#lib/schemas/order.schema';

export async function createOrderAction({ request, locals, url }: RequestEvent) {
	if (!locals.user) throw redirect(302, '/login');

	const form = await superValidate(request, zod4(createOrderSchema));
	if (!form.valid) {
		return fail(400, { form });
	}

	const businessIdParam =
		form.data.businessId || url.searchParams.get('business');
	const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessIdParam);

	const { orderService } = getServices();
	const customerName = form.data.customerName?.trim() || 'Cliente Mostrador';
	const paymentStatus = form.data.paymentStatus;
	const paidAmount = form.data.paidAmount;
	const notes = form.data.notes?.trim() || null;
	const transactionId = form.data.transactionId?.trim() || null;

	let deliveryDate: Date | null = null;
	if (form.data.deliveryDate) {
		const d = new Date(form.data.deliveryDate);
		if (!Number.isNaN(d.getTime())) {
			deliveryDate = d;
		}
	}

	const lines = form.data.lines.map((l) => {
		let lineDeliveryDate: Date | null = null;
		if (l.deliveryDate) {
			const parsed = new Date(l.deliveryDate);
			if (!Number.isNaN(parsed.getTime())) {
				lineDeliveryDate = parsed;
			}
		}
		return {
			salesProductId: l.salesProductId,
			quantity: l.quantity,
			unitPrice: l.unitPrice,
			notes: l.notes?.trim() || null,
			fulfillmentType: l.fulfillmentType,
			deliveryDate: lineDeliveryDate
		};
	});

	try {
		const created = await orderService.createOrder({
			businessId: activeBusiness.id,
			customerName,
			paymentStatus: paymentStatus as any,
			paidAmount: Number.isFinite(paidAmount) && paidAmount >= 0 ? paidAmount : 0,
			deliveryDate,
			notes,
			transactionId,
			lines
		});

		const immediateCount = created.items.filter(
			(i) => i.fulfillmentType === 'immediate'
		).length;
		const preorderCount = created.items.filter(
			(i) => i.fulfillmentType === 'preorder'
		).length;

		let successMsg = `Orden ${created.orderNumber} registrada (${created.customerName}).`;
		if (immediateCount > 0 && preorderCount > 0) {
			successMsg = `Orden mixta ${created.orderNumber} registrada (${immediateCount} en mostrador, ${preorderCount} por encargo).`;
		} else if (preorderCount > 0) {
			successMsg = `Orden por encargo ${created.orderNumber} registrada.`;
		}

		return {
			form,
			success: true,
			message: successMsg,
			createdOrderNumber: created.orderNumber
		};
	} catch (e) {
		return fail(400, {
			form,
			error: e instanceof Error ? e.message : 'Error al registrar la orden.'
		});
	}
}
