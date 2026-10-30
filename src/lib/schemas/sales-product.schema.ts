import { z } from 'zod';

export const salesProductComponentSchema = z.object({
	itemId: z.string().min(1, 'El item es requerido'),
	quantity: z.number().min(0.001, 'La cantidad debe ser mayor a 0')
});

export const priceTierSchema = z.object({
	minQuantity: z.number().min(2, 'La cantidad mínima es 2'),
	type: z.enum(['percentage', 'fixed_price']),
	value: z.number().min(0, 'El valor no puede ser negativo')
});

export const createSalesProductSchema = z.object({
	businessId: z.string().optional(),
	code: z.string().optional(),
	name: z.string().min(1, 'El nombre comercial es requerido'),
	description: z.string().optional().nullable(),
	salePrice: z.number().min(0, 'El precio no puede ser negativo'),
	isShortcut: z.boolean().default(false),
	components: z.array(salesProductComponentSchema),
	pricingTiers: z.array(priceTierSchema).default([])
});

export type CreateSalesProductSchema = typeof createSalesProductSchema;
