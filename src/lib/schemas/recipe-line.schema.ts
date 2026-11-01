import { z } from 'zod';
import { UNITS_OF_MEASURE } from '#lib/features/items/domain/item.entity';

export const addRecipeLineSchema = z.object({
	businessId: z.string().optional(),
	parentItemId: z.string().min(1, 'El producto o elaboración padre es requerido'),
	componentItemId: z.string().min(1, 'El ingrediente es requerido'),
	quantity: z.number().min(0.0001, 'La cantidad debe ser mayor a 0'),
	unit: z.enum(UNITS_OF_MEASURE),
	notes: z.string().optional().nullable()
});

export type AddRecipeLineSchema = typeof addRecipeLineSchema;
