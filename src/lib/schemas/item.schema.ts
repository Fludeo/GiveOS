import { z } from 'zod';
import { ITEM_TYPES, UNITS_OF_MEASURE } from '#lib/features/items/domain/item.entity';

export const createItemSchema = z.object({
	businessId: z.string().optional(),
	name: z.string().min(1, 'El nombre del ítem es requerido'),
	type: z.enum(ITEM_TYPES as unknown as [string, ...string[]]),
	baseUnit: z.enum(UNITS_OF_MEASURE as unknown as [string, ...string[]]),
	referenceCost: z.number().min(0, 'El costo no puede ser negativo').default(0),
	purchaseQuantity: z.number().min(0.0001, 'La cantidad de compra debe ser mayor a 0').default(1),
	yieldQuantity: z.number().min(0.0001, 'El rendimiento debe ser mayor a 0').default(1),
	currentStock: z.number().min(0, 'El stock no puede ser negativo').default(0),
	minStock: z.number().min(0, 'El stock mínimo no puede ser negativo').default(0),
	prepTimeMinutes: z.number().min(0).default(0),
	passiveTimeMinutes: z.number().min(0).default(0),
	isPrepTimeScalable: z.boolean().default(false),
	notes: z.string().optional().nullable()
});

export const updateItemSchema = z.object({
	businessId: z.string().optional(),
	id: z.string().min(1, 'El ID del ítem es requerido'),
	name: z.string().min(1, 'El nombre del ítem es requerido'),
	type: z.enum(ITEM_TYPES as unknown as [string, ...string[]]).optional(),
	baseUnit: z.enum(UNITS_OF_MEASURE as unknown as [string, ...string[]]).optional(),
	referenceCost: z.number().min(0, 'El costo no puede ser negativo').default(0),
	purchaseQuantity: z.number().min(0.0001, 'La cantidad de compra debe ser mayor a 0').default(1),
	yieldQuantity: z.number().min(0.0001, 'El rendimiento debe ser mayor a 0').default(1),
	minStock: z.number().min(0, 'El stock mínimo no puede ser negativo').default(0),
	prepTimeMinutes: z.number().min(0).default(0),
	passiveTimeMinutes: z.number().min(0).default(0),
	isPrepTimeScalable: z.boolean().default(false),
	isMakeToOrder: z.boolean().default(false),
	notes: z.string().optional().nullable()
});

export type CreateItemSchema = typeof createItemSchema;
export type UpdateItemSchema = typeof updateItemSchema;
