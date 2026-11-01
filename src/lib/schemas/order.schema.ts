import { z } from 'zod';
import { PAYMENT_STATUSES } from '#lib/features/orders/domain/order.entity';

export const createOrderLineSchema = z.object({
	salesProductId: z.string().min(1, 'El producto es requerido'),
	quantity: z.number().min(0.001, 'La cantidad debe ser mayor a 0'),
	unitPrice: z.number().min(0, 'El precio no puede ser negativo'),
	notes: z.string().optional().nullable(),
	fulfillmentType: z.enum(['immediate', 'preorder']),
	deliveryDate: z.string().optional().nullable()
});

export const createOrderSchema = z.object({
	businessId: z.string().optional(),
	customerName: z.string().default('Cliente Mostrador'),
	paymentStatus: z.enum(PAYMENT_STATUSES as unknown as [string, ...string[]]).default('paid'),
	paidAmount: z.number().min(0, 'El monto pagado no puede ser negativo').default(0),
	deliveryDate: z.string().optional().nullable(),
	notes: z.string().optional().nullable(),
	transactionId: z.string().optional().nullable(),
	status: z.enum(['unconfirmed', 'confirmed', 'in_preparation', 'ready', 'delivered', 'cancelled']).optional().nullable(),
	lines: z.array(createOrderLineSchema).min(1, 'Debes agregar al menos un producto a la orden')
});

export const updatePaymentSchema = z.object({
	businessId: z.string().optional(),
	orderId: z.string().min(1, 'El ID de la orden es requerido'),
	paidAmount: z.number().min(0, 'El monto pagado no puede ser negativo').default(0),
	paymentStatus: z.enum(PAYMENT_STATUSES as unknown as [string, ...string[]]).optional(),
	transactionId: z.string().optional().nullable()
});

export type CreateOrderSchema = typeof createOrderSchema;
export type CreateOrderLineSchema = typeof createOrderLineSchema;
export type UpdatePaymentSchema = typeof updatePaymentSchema;
