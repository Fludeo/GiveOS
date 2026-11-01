import { z } from 'zod';

export const addStockBatchSchema = z.object({
	businessId: z.string().optional(),
	id: z.string().min(1, 'El ID del ítem es requerido'),
	quantity: z.number().min(0.0001, 'La cantidad debe ser mayor a 0'),
	totalCost: z.number().min(0, 'El costo no puede ser negativo').default(0),
	supplier: z.string().optional().nullable(),
	notes: z.string().optional().nullable()
});

export type AddStockBatchSchema = typeof addStockBatchSchema;
