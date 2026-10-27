import { v7 as uuidv7 } from 'uuid';
import type {
	AiChatRequest,
	AiChatResponse,
	AiProvider,
	AiToolCall
} from '../domain/ai-provider.interface';

export interface GeminiProviderOptions {
	apiKey?: string;
	model?: string;
}

export class GeminiAiProvider implements AiProvider {
	readonly id = 'gemini';
	readonly model: string;
	private apiKey: string;

	constructor(options?: GeminiProviderOptions) {
		this.apiKey = options?.apiKey || process.env.GEMINI_API_KEY || '';
		this.model = options?.model || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
	}

	async chat(request: AiChatRequest): Promise<AiChatResponse> {
		if (!this.apiKey) {
			throw new Error(
				'[GeminiAiProvider] GEMINI_API_KEY no está configurada en las variables de entorno.'
			);
		}

		const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

		// Formatear mensajes para el formato de Gemini API
		const contents: Array<{ role: string; parts: Array<Record<string, any>> }> = [];
		let systemInstruction: string | undefined = undefined;

		for (const m of request.messages) {
			if (m.role === 'system') {
				systemInstruction = m.content;
			} else if (m.role === 'tool') {
				contents.push({
					role: 'function',
					parts: [
						{
							functionResponse: {
								name: m.toolCallId || 'tool_response',
								response: { content: m.content }
							}
						}
					]
				});
			} else {
				contents.push({
					role: m.role === 'assistant' ? 'model' : 'user',
					parts: [{ text: m.content }]
				});
			}
		}

		// Herramientas en formato Gemini
		const toolsConfig = request.tools && request.tools.length > 0
			? [
					{
						functionDeclarations: request.tools.map((t) => ({
							name: t.name,
							description: t.description,
							parameters: t.parameters
						}))
					}
			  ]
			: undefined;

		const body: Record<string, any> = {
			contents,
			generationConfig: {
				temperature: request.temperature ?? 0.2
			}
		};

		if (systemInstruction) {
			body.systemInstruction = {
				parts: [{ text: systemInstruction }]
			};
		}

		if (toolsConfig) {
			body.tools = toolsConfig;
		}

		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

		if (!res.ok) {
			const err = await res.text();
			throw new Error(`[GeminiAiProvider] Error HTTP ${res.status}: ${err}`);
		}

		const data = await res.json();
		const candidate = data.candidates?.[0];
		const parts = candidate?.content?.parts || [];

		let content = '';
		const toolCalls: AiToolCall[] = [];

		for (const part of parts) {
			if (part.text) {
				content += part.text;
			}
			if (part.functionCall) {
				toolCalls.push({
					id: uuidv7(),
					name: part.functionCall.name,
					arguments: part.functionCall.args || {}
				});
			}
		}

		return {
			content,
			toolCalls
		};
	}
}
