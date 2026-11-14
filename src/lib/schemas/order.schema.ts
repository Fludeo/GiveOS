import { z } from 'zod';
import { PAYMENT_STATUSES } from '#lib/features/orders/domain/order.entity';

export const createOrderLineSchema = z
	.object({
		salesProductId: z
			.string()
			.min(1, 'El producto es requerido')
			.describe('ID, código o nombre del producto de venta del catálogo comercial'),
		quantity: z
			.number()
			.min(0.001, 'La cantidad debe ser mayor a 0')
			.describe('Cantidad de unidades solicitadas por el cliente'),
		unitPrice: z
			.number()
			.min(0, 'El precio no puede ser negativo')
			.describe('Precio unitario acordado (si se omite en borrador, se toma el salePrice del catálogo)'),
		notes: z
			.string()
			.optional()
			.nullable()
			.describe('Notas o personalización de esta línea del pedido (ej: dedicatoria, sin azúcar)'),
		fulfillmentType: z
			.enum(['immediate', 'preorder'])
			.describe('Modalidad de entrega: "immediate" (retiro inmediato de stock) o "preorder" (encargo a producir para fecha de entrega)'),
		deliveryDate: z
			.string()
			.optional()
			.nullable()
			.describe('Fecha/hora de entrega si es encargo (ISO 8601 o YYYY-MM-DD HH:mm)')
	})
	.describe('Línea de producto dentro de un pedido');

export const createOrderSchema = z
	.object({
		businessId: z.string().optional().describe('ID del negocio'),
		customerName: z
			.string()
			.default('Cliente Mostrador')
			.describe('Nombre del cliente que realiza el pedido'),
		paymentStatus: z
			.enum(PAYMENT_STATUSES as unknown as [string, ...string[]])
			.default('paid')
			.describe('Estado del pago: "pending" (pendiente), "partially_paid" (señado/parcial), "paid" (pagado total)'),
		paidAmount: z
			.number()
			.min(0, 'El monto pagado no puede ser negativo')
			.default(0)
			.describe('Monto abonado o seña entregada por el cliente'),
		deliveryDate: z
			.string()
			.optional()
			.nullable()
			.describe('Fecha y hora pactada de entrega o retiro (ej: 2026-11-20 17:00)'),
		notes: z
			.string()
			.optional()
			.nullable()
			.describe('Observaciones generales del pedido, dirección de envío o teléfono de contacto'),
		transactionId: z
			.string()
			.optional()
			.nullable()
			.describe('Comprobante o referencia de transferencia/pago'),
		status: z
			.enum(['unconfirmed', 'confirmed', 'in_preparation', 'ready', 'delivered', 'cancelled'])
			.optional()
			.nullable()
			.describe('Estado operativo del pedido'),
		lines: z
			.array(createOrderLineSchema)
			.min(1, 'Debes agregar al menos un producto a la orden')
			.describe('Lista de productos solicitados en el pedido')
	})
	.describe('Esquema para crear un Pedido / Orden de cliente');

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
