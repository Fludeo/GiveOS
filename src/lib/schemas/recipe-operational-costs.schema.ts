import { z } from 'zod';

export const recipeOperationalCostItemSchema = z.object({
	id: z.string().optional(),
	resourceId: z.string().optional(),
	name: z.string().min(1, 'El nombre del recurso es requerido'),
	type: z.enum(['active', 'passive']),
	durationMinutes: z.number().min(0, 'La duración no puede ser negativa'),
	ratePerHour: z.number().min(0, 'La tarifa por hora no puede ser negativa'),
	isScalable: z.boolean().default(false),
	notes: z.string().optional().nullable()
});

export const saveRecipeOperationalCostsSchema = z.object({
	businessId: z.string().optional(),
	itemId: z.string().min(1, 'El ítem de la receta es requerido'),
	costs: z.array(recipeOperationalCostItemSchema).default([])
});

export type SaveRecipeOperationalCostsSchema = typeof saveRecipeOperationalCostsSchema;
