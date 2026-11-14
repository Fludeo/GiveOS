import { eq } from 'drizzle-orm';
import { getAiProvider } from '#lib/features/ai/application/ai-provider-factory';
import type { AiMessage } from '#lib/features/ai/domain/ai-provider.interface';
import { getAllDraftEntityJsonSchemas } from '#lib/features/drafts/domain/draft-schema-registry';
import type { DraftSummaryStatus } from '#lib/features/drafts/domain/draft.entity';
import { getServices } from '#lib/server/container';
import { getDb } from '#lib/server/db';
import { businesses } from '#lib/server/db/schema';
import { getMcpRegistry } from './mcp-registry.service';

export interface AssistantChatInput {
	businessId: string;
	sessionId?: string | null;
	messageText: string;
	chatHistory: Array<{ role: 'user' | 'assistant'; text: string }>;
}

export interface ExecutedToolLog {
	name: string;
	args: Record<string, any>;
	result: any;
}

export interface AssistantChatOutput {
	replyText: string;
	toolsExecuted: ExecutedToolLog[];
	draftSummary: DraftSummaryStatus;
}

export class AssistantChatService {
	async processMessage(input: AssistantChatInput): Promise<AssistantChatOutput> {
		const aiProvider = getAiProvider();
		const mcpRegistry = getMcpRegistry();
		const { draftService } = getServices();
		const db = getDb();

		const business = await db.query.businesses.findFirst({
			where: eq(businesses.id, input.businessId)
		});
		const businessName = business?.name || 'Negocio';
		const currency = business?.settings?.currencySymbol || '$';

		const initialDraftSummary = await draftService.getOrCreateActiveDraft(
			input.businessId,
			input.sessionId
		);

		const schemasOverview = getAllDraftEntityJsonSchemas();

		const systemPrompt = `Eres el Asistente Copiloto de GiveOS para el negocio "${businessName}" (Moneda: ${currency}).
Tu función es ayudar al usuario a cargar y modificar insumos, recetas (elaboraciones), productos de venta del catálogo y pedidos utilizando SIEMPRE el sistema de **Borrador Dinámico (Draft JSONB)**.

### REGLAS DE ORO DEL BORRADOR:
1. **Guarda primero en el Borrador, aunque falten datos**:
   Si el usuario menciona insumos, recetas, productos o pedidos (incluso si solo dice los nombres, ej: "quiero agregar harina, azúcar y huevos"), llama INMEDIATAMENTE a la herramienta \`upsert_draft_entry\` (puedes usar el arreglo \`entries\` para cargar varios a la vez) con los datos que tengas hasta el momento.
2. **Déjate guiar por la validación automática de Zod**:
   Al llamar a \`upsert_draft_entry\`, el motor validará cada entrada contra su schema de Zod y te devolverá \`pendingQuestionsForUser\` con los campos exactos que faltan y su descripción. Usa esa lista para preguntarle al usuario de forma ordenada y amigable lo que falta.
3. **Referencias simbólicas entre ítems y recetas**:
   En una receta (\`type: "prepared"\` con \`ingredients\`, o en \`recipe_line\`), puedes referenciar los insumos por su \`entryId\` (ej: \`"item:harina"\`), código o nombre exacto, incluso si todavía están en el borrador y aún no fueron confirmados en la base de datos.
4. **Confirmación (\`commit_draft\`)**:
   Cuando \`readyToCommit\` sea \`true\` y el usuario te pida confirmar o aplicar los cambios, ejecuta \`commit_draft\`.

### SCHEMAS DE ZOD DE LAS ENTIDADES (Fuente de verdad):
${JSON.stringify(schemasOverview, null, 2)}

### ESTADO ACTUAL DEL BORRADOR ACTIVO EN ESTE MOMENTO:
${JSON.stringify(
	{
		draftId: initialDraftSummary.draft.id,
		readyToCommit: initialDraftSummary.readyToCommit,
		totalEntries: initialDraftSummary.totalEntries,
		entries: initialDraftSummary.draft.payload.entries,
		pendingQuestionsForUser: initialDraftSummary.pendingQuestionsSummary
	},
	null,
	2
)}`;

		const messages: AiMessage[] = [
			{ role: 'system', content: systemPrompt },
			...input.chatHistory.map((h) => ({
				role: (h.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
				content: h.text
			})),
			{ role: 'user', content: input.messageText }
		];

		const tools = mcpRegistry.getAiTools();
		const toolsExecuted: ExecutedToolLog[] = [];
		let finalReply = '';

		// Permitir hasta 3 rondas de ejecución de herramientas por turno
		for (let step = 0; step < 3; step++) {
			const response = await aiProvider.chat({
				messages,
				tools,
				temperature: 0.2
			});

			if (!response.toolCalls || response.toolCalls.length === 0) {
				finalReply = response.content?.trim() || '';
				break;
			}

			const stepResults: Array<{ toolName: string; result: any }> = [];
			for (const call of response.toolCalls) {
				try {
					const result = await mcpRegistry.executeTool(
						call.name,
						{
							businessId: input.businessId,
							sessionId: input.sessionId
						},
						call.arguments || {}
					);
					toolsExecuted.push({
						name: call.name,
						args: call.arguments || {},
						result
					});
					stepResults.push({ toolName: call.name, result });
				} catch (err: any) {
					const errorPayload = {
						error: true,
						message: err?.message || 'Error ejecutando herramienta'
					};
					toolsExecuted.push({
						name: call.name,
						args: call.arguments || {},
						result: errorPayload
					});
					stepResults.push({ toolName: call.name, result: errorPayload });
				}
			}

			messages.push({
				role: 'assistant',
				content:
					response.content?.trim() ||
					`Ejecutando herramientas: ${stepResults.map((s) => s.toolName).join(', ')}...`
			});

			messages.push({
				role: 'user',
				content: `[Resultado de las herramientas MCP ejecutadas]:\n${JSON.stringify(stepResults, null, 2)}\n\nInstrucción: Responde al usuario de forma clara y ordenada. Si guardaste datos en el borrador y hay campos pendientes en "pendingQuestionsForUser", pregúntale por ellos ordenadamente. Si "readyToCommit" es true, infórmale que el borrador está listo para confirmar.`
			});
		}

		const updatedDraftSummary = await draftService.getOrCreateActiveDraft(
			input.businessId,
			input.sessionId
		);

		if (!finalReply) {
			if (updatedDraftSummary.pendingQuestionsSummary.length > 0) {
				const pendingList = updatedDraftSummary.pendingQuestionsSummary
					.map(
						(p) =>
							`- **${p.label}**: ${p.issues.map((i) => `${i.field} (${i.description || i.message})`).join('; ')}`
					)
					.join('\n');
				finalReply = `Actualicé el borrador. Para completar las entidades nos falta definir:\n\n${pendingList}`;
			} else if (updatedDraftSummary.readyToCommit) {
				finalReply = `¡El borrador está completo y validado (${updatedDraftSummary.totalEntries} entradas)! Puedes confirmarlo con el botón "Confirmar Borrador" o pedirme que lo confirme.`;
			} else {
				finalReply = 'Operación procesada.';
			}
		}

		return {
			replyText: finalReply,
			toolsExecuted,
			draftSummary: updatedDraftSummary
		};
	}
}

let assistantChatSingleton: AssistantChatService | null = null;

export function getAssistantChatService(): AssistantChatService {
	if (!assistantChatSingleton) {
		assistantChatSingleton = new AssistantChatService();
	}
	return assistantChatSingleton;
}
