import { z } from 'zod';
import { ITEM_TYPES, UNITS_OF_MEASURE } from '#lib/features/items/domain/item.entity';
import { PAYMENT_STATUSES } from '#lib/features/orders/domain/order.entity';
import type { DraftAction, DraftEntityType, DraftFieldIssue } from './draft.entity';

/**
 * Schemas de Zod enriquecidos con .describe() para guiar automáticamente a los agentes (MCP / Chat)
 * sobre qué datos son obligatorios, qué valores aceptan y qué preguntas hacer al usuario cuando faltan.
 */

export const draftInlineIngredientSchema = z
	.object({
		componentRef: z
			.string()
			.min(1, 'Debes indicar el insumo o sub-receta componente')
			.describe(
				'ID, código (ej: INS-001), nombre o entryId en el borrador (ej: "harina") del ingrediente que lleva la receta'
			),
		quantity: z
			.number({ error: 'Falta definir la cantidad del ingrediente en la receta' })
			.positive('La cantidad del ingrediente debe ser mayor a 0')
			.describe('Cantidad necesaria de este ingrediente para producir una tanda (yieldQuantity) de la receta'),
		unit: z
			.enum(UNITS_OF_MEASURE, {
				error: 'Falta definir la unidad del ingrediente (g, kg, ml, l, unit)'
			})
			.describe('Unidad de medida del ingrediente en la receta: "g", "kg", "ml", "l" o "unit"')
	})
	.describe('Ingrediente que forma parte de una elaboración/receta');

export const draftItemCreateSchema = z
	.object({
		name: z
			.string({ error: 'Falta el nombre del ítem' })
			.min(1, 'El nombre del ítem es obligatorio')
			.describe('Nombre del insumo o elaboración (ej: "Harina 0000", "Bizcochuelo de Vainilla")'),
		type: z
			.enum(ITEM_TYPES, {
				error: 'Falta definir si es insumo ("raw_material") o elaboración ("prepared")'
			})
			.describe(
				'Tipo de ítem: "raw_material" para insumos comprados (harina, azúcar, huevos) o "prepared" para elaboraciones con receta'
			),
		baseUnit: z
			.enum(UNITS_OF_MEASURE, {
				error: 'Falta la unidad de medida base ("g", "kg", "ml", "l" o "unit")'
			})
			.describe(
				'Unidad de medida en la que se controla el stock de este ítem: "g" (gramos), "kg" (kilos), "ml" (mililitros), "l" (litros) o "unit" (unidades)'
			),
		referenceCost: z
			.number({ error: 'Falta el costo de compra de referencia' })
			.min(0, 'El costo de referencia no puede ser negativo')
			.optional()
			.describe(
				'Costo de compra de referencia (obligatorio para "raw_material", ej: cuánto cuesta comprar la cantidad indicada en purchaseQuantity). Preguntar al usuario si no lo especificó'
			),
		purchaseQuantity: z
			.number()
			.positive('La cantidad de compra debe ser mayor a 0')
			.default(1)
			.describe(
				'Cantidad en baseUnit a la que corresponde el referenceCost (ej: 1 si baseUnit es "kg" y el costo es por 1 kg; o 1000 si baseUnit es "g" y el costo es por 1000 g)'
			),
		yieldQuantity: z
			.number()
			.positive('El rendimiento de la receta debe ser mayor a 0')
			.default(1)
			.describe(
				'Rendimiento base cuando es una elaboración ("prepared"): cuántas unidades (en baseUnit) rinde la receta'
			),
		currentStock: z
			.number()
			.min(0, 'El stock inicial no puede ser negativo')
			.default(0)
			.describe('Stock disponible inicial expresado en baseUnit (por defecto 0 si no se indica)'),
		minStock: z
			.number()
			.min(0, 'El stock mínimo no puede ser negativo')
			.default(0)
			.describe('Stock mínimo de alerta en baseUnit'),
		prepTimeMinutes: z
			.number()
			.min(0)
			.default(0)
			.describe('Minutos de preparación activa (para elaboraciones)'),
		passiveTimeMinutes: z
			.number()
			.min(0)
			.default(0)
			.describe('Minutos de cocción/horneado o reposo pasivo (para elaboraciones)'),
		notes: z.string().optional().nullable().describe('Notas o instrucciones adicionales'),
		ingredients: z
			.array(draftInlineIngredientSchema)
			.optional()
			.describe(
				'Lista de ingredientes de la receta cuando type es "prepared". También pueden agregarse por separado como entradas "recipe_line"'
			)
	})
	.superRefine((val, ctx) => {
		if (val.type === 'raw_material' && (val.referenceCost === undefined || val.referenceCost === null)) {
			ctx.addIssue({
				code: 'custom',
				path: ['referenceCost'],
				message:
					'Para un insumo ("raw_material") es necesario definir el costo de compra de referencia (referenceCost). Pregúntale al usuario cuánto le cuesta.'
			});
		}
	})
	.describe('Esquema para crear un Insumo ("raw_material") o Elaboración ("prepared") en el inventario');

export const draftItemUpdateSchema = z
	.object({
		name: z.string().min(1).optional().describe('Nuevo nombre del ítem'),
		baseUnit: z.enum(UNITS_OF_MEASURE).optional().describe('Nueva unidad de medida base'),
		referenceCost: z.number().min(0).optional().describe('Nuevo costo de compra de referencia'),
		purchaseQuantity: z.number().positive().optional().describe('Nueva cantidad de referencia de compra'),
		yieldQuantity: z.number().positive().optional().describe('Nuevo rendimiento de la receta'),
		currentStock: z.number().min(0).optional().describe('Nuevo stock actual'),
		minStock: z.number().min(0).optional().describe('Nuevo stock mínimo de alerta'),
		prepTimeMinutes: z.number().min(0).optional().describe('Minutos de trabajo activo'),
		passiveTimeMinutes: z.number().min(0).optional().describe('Minutos de tiempo pasivo/horno'),
		notes: z.string().optional().nullable().describe('Notas actualizadas')
	})
	.describe('Esquema para actualizar campos de un ítem existente');

export const draftRecipeLineCreateSchema = z
	.object({
		parentRef: z
			.string({ error: 'Falta indicar la elaboración padre de la receta' })
			.min(1, 'La elaboración padre es obligatoria')
			.describe(
				'ID, código, nombre o entryId en el borrador del ítem elaborado ("prepared") al que pertenece esta línea de receta'
			),
		componentRef: z
			.string({ error: 'Falta indicar el ingrediente/componente' })
			.min(1, 'El ingrediente componente es obligatorio')
			.describe(
				'ID, código, nombre o entryId en el borrador del insumo ("raw_material") o sub-receta que se usa como ingrediente'
			),
		quantity: z
			.number({ error: 'Falta indicar la cantidad del ingrediente' })
			.positive('La cantidad debe ser mayor a 0')
			.describe('Cantidad del ingrediente que lleva la receta'),
		unit: z
			.enum(UNITS_OF_MEASURE, {
				error: 'Falta la unidad de medida del ingrediente ("g", "kg", "ml", "l", "unit")'
			})
			.describe('Unidad de medida de la cantidad en la receta (debe ser compatible con la unidad del insumo)'),
		notes: z.string().optional().nullable().describe('Notas de preparación para este ingrediente')
	})
	.describe('Esquema para agregar un ingrediente a una Elaboración / Receta');

export const draftRecipeLineUpdateSchema = z
	.object({
		quantity: z.number().positive().optional().describe('Nueva cantidad del ingrediente en la receta'),
		unit: z.enum(UNITS_OF_MEASURE).optional().describe('Nueva unidad de medida compatible'),
		notes: z.string().optional().nullable().describe('Nuevas notas del ingrediente')
	})
	.describe('Esquema para modificar una línea de receta existente');

export const draftSalesProductComponentSchema = z
	.object({
		itemRef: z
			.string({ error: 'Falta el ítem de inventario vinculado al producto de venta' })
			.min(1, 'Debes indicar el ítem de inventario')
			.describe(
				'ID, código, nombre o entryId en el borrador del ítem de inventario o elaboración que se entrega al vender este producto'
			),
		quantity: z
			.number({ error: 'Falta la cantidad del componente' })
			.positive('La cantidad debe ser mayor a 0')
			.default(1)
			.describe('Cantidad del ítem de inventario que consume 1 unidad de este producto comercial')
	})
	.describe('Vínculo entre el producto comercial del catálogo y el ítem de inventario/receta');

export const draftSalesProductCreateSchema = z
	.object({
		name: z
			.string({ error: 'Falta el nombre comercial del producto' })
			.min(1, 'El nombre comercial es obligatorio')
			.describe('Nombre comercial del producto en el catálogo de ventas'),
		salePrice: z
			.number({ error: 'Falta el precio de venta al público (salePrice)' })
			.min(0, 'El precio de venta no puede ser negativo')
			.describe('Precio de venta al público por unidad. Preguntar al usuario si no lo especificó'),
		description: z
			.string()
			.optional()
			.nullable()
			.describe('Descripción comercial para el catálogo y bot de atención'),
		isShortcut: z
			.boolean()
			.default(false)
			.describe('Si aparece como botón rápido en el mostrador de pedidos'),
		components: z
			.array(draftSalesProductComponentSchema, {
				error: 'Debes vincular al menos un ítem de inventario o receta al producto comercial'
			})
			.min(1, 'El producto comercial debe tener al menos un ítem de inventario vinculado')
			.describe('Lista de ítems/elaboraciones del inventario que componen este producto de venta')
	})
	.describe('Esquema para crear un Producto de Venta en el catálogo comercial');

export const draftSalesProductUpdateSchema = z
	.object({
		name: z.string().min(1).optional().describe('Nuevo nombre comercial'),
		salePrice: z.number().min(0).optional().describe('Nuevo precio de venta al público'),
		description: z.string().optional().nullable().describe('Nueva descripción comercial'),
		isActive: z.boolean().optional().describe('Si el producto está activo en el catálogo'),
		isShortcut: z.boolean().optional().describe('Si aparece en accesos rápidos'),
		components: z
			.array(draftSalesProductComponentSchema)
			.min(1)
			.optional()
			.describe('Nueva composición de ítems del producto comercial')
	})
	.describe('Esquema para actualizar un Producto de Venta existente');

export const draftOrderLineSchema = z
	.object({
		productRef: z
			.string({ error: 'Falta indicar qué producto del catálogo desea el cliente' })
			.min(1, 'El producto es obligatorio')
			.describe('ID, código (ej: PRD-001), nombre o entryId del producto comercial en el catálogo'),
		quantity: z
			.number({ error: 'Falta la cantidad solicitada del producto' })
			.positive('La cantidad debe ser mayor a 0')
			.describe('Cantidad de unidades que pide el cliente'),
		unitPrice: z
			.number()
			.min(0)
			.optional()
			.describe('Precio unitario (opcional: si se omite, se toma automáticamente del catálogo al confirmar)'),
		fulfillmentType: z
			.enum(['immediate', 'preorder'])
			.default('preorder')
			.describe(
				'Modalidad de entrega: "immediate" (entrega en el momento descontando stock actual) o "preorder" (encargo / pedido programado)'
			),
		notes: z.string().optional().nullable().describe('Aclaraciones sobre este producto (ej: decoración, sabor)')
	})
	.describe('Producto solicitado dentro de un pedido');

export const draftOrderCreateSchema = z
	.object({
		customerName: z
			.string({ error: 'Falta el nombre del cliente para el pedido' })
			.min(1, 'El nombre del cliente es obligatorio')
			.describe('Nombre del cliente que realiza el pedido. Preguntar al cliente si aún no lo dijo'),
		lines: z
			.array(draftOrderLineSchema, {
				error: 'Falta agregar los productos que desea encargar el cliente'
			})
			.min(1, 'El pedido debe tener al menos un producto')
			.describe('Lista de productos y cantidades que componen el pedido'),
		deliveryDate: z
			.string()
			.optional()
			.nullable()
			.describe('Fecha y hora estimada de entrega o retiro (ej: "2026-11-20 16:00"). Preguntar si es un encargo'),
		paymentStatus: z
			.enum(PAYMENT_STATUSES)
			.default('pending')
			.describe('Estado de pago inicial: "pending", "partially_paid" o "paid"'),
		paidAmount: z
			.number()
			.min(0)
			.default(0)
			.describe('Monto dejado como seña o pago inicial'),
		status: z
			.enum(['unconfirmed', 'pending'])
			.default('pending')
			.describe('Estado inicial del pedido al confirmarse'),
		notes: z
			.string()
			.optional()
			.nullable()
			.describe('Notas generales del pedido, teléfono o detalles de entrega')
	})
	.describe('Esquema para tomar un Pedido / Orden en borrador (por chat o asistente)');

export const draftOrderUpdateSchema = z
	.object({
		customerName: z.string().min(1).optional().describe('Nombre actualizado del cliente'),
		lines: z.array(draftOrderLineSchema).min(1).optional().describe('Líneas actualizadas del pedido'),
		deliveryDate: z.string().optional().nullable().describe('Nueva fecha de entrega'),
		paymentStatus: z.enum(PAYMENT_STATUSES).optional().describe('Nuevo estado de pago'),
		paidAmount: z.number().min(0).optional().describe('Nuevo monto abonado'),
		notes: z.string().optional().nullable().describe('Notas actualizadas')
	})
	.describe('Esquema para modificar un pedido existente');

export const draftDeleteSchema = z
	.object({
		reason: z.string().optional().describe('Motivo opcional de eliminación')
	})
	.describe('Esquema para eliminar una entidad existente (requiere targetId en la entrada del borrador)');

export function getDraftZodSchema(entityType: DraftEntityType, action: DraftAction): z.ZodTypeAny {
	if (action === 'delete') {
		return draftDeleteSchema;
	}
	switch (entityType) {
		case 'item':
			return action === 'create' ? draftItemCreateSchema : draftItemUpdateSchema;
		case 'recipe_line':
			return action === 'create' ? draftRecipeLineCreateSchema : draftRecipeLineUpdateSchema;
		case 'sales_product':
			return action === 'create' ? draftSalesProductCreateSchema : draftSalesProductUpdateSchema;
		case 'order':
			return action === 'create' ? draftOrderCreateSchema : draftOrderUpdateSchema;
	}
}

/**
 * Busca la descripción (.describe()) de un campo dentro del JSON Schema generado por Zod v4
 */
function lookupFieldDescription(jsonSchema: Record<string, any>, path: PropertyKey[]): string | undefined {
	let current: any = jsonSchema;
	for (const segment of path) {
		if (!current || typeof current !== 'object') return undefined;
		if (typeof segment === 'number') {
			current = current.items;
		} else if (current.properties && current.properties[String(segment)]) {
			current = current.properties[String(segment)];
		} else {
			return undefined;
		}
	}
	return typeof current?.description === 'string' ? current.description : undefined;
}

/**
 * Valida los datos parciales de una entrada del borrador contra su schema de Zod correspondiente,
 * e infiere automáticamente qué campos faltan o son inválidos junto con su explicación (.describe()).
 */
export function validateDraftEntryData(
	entityType: DraftEntityType,
	action: DraftAction,
	targetId: string | null | undefined,
	data: Record<string, any>
): {
	isValid: boolean;
	normalizedData: Record<string, any>;
	issues: DraftFieldIssue[];
} {
	const issues: DraftFieldIssue[] = [];

	if ((action === 'update' || action === 'delete') && !targetId?.trim()) {
		issues.push({
			field: 'targetId',
			message: `Para la acción "${action}" debes indicar el targetId (ID, código o nombre de la entidad existente en la base de datos).`,
			description: 'Identificador o código de la entidad existente que se desea modificar o eliminar'
		});
	}

	const schema = getDraftZodSchema(entityType, action);
	let jsonSchema: Record<string, any> = {};
	try {
		jsonSchema = z.toJSONSchema(schema) as Record<string, any>;
	} catch {
		jsonSchema = {};
	}

	const parsed = schema.safeParse(data ?? {});
	if (!parsed.success) {
		for (const issue of parsed.error.issues) {
			const fieldPath = issue.path.length > 0 ? issue.path.join('.') : 'root';
			const description = lookupFieldDescription(jsonSchema, issue.path);
			issues.push({
				field: fieldPath,
				message: issue.message,
				description
			});
		}
		return {
			isValid: false,
			normalizedData: data ?? {},
			issues
		};
	}

	return {
		isValid: issues.length === 0,
		normalizedData: (parsed.data as Record<string, any>) ?? data,
		issues
	};
}

/**
 * Devuelve el catálogo completo de JSON Schemas de todas las entidades que soporta el Borrador
 * para que cualquier agente (vía MCP o Chat) conozca los campos, tipos y descripciones.
 */
export function getAllDraftEntityJsonSchemas(): Record<
	DraftEntityType,
	{
		create: Record<string, any>;
		update: Record<string, any>;
	}
> {
	return {
		item: {
			create: z.toJSONSchema(draftItemCreateSchema) as Record<string, any>,
			update: z.toJSONSchema(draftItemUpdateSchema) as Record<string, any>
		},
		recipe_line: {
			create: z.toJSONSchema(draftRecipeLineCreateSchema) as Record<string, any>,
			update: z.toJSONSchema(draftRecipeLineUpdateSchema) as Record<string, any>
		},
		sales_product: {
			create: z.toJSONSchema(draftSalesProductCreateSchema) as Record<string, any>,
			update: z.toJSONSchema(draftSalesProductUpdateSchema) as Record<string, any>
		},
		order: {
			create: z.toJSONSchema(draftOrderCreateSchema) as Record<string, any>,
			update: z.toJSONSchema(draftOrderUpdateSchema) as Record<string, any>
		}
	};
}
