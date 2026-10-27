import { v7 as uuidv7 } from 'uuid';
import { createHash } from 'crypto';
import type {
	AiChatRequest,
	AiChatResponse,
	AiProvider,
	AiToolCall
} from '../domain/ai-provider.interface';

export interface GeminiProviderOptions {
	apiKey?: string;
	model?: string;
	enableCache?: boolean;
}

interface CachedContentEntry {
	resourceName: string;
	expiresAt: number;
}

// Registro en memoria de recursos cacheados para reutilizar entre peticiones y reducir consumo de tokens
const geminiCacheRegistry = new Map<string, CachedContentEntry>();

export class GeminiAiProvider implements AiProvider {
	readonly id = 'gemini';
	readonly model: string;
	private apiKey: string;
	private enableCache: boolean;

	constructor(options?: GeminiProviderOptions) {
		this.apiKey = options?.apiKey || process.env.GEMINI_API_KEY || '';
		this.model = options?.model || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
		this.enableCache = options?.enableCache ?? (process.env.GEMINI_ENABLE_CACHE !== 'false');
	}

	/**
	 * Crea u obtiene un recurso de Context Caching en la API de Gemini si está habilitado y es admitido
	 */
	private async getOrSetCachedContent(
		systemInstruction: string,
		toolsConfig?: Array<Record<string, any>>
	): Promise<string | null> {
		if (!this.enableCache || !systemInstruction) return null;

		const normalizedModel = this.model.startsWith('models/')
			? this.model
			: `models/${this.model}`;

		const cacheKey = createHash('sha256')
			.update(`${normalizedModel}::${systemInstruction}::${JSON.stringify(toolsConfig || [])}`)
			.digest('hex');

		const existing = geminiCacheRegistry.get(cacheKey);
		if (existing && existing.expiresAt > Date.now()) {
			return existing.resourceName;
		}

		try {
			const cacheUrl = `https://generativelanguage.googleapis.com/v1beta/cachedContents?key=${this.apiKey}`;
			const res = await fetch(cacheUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: normalizedModel,
					contents: [],
					systemInstruction: {
						parts: [{ text: systemInstruction }]
					},
					tools: toolsConfig,
					ttl: '3600s' // 1 hora de TTL en servidor Gemini
				})
			});

			if (res.ok) {
				const data = await res.json();
				if (data.name) {
					// Guardar en memoria con margen de seguridad (50 minutos)
					geminiCacheRegistry.set(cacheKey, {
						resourceName: data.name,
						expiresAt: Date.now() + 50 * 60 * 1000
					});
					console.log(
						`[GeminiAiProvider] Context Caching activado en API: "${data.name}". System prompt y herramientas cacheados con éxito.`
					);
					return data.name;
				}
			} else {
				// Si la API rechaza el cache explícito (ej: umbral mínimo de tokens no alcanzado o tier),
				// continúa en silencio usando inyección estándar en el cuerpo
			}
		} catch (_) {
			// En caso de fallo de red al crear el cache, fallback transparente
		}

		return null;
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
		const toolsConfig =
			request.tools && request.tools.length > 0
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

		// Intentar obtener o crear cache en el servidor de la API de Gemini
		let cachedContentName: string | null = null;
		if (systemInstruction) {
			cachedContentName = await this.getOrSetCachedContent(systemInstruction, toolsConfig);
		}

		const body: Record<string, any> = {
			contents,
			generationConfig: {
				temperature: request.temperature ?? 0.2
			}
		};

		if (cachedContentName) {
			// Al usar cachedContent, la API de Gemini requiere omitir systemInstruction y tools repetidos
			body.cachedContent = cachedContentName;
		} else {
			if (systemInstruction) {
				body.systemInstruction = {
					parts: [{ text: systemInstruction }]
				};
			}
			if (toolsConfig) {
				body.tools = toolsConfig;
			}
		}

		let res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

		// Si falla usando un cache expirado o revocado en el servidor (404/400), invalidar y reintentar inmediatamente
		if (!res.ok && cachedContentName) {
			console.warn(
				'[GeminiAiProvider] cachedContent inválido o expirado. Reintentando con prompt directo...'
			);
			for (const [key, val] of geminiCacheRegistry.entries()) {
				if (val.resourceName === cachedContentName) {
					geminiCacheRegistry.delete(key);
				}
			}
			delete body.cachedContent;
			if (systemInstruction) {
				body.systemInstruction = {
					parts: [{ text: systemInstruction }]
				};
			}
			if (toolsConfig) {
				body.tools = toolsConfig;
			}
			res = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
		}

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
