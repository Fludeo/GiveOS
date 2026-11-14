import { z } from 'zod';

export const salesProductComponentSchema = z
	.object({
		itemId: z
			.string()
			.min(1, 'El item es requerido')
			.describe('ID, código o referencia temporal del ítem de inventario (Insumo o Elaboración) que compone este producto de venta'),
		quantity: z
			.number()
			.min(0.001, 'La cantidad debe ser mayor a 0')
			.describe('Cantidad del ítem de inventario que se descuenta por cada unidad vendida de este producto comercial')
	})
	.describe('Componente de inventario vinculado al producto de venta');

export const priceTierSchema = z
	.object({
		minQuantity: z
			.number()
			.min(2, 'La cantidad mínima es 2')
			.describe('Cantidad mínima de unidades para activar el descuento o precio mayorista'),
		type: z
			.enum(['percentage', 'fixed_price'])
			.describe('Tipo de beneficio: "percentage" (porcentaje de descuento) o "fixed_price" (precio unitario fijo)'),
		value: z
			.number()
			.min(0, 'El valor no puede ser negativo')
			.describe('Valor del porcentaje de descuento o del precio unitario fijo')
	})
	.describe('Escala de precios por cantidad');

export const createSalesProductSchema = z
	.object({
		businessId: z.string().optional().describe('ID del negocio'),
		code: z.string().optional().describe('Código opcional del producto comercial (ej: PRD-001)'),
		name: z
			.string()
			.min(1, 'El nombre comercial es requerido')
			.describe('Nombre comercial visible para el cliente en el catálogo y pedidos'),
		description: z
			.string()
			.optional()
			.nullable()
			.describe('Descripción comercial del producto para clientes y bot de ventas'),
		salePrice: z
			.number()
			.min(0, 'El precio no puede ser negativo')
			.describe('Precio de venta al público por unidad'),
		isShortcut: z
			.boolean()
			.default(false)
			.describe('Si se muestra como acceso rápido en la pantalla de toma de pedidos'),
		components: z
			.array(salesProductComponentSchema)
			.min(1, 'Debe incluir al menos un componente')
			.describe('Lista de ítems de inventario o elaboraciones que componen este producto de venta'),
		pricingTiers: z
			.array(priceTierSchema)
			.default([])
			.describe('Escalas opcionales de descuento por cantidad')
	})
	.describe('Esquema para crear un Producto de Venta en el catálogo comercial');

export const updateSalesProductSchema = z.object({
	id: z.string().optional(),
	businessId: z.string().optional(),
	name: z.string().min(1, 'El nombre comercial es requerido'),
	description: z.string().optional().nullable(),
	salePrice: z.number().min(0, 'El precio no puede ser negativo'),
	isActive: z.boolean().default(true),
	isShortcut: z.boolean().default(false),
	components: z.array(salesProductComponentSchema).min(1, 'Debe incluir al menos un componente'),
	pricingTiers: z.array(priceTierSchema).default([])
});

export type CreateSalesProductSchema = typeof createSalesProductSchema;
export type UpdateSalesProductSchema = typeof updateSalesProductSchema;
