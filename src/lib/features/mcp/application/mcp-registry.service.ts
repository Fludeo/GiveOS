import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getServices } from '#lib/server/container';
import { getDb } from '#lib/server/db';
import { businesses } from '#lib/server/db/schema';
import { getAllDraftEntityJsonSchemas } from '#lib/features/drafts/domain/draft-schema-registry';
import {
	DRAFT_ACTIONS,
	DRAFT_ENTITY_TYPES,
	type DraftAction,
	type DraftEntityType
} from '#lib/features/drafts/domain/draft.entity';
import type { AiTool } from '#lib/features/ai/domain/ai-provider.interface';
import {
	toAiTool,
	zodToMcpInputSchema,
	type McpExecutionContext,
	type McpToolDefinition
} from '../domain/mcp-tool.entity';

const singleEntryInputSchema = z.object({
	entryId: z
		.string()
		.optional()
		.describe(
			'Identificador o alias simbólico en el borrador (ej: "item:harina", "item:bizcochuelo"). Si ya existe ese entryId en el borrador, se actualizan/fusionan sus campos.'
		),
	entityType: z
		.enum(DRAFT_ENTITY_TYPES)
		.describe(
			'Tipo de entidad a modificar en el borrador: "item" (insumo o elaboración), "recipe_line" (ingrediente de receta), "sales_product" (producto de venta en catálogo) u "order" (pedido de cliente)'
		),
	action: z
		.enum(DRAFT_ACTIONS)
		.default('create')
		.describe('Acción a realizar al confirmar el borrador: "create", "update" o "delete"'),
	targetId: z
		.string()
		.optional()
		.describe(
			'ID, código o nombre de la entidad existente en la base de datos cuando action es "update" o "delete"'
		),
	data: z
		.record(z.string(), z.any())
		.default({})
		.describe(
			'Objeto con los campos de la entidad (pueden ser parciales mientras se conversa con el usuario; el sistema validará contra el schema de Zod e informará qué campos faltan)'
		)
});

export class McpRegistryService {
	private readonly tools: McpToolDefinition<any>[] = [
		{
			name: 'get_tenant_info',
			description:
				'Devuelve la información del negocio (tenant) al que está conectado actualmente el agente MCP: ID, nombre comercial, descripción, moneda y horarios.',
			schema: z.object({}),
			execute: async (ctx) => {
				const db = getDb();
				const business = await db.query.businesses.findFirst({
					where: eq(businesses.id, ctx.businessId)
				});
				if (!business) {
					throw new Error('Negocio no encontrado.');
				}
				return {
					businessId: business.id,
					name: business.name,
					description: business.description,
					whatsapp: business.whatsapp,
					currencySymbol: business.settings?.currencySymbol || '$',
					openingHours: business.openingHours
				};
			}
		},
		{
			name: 'get_entity_schemas',
			description:
				'Devuelve los JSON Schemas (inferidos automáticamente desde Zod con sus descripciones .describe()) de las entidades soportadas por el borrador ("item", "recipe_line", "sales_product", "order"). Úsalo para conocer exactamente qué campos requiere cada entidad.',
			schema: z.object({
				entityType: z
					.enum(DRAFT_ENTITY_TYPES)
					.optional()
					.describe('Si se especifica, devuelve únicamente el schema de ese tipo de entidad')
			}),
			execute: async (_ctx, args) => {
				const allSchemas = getAllDraftEntityJsonSchemas();
				if (args?.entityType && allSchemas[args.entityType as DraftEntityType]) {
					return {
						entityType: args.entityType,
						schemas: allSchemas[args.entityType as DraftEntityType]
					};
				}
				return { schemas: allSchemas };
			}
		},
		{
			name: 'list_existing_entities',
			description:
				'Consulta los registros actuales en la base de datos del negocio (insumos, elaboraciones/recetas, productos de venta del catálogo u órdenes).',
			schema: z.object({
				category: z
					.enum(['items', 'sales_products', 'orders', 'all'])
					.default('all')
					.describe('Categoría de datos existentes a consultar en el negocio actual')
			}),
			execute: async (ctx, args) => {
				const { itemService, orderService } = getServices();
				const category = args?.category || 'all';
				const result: Record<string, any> = {};

				if (category === 'items' || category === 'all') {
					const items = await itemService.listItems(ctx.businessId);
					result.items = items.map((i) => ({
						id: i.id,
						code: i.code,
						name: i.name,
						type: i.type,
						baseUnit: i.baseUnit,
						referenceCost: i.referenceCost,
						purchaseQuantity: i.purchaseQuantity,
						yieldQuantity: i.yieldQuantity,
						currentStock: i.currentStock
					}));
				}

				if (category === 'sales_products' || category === 'all') {
					const products = await orderService.listSalesProducts(ctx.businessId);
					result.salesProducts = products.map((p) => ({
						id: p.id,
						code: p.code,
						name: p.name,
						salePrice: p.salePrice,
						isActive: p.isActive,
						components: p.components.map((c) => ({
							itemId: c.itemId,
							itemName: c.item?.name,
							quantity: c.quantity
						}))
					}));
				}

				if (category === 'orders' || category === 'all') {
					const orders = await orderService.listOrders(ctx.businessId);
					result.orders = orders.slice(0, 20).map((o) => ({
						id: o.id,
						orderNumber: o.orderNumber,
						customerName: o.customerName,
						status: o.status,
						paymentStatus: o.paymentStatus,
						totalAmount: o.totalAmount
					}));
				}

				return result;
			}
		},
		{
			name: 'get_draft_status',
			description:
				'Obtiene el estado actual del Borrador (JSONB) activo del negocio, incluyendo todas las entradas cargadas hasta el momento, cuáles están listas y qué campos faltan completar según los schemas de Zod.',
			schema: z.object({}),
			execute: async (ctx) => {
				const { draftService } = getServices();
				const summary = await draftService.getOrCreateActiveDraft(
					ctx.businessId,
					ctx.sessionId
				);
				return {
					draftId: summary.draft.id,
					readyToCommit: summary.readyToCommit,
					totalEntries: summary.totalEntries,
					validEntriesCount: summary.validEntriesCount,
					invalidEntriesCount: summary.invalidEntriesCount,
					entries: summary.draft.payload.entries,
					pendingQuestionsForUser: summary.pendingQuestionsSummary
				};
			}
		},
		{
			name: 'upsert_draft_entry',
			description:
				'Agrega o actualiza una o varias entradas en el Borrador (JSONB) sin impactar todavía la base de datos final. Permite guardar datos parciales (ej: primero el nombre del insumo o pedido, y luego sus costos o cantidades) y devuelve automáticamente qué campos faltan preguntar al usuario según el schema de Zod.',
			schema: z.object({
				entryId: singleEntryInputSchema.shape.entryId,
				entityType: singleEntryInputSchema.shape.entityType.optional(),
				action: singleEntryInputSchema.shape.action.optional(),
				targetId: singleEntryInputSchema.shape.targetId,
				data: singleEntryInputSchema.shape.data.optional(),
				entries: z
					.array(singleEntryInputSchema)
					.optional()
					.describe(
						'Opcional: lista de múltiples entradas para agregar o actualizar en lote dentro del borrador en una sola llamada'
					)
			}),
			execute: async (ctx, args) => {
				const { draftService } = getServices();

				const batch: Array<z.infer<typeof singleEntryInputSchema>> = [];
				if (Array.isArray(args?.entries) && args.entries.length > 0) {
					batch.push(...args.entries);
				} else if (args?.entityType) {
					batch.push({
						entryId: args.entryId,
						entityType: args.entityType as DraftEntityType,
						action: (args.action as DraftAction) || 'create',
						targetId: args.targetId,
						data: args.data || {}
					});
				} else {
					throw new Error(
						'Debes proporcionar "entityType" y "data", o bien un arreglo "entries" con las entidades a guardar en el borrador.'
					);
				}

				let latestSummary = await draftService.getOrCreateActiveDraft(
					ctx.businessId,
					ctx.sessionId
				);
				const updatedEntries = [];

				for (const item of batch) {
					const res = await draftService.upsertEntry({
						businessId: ctx.businessId,
						sessionId: ctx.sessionId,
						entryId: item.entryId,
						entityType: item.entityType,
						action: item.action ?? 'create',
						targetId: item.targetId,
						data: item.data ?? {},
						merge: true
					});
					latestSummary = res.summary;
					updatedEntries.push(res.entry);
				}

				return {
					savedInDraft: true,
					updatedEntriesCount: updatedEntries.length,
					readyToCommit: latestSummary.readyToCommit,
					totalEntries: latestSummary.totalEntries,
					validEntriesCount: latestSummary.validEntriesCount,
					invalidEntriesCount: latestSummary.invalidEntriesCount,
					entries: latestSummary.draft.payload.entries,
					pendingQuestionsForUser: latestSummary.pendingQuestionsSummary,
					agentInstruction: latestSummary.readyToCommit
						? 'Todos los datos del borrador están completos y válidos según los schemas de Zod. Muéstrale un resumen al usuario y pregúntale si desea confirmar el borrador (o ejecuta commit_draft si ya te dio la orden de confirmarlo).'
						: 'Se guardó el avance en el borrador. Revisa "pendingQuestionsForUser" y pregúntale ordenadamente al usuario por los campos faltantes antes de confirmar.'
				};
			}
		},
		{
			name: 'remove_draft_entry',
			description:
				'Elimina una entrada específica del borrador activo por su entryId, o vacía por completo el borrador si clearAll es true.',
			schema: z.object({
				entryId: z
					.string()
					.optional()
					.describe('Identificador de la entrada a quitar del borrador (ej: "item:harina")'),
				clearAll: z
					.boolean()
					.default(false)
					.describe('Si es true, vacía todas las entradas del borrador activo')
			}),
			execute: async (ctx, args) => {
				const { draftService } = getServices();
				if (args?.clearAll) {
					const summary = await draftService.clearDraft(
						ctx.businessId,
						undefined,
						ctx.sessionId
					);
					return {
						cleared: true,
						totalEntries: summary.totalEntries
					};
				}
				if (!args?.entryId) {
					throw new Error('Debes indicar "entryId" o "clearAll: true".');
				}
				const summary = await draftService.removeEntry(
					ctx.businessId,
					args.entryId,
					undefined,
					ctx.sessionId
				);
				return {
					removedEntryId: args.entryId,
					readyToCommit: summary.readyToCommit,
					totalEntries: summary.totalEntries,
					entries: summary.draft.payload.entries
				};
			}
		},
		{
			name: 'commit_draft',
			description:
				'Confirma el borrador activo e impacta todas sus creaciones, actualizaciones y eliminaciones en las tablas reales de la base de datos (insumos, recetas, productos de venta y pedidos). Solo funciona si todas las entradas del borrador cumplen con los schemas de Zod (readyToCommit = true).',
			schema: z.object({}),
			execute: async (ctx) => {
				const { draftService } = getServices();
				const commitResult = await draftService.commitDraft(
					ctx.businessId,
					undefined,
					ctx.sessionId
				);
				return {
					committed: true,
					result: commitResult
				};
			}
		}
	];

	getToolDefinitions(): McpToolDefinition<any>[] {
		return this.tools;
	}

	getAiTools(): AiTool[] {
		return this.tools.map((t) => toAiTool(t));
	}

	getMcpProtocolToolsList() {
		return this.tools.map((t) => ({
			name: t.name,
			description: t.description,
			inputSchema: zodToMcpInputSchema(t.schema)
		}));
	}

	async executeTool(
		name: string,
		context: McpExecutionContext,
		args: Record<string, any>
	): Promise<any> {
		const tool = this.tools.find((t) => t.name === name);
		if (!tool) {
			throw new Error(`Herramienta MCP desconocida: "${name}"`);
		}
		return tool.execute(context, args ?? {});
	}
}

let mcpRegistrySingleton: McpRegistryService | null = null;

export function getMcpRegistry(): McpRegistryService {
	if (!mcpRegistrySingleton) {
		mcpRegistrySingleton = new McpRegistryService();
	}
	return mcpRegistrySingleton;
}
