import { z } from 'zod';
import { UNITS_OF_MEASURE } from '#lib/features/items/domain/item.entity';

export const addRecipeLineSchema = z
	.object({
		businessId: z.string().optional().describe('ID del negocio'),
		parentItemId: z
			.string()
			.min(1, 'El producto o elaboración padre es requerido')
			.describe('ID, código o referencia temporal del ítem elaborado ("prepared") al que pertenece la receta'),
		componentItemId: z
			.string()
			.min(1, 'El ingrediente es requerido')
			.describe('ID, código o referencia temporal del insumo o sub-receta utilizado como ingrediente'),
		quantity: z
			.number()
			.min(0.0001, 'La cantidad debe ser mayor a 0')
			.describe('Cantidad del ingrediente necesaria para producir el rendimiento base (yieldQuantity) de la receta'),
		unit: z
			.enum(UNITS_OF_MEASURE)
			.describe('Unidad de medida en la que se expresa la cantidad del ingrediente en la receta ("g", "kg", "ml", "l", "unit")'),
		notes: z
			.string()
			.optional()
			.nullable()
			.describe('Observaciones sobre cómo incorporar el ingrediente (ej: tamizada, a temperatura ambiente)')
	})
	.describe('Esquema para vincular un ingrediente/componente a una receta (Elaboración)');

export type AddRecipeLineSchema = typeof addRecipeLineSchema;
