import { getServices } from '#lib/server/container';
import { getAiProvider } from './ai-provider-factory';
import type { AiMessage, AiTool } from '../domain/ai-provider.interface';
import { getDb } from '#lib/server/db/index';
import { businesses, salesProducts, orders } from '#lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export interface BotProcessInput {
	businessId: string;
	customerPhone: string;
	customerName?: string;
	messageText: string;
	chatHistory: Array<{ role: 'user' | 'assistant'; text: string }>;
	customSystemPrompt?: string;
}

import { DEFAULT_BOT_PROMPT } from '../domain/bot-prompt.constants';
export { DEFAULT_BOT_PROMPT };

export interface BotProcessOutput {
	replyText: string;
	toolExecuted?: string;
	orderCreated?: {
		orderId: string;
		orderNumber: string;
		totalAmount: number;
	};
}

export class EcommerceBotService {
	private readonly tools: AiTool[] = [
		{
			name: 'get_catalog',
			description:
				'Devuelve la lista de productos y tortas disponibles a la venta en la pastelería, con sus códigos, nombres y precios.',
			parameters: {
				type: 'object',
				properties: {},
				required: []
			}
		},
		{
			name: 'get_business_info',
			description:
				'Devuelve información sobre el negocio: horarios de atención, dirección y datos para pagar por transferencia (Alias/CBU).',
			parameters: {
				type: 'object',
				properties: {},
				required: []
			}
		},
		{
			name: 'create_unconfirmed_order',
			description:
				'Registra un pedido en estado NO CONFIRMADO para que el encargado verifique el comprobante de pago antes de confirmarlo. Úsalo cuando el cliente confirme qué productos desea encargar.',
			parameters: {
				type: 'object',
				properties: {
					customer_name: {
						type: 'string',
						description: 'Nombre del cliente'
					},
					items: {
						type: 'array',
						description: 'Lista de ítems solicitados',
						items: {
							type: 'object',
							properties: {
								product_code_or_name: {
									type: 'string',
									description: 'Código o nombre del producto'
								},
								quantity: {
									type: 'number',
									description: 'Cantidad solicitada'
								}
							}
						}
					},
					delivery_date: {
						type: 'string',
						description: 'Fecha y hora estimada de retiro o entrega (ej: 2026-10-30 16:00)'
					},
					notes: {
						type: 'string',
						description: 'Notas adicionales o dedicatoria'
					}
				},
				required: ['customer_name', 'items']
			}
		}
	];

	async processMessage(input: BotProcessInput): Promise<BotProcessOutput> {
		const aiProvider = getAiProvider();
		const db = getDb();

		// 1. Obtener datos del negocio para contextualizar al modelo
		const business = await db.query.businesses.findFirst({
			where: eq(businesses.id, input.businessId)
		});

		const businessName = business?.name || 'la pastelería';
		const currency = business?.settings?.currencySymbol || '$';

		const rawPrompt = input.customSystemPrompt?.trim() || DEFAULT_BOT_PROMPT;
		const systemPrompt = `Nombre del negocio: "${businessName}". Símbolo de moneda: "${currency}".
${rawPrompt}`;

		// 2. Construir historial de mensajes
		const messages: AiMessage[] = [
			{ role: 'system', content: systemPrompt },
			...input.chatHistory.map((h) => ({
				role: (h.role === 'assistant' ? 'assistant' : 'user') as any,
				content: h.text
			})),
			{ role: 'user', content: input.messageText }
		];

		// 3. Ejecutar primera llamada al modelo
		let response = await aiProvider.chat({
			messages,
			tools: this.tools,
			temperature: 0.1
		});

		let toolExecuted: string | undefined = undefined;
		let orderCreated: BotProcessOutput['orderCreated'] = undefined;

		// 4. Si el modelo solicitó ejecutar herramientas, resolverlas
		if (response.toolCalls && response.toolCalls.length > 0) {
			const toolCall = response.toolCalls[0];
			toolExecuted = toolCall.name;

			let toolResultContent = '';

			if (toolCall.name === 'get_catalog') {
				const products = await db.query.salesProducts.findMany({
					where: and(
						eq(salesProducts.businessId, input.businessId),
						eq(salesProducts.isActive, true)
					)
				});

				const catalogSummary = products.map((p) => ({
					codigo: p.code,
					nombre: p.name,
					descripcion: p.description,
					precio: `${currency}${p.salePrice}`
				}));

				toolResultContent = JSON.stringify(catalogSummary);
			} else if (toolCall.name === 'get_business_info') {
				toolResultContent = JSON.stringify({
					negocio: businessName,
					horarios: business?.openingHours || 'Consultar por mensaje',
					whatsapp: business?.whatsapp || '',
					pago: {
						metodo: 'Transferencia bancaria',
						alias: 'PASTELERIA.SWEET.CAKES',
						titular: businessName
					}
				});
			} else if (toolCall.name === 'create_unconfirmed_order') {
				try {
					const args = toolCall.arguments;
					const { orderService } = getServices();
					const catalog = await orderService.listSalesProducts(input.businessId);

					const lines: Array<{
						salesProductId: string;
						quantity: number;
						fulfillmentType: 'preorder' | 'immediate';
					}> = [];

					for (const item of args.items || []) {
						const search = String(item.product_code_or_name).toLowerCase().trim();
						const found = catalog.find(
							(p) =>
								p.code.toLowerCase() === search ||
								p.name.toLowerCase().includes(search)
						);

						if (found) {
							lines.push({
								salesProductId: found.id,
								quantity: Number(item.quantity) || 1,
								fulfillmentType: args.delivery_date ? 'preorder' : 'immediate'
							});
						}
					}

					if (lines.length > 0) {
						const created = await orderService.createOrder({
							businessId: input.businessId,
							customerName: args.customer_name || input.customerName || 'Cliente WhatsApp',
							deliveryDate: args.delivery_date ? new Date(args.delivery_date) : undefined,
							notes: `[Bot WhatsApp ${input.customerPhone}] ${args.notes || ''}`.trim(),
							lines
						});

						// Asociar teléfono del cliente en transactionId para cruce rápido con el chat
						await db
							.update(orders)
							.set({ transactionId: input.customerPhone })
							.where(eq(orders.id, created.id));

						orderCreated = {
							orderId: created.id,
							orderNumber: created.orderNumber,
							totalAmount: created.totalAmount
						};

						toolResultContent = JSON.stringify({
							exito: true,
							numero_orden: created.orderNumber,
							total: `${currency}${created.totalAmount}`,
							estado: 'no_confirmado'
						});
					} else {
						toolResultContent = JSON.stringify({
							exito: false,
							error: 'No se encontraron los productos indicados en el catálogo.'
						});
					}
				} catch (err: any) {
					toolResultContent = JSON.stringify({
						exito: false,
						error: err.message
					});
				}
			}

			// 5. Devolver el resultado de la herramienta al modelo para generar la respuesta final al cliente
			messages.push({
				role: 'assistant',
				content: response.content || `[Ejecutando ${toolCall.name}]`
			});

			messages.push({
				role: 'tool',
				content: toolResultContent,
				toolCallId: toolCall.name
			});

			const secondResponse = await aiProvider.chat({
				messages,
				temperature: 0.2
			});

			return {
				replyText: secondResponse.content,
				toolExecuted,
				orderCreated
			};
		}

		return {
			replyText: response.content,
			toolExecuted,
			orderCreated
		};
	}
}

// Singleton
let _ecommerceBotService: EcommerceBotService | null = null;
export function getEcommerceBotService(): EcommerceBotService {
	if (!_ecommerceBotService) {
		_ecommerceBotService = new EcommerceBotService();
	}
	return _ecommerceBotService;
}
