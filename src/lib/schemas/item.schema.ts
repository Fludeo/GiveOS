import { z } from 'zod';
import { ITEM_TYPES, UNITS_OF_MEASURE } from '#lib/features/items/domain/item.entity';

export const createItemSchema = z
	.object({
		businessId: z.string().optional().describe('ID del negocio (se resuelve automáticamente en sesión)'),
		name: z
			.string()
			.min(1, 'El nombre del ítem es requerido')
			.describe('Nombre del insumo o elaboración (ej: Harina 0000, Bizcochuelo de Vainilla)'),
		type: z
			.enum(ITEM_TYPES as unknown as [string, ...string[]])
			.describe('Tipo de ítem: "raw_material" para materia prima/insumo comprable, o "prepared" para elaboración con receta'),
		baseUnit: z
			.enum(UNITS_OF_MEASURE as unknown as [string, ...string[]])
			.describe('Unidad de medida base del inventario: "g" (gramos), "kg" (kilogramos), "ml" (mililitros), "l" (litros), "unit" (unidades)'),
		referenceCost: z
			.number()
			.min(0, 'El costo no puede ser negativo')
			.default(0)
			.describe('Costo de compra de referencia para materias primas (correspondiente a purchaseQuantity)'),
		purchaseQuantity: z
			.number()
			.min(0.0001, 'La cantidad de compra debe ser mayor a 0')
			.default(1)
			.describe('Cantidad de compra a la que corresponde el referenceCost (ej: 1 si el costo es por 1 kg, o 1000 si baseUnit es g y el costo es por 1000 g)'),
		yieldQuantity: z
			.number()
			.min(0.0001, 'El rendimiento debe ser mayor a 0')
			.default(1)
			.describe('Rendimiento base cuando es una elaboración ("prepared"): cuántas unidades base rinde una tanda de la receta'),
		currentStock: z
			.number()
			.min(0, 'El stock no puede ser negativo')
			.default(0)
			.describe('Stock disponible inicial expresado en baseUnit'),
		minStock: z
			.number()
			.min(0, 'El stock mínimo no puede ser negativo')
			.default(0)
			.describe('Stock mínimo de alerta expresado en baseUnit'),
		prepTimeMinutes: z
			.number()
			.min(0)
			.default(0)
			.describe('Minutos de trabajo activo de preparación (para elaboraciones)'),
		passiveTimeMinutes: z
			.number()
			.min(0)
			.default(0)
			.describe('Minutos de tiempo pasivo como horneado, reposo o frío (para elaboraciones)'),
		isPrepTimeScalable: z
			.boolean()
			.default(false)
			.describe('Indica si el tiempo de preparación escala linealmente por cada unidad producida'),
		notes: z
			.string()
			.optional()
			.nullable()
			.describe('Notas adicionales, marca sugerida o instrucciones de preparación')
	})
	.describe('Esquema para crear un ítem de inventario (Insumo o Elaboración)');

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
