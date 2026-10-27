import { v7 as uuidv7 } from 'uuid';
import type {
	AiChatRequest,
	AiChatResponse,
	AiMessage,
	AiProvider,
	AiTool,
	AiToolCall
} from '../domain/ai-provider.interface';

export interface OllamaProviderOptions {
	baseUrl?: string;
	model?: string;
}

export class OllamaAiProvider implements AiProvider {
	readonly id = 'ollama';
	readonly model: string;
	private baseUrl: string;

	constructor(options?: OllamaProviderOptions) {
		this.baseUrl = (options?.baseUrl || process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
		this.model = options?.model || process.env.OLLAMA_MODEL || 'gemma4:e2b';
	}

	async chat(request: AiChatRequest): Promise<AiChatResponse> {
		const endpoint = `${this.baseUrl}/api/chat`;

		// 1. Si no hay herramientas requeridas, ejecutar llamada estándar
		if (!request.tools || request.tools.length === 0) {
			return this.executeStandardChat(endpoint, request.messages, request.temperature);
		}

		// 2. Si hay herramientas, intentar primero llamada nativa con el flag 'tools'
		const nativeResult = await this.tryNativeToolChat(endpoint, request);
		if (nativeResult) {
			return nativeResult;
		}

		// 3. Fallback inteligente: inyección estructurada de herramientas en prompt (ideal para Gemma y modelos locales sin flag nativo)
		return this.executePromptToolChat(endpoint, request);
	}

	private async executeStandardChat(
		endpoint: string,
		messages: AiMessage[],
		temperature = 0.2
	): Promise<AiChatResponse> {
		const res = await fetch(endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model: this.model,
				messages: messages.map((m) => ({
					role: m.role === 'tool' ? 'user' : m.role,
					content: m.role === 'tool' ? `[Resultado de herramienta]:\n${m.content}` : m.content
				})),
				stream: false,
				keep_alive: '60m',
				options: { temperature, num_ctx: 4096 }
			})
		});

		if (!res.ok) {
			const errText = await res.text();
			throw new Error(`[OllamaAiProvider] Error HTTP ${res.status}: ${errText}`);
		}

		const data = await res.json();
		return {
			content: data.message?.content || '',
			toolCalls: []
		};
	}

	private async tryNativeToolChat(
		endpoint: string,
		request: AiChatRequest
	): Promise<AiChatResponse | null> {
		try {
			const res = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: this.model,
					messages: request.messages.map((m) => ({
						role: m.role,
						content: m.content
					})),
					tools: request.tools?.map((t) => ({
						type: 'function',
						function: {
							name: t.name,
							description: t.description,
							parameters: t.parameters
						}
					})),
					stream: false,
					keep_alive: '60m',
					options: { temperature: request.temperature ?? 0.1, num_ctx: 4096 }
				})
			});

			const data = await res.json();

			// Si el modelo no soporta el flag nativo de Ollama (ej: Gemma 3), pasar al fallback estructurado
			if (data.error && data.error.includes('does not support tools')) {
				return null;
			}

			if (!res.ok) {
				return null;
			}

			const toolCalls: AiToolCall[] = [];
			if (Array.isArray(data.message?.tool_calls)) {
				for (const tc of data.message.tool_calls) {
					toolCalls.push({
						id: tc.id || uuidv7(),
						name: tc.function?.name || '',
						arguments:
							typeof tc.function?.arguments === 'string'
								? JSON.parse(tc.function.arguments)
								: tc.function?.arguments || {}
					});
				}
			}

			return {
				content: data.message?.content || '',
				toolCalls
			};
		} catch (err) {
			return null;
		}
	}

	private async executePromptToolChat(
		endpoint: string,
		request: AiChatRequest
	): Promise<AiChatResponse> {
		const toolInstructions = this.buildToolPrompt(request.tools || []);
		const modifiedMessages = [...request.messages];

		// Inyectar o enriquecer el system prompt con las herramientas disponibles
		const systemIndex = modifiedMessages.findIndex((m) => m.role === 'system');
		if (systemIndex >= 0) {
			modifiedMessages[systemIndex] = {
				...modifiedMessages[systemIndex],
				content: `${modifiedMessages[systemIndex].content}\n\n${toolInstructions}`
			};
		} else {
			modifiedMessages.unshift({
				role: 'system',
				content: toolInstructions
			});
		}

		const res = await fetch(endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model: this.model,
				messages: modifiedMessages.map((m) => ({
					role: m.role,
					content: m.content
				})),
				stream: false,
				keep_alive: '60m',
				options: { temperature: request.temperature ?? 0.1, num_ctx: 4096 }
			})
		});

		if (!res.ok) {
			const errText = await res.text();
			throw new Error(`[OllamaAiProvider] Error en fallback: ${errText}`);
		}

		const data = await res.json();
		const rawContent: string = data.message?.content || '';

		// Extraer llamada a función si el modelo devolvió un bloque JSON
		const extracted = this.extractToolCallFromText(rawContent);
		if (extracted) {
			return {
				content: extracted.cleanText,
				toolCalls: [extracted.toolCall]
			};
		}

		return {
			content: rawContent,
			toolCalls: []
		};
	}

	private buildToolPrompt(tools: AiTool[]): string {
		const definitions = tools.map((t) => ({
			name: t.name,
			description: t.description,
			parameters: t.parameters
		}));

		return `
[HERRAMIENTAS DEL SISTEMA]
Tienes a tu disposición las siguientes funciones que puedes ejecutar:
${JSON.stringify(definitions, null, 2)}

INSTRUCCIÓN OBLIGATORIA DE EJECUCIÓN:
Si para responder a la consulta del cliente necesitas consultar datos (catálogo, disponibilidad, precios) o registrar un pedido, debes emitir ÚNICAMENTE un bloque de código JSON con este formato exacto:
\`\`\`json
{
  "tool_call": {
    "name": "nombre_de_la_herramienta",
    "arguments": {
      "clave": "valor"
    }
  }
}
\`\`\`
Si no necesitas ejecutar herramientas, responde normalmente con texto amigable y cordial en español rioplatense.
`;
	}

	private extractToolCallFromText(
		text: string
	): { toolCall: AiToolCall; cleanText: string } | null {
		// 1. Buscar bloque markdown ```json ... ```
		const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
		const candidateString = jsonBlockMatch ? jsonBlockMatch[1] : text;

		try {
			// Intentar encontrar un objeto con tool_call
			const parsed = JSON.parse(candidateString.trim());
			if (parsed.tool_call && parsed.tool_call.name) {
				const cleanText = jsonBlockMatch
					? text.replace(jsonBlockMatch[0], '').trim()
					: '';

				return {
					toolCall: {
						id: uuidv7(),
						name: parsed.tool_call.name,
						arguments: parsed.tool_call.arguments || {}
					},
					cleanText
				};
			}
		} catch (_) {
			// Si no parsea directo, buscar regex de tool_call en el texto
			const toolRegex = /"tool_call"\s*:\s*{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*({[\s\S]*?})\s*}/;
			const match = text.match(toolRegex);
			if (match) {
				try {
					const name = match[1];
					const args = JSON.parse(match[2]);
					return {
						toolCall: {
							id: uuidv7(),
							name,
							arguments: args
						},
						cleanText: text.replace(match[0], '').trim()
					};
				} catch (_) {}
			}
		}

		return null;
	}
}
