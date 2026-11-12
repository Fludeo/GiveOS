import { z } from 'zod';

export const operationalCostResourceSchema = z.object({
	id: z.string(),
	name: z.string().min(1, 'El nombre del recurso es requerido'),
	type: z.enum(['active', 'passive']),
	ratePerHour: z.number().min(0, 'La tarifa por hora no puede ser negativa')
});

export const createBusinessSchema = z.object({
	name: z.string().min(2, 'El nombre comercial debe tener al menos 2 caracteres'),
	description: z.string().min(1, 'La descripción del negocio es obligatoria'),
	whatsapp: z.string().min(1, 'El número de WhatsApp es obligatorio'),
	openingHours: z.string().min(1, 'Los horarios de atención son obligatorios')
});

export const updateBusinessSchema = z.object({
	businessId: z.string().optional(),
	name: z.string().min(2, 'El nombre comercial debe tener al menos 2 caracteres'),
	description: z.string().optional().default(''),
	whatsapp: z.string().optional().default(''),
	openingHours: z.string().optional().default(''),
	settings: z.record(z.string(), z.any()).optional()
});

export type CreateBusinessSchema = typeof createBusinessSchema;
export type UpdateBusinessSchema = typeof updateBusinessSchema;
