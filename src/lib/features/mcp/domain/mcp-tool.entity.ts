import { z } from 'zod';
import type { AiTool, AiToolParameters } from '#lib/features/ai/domain/ai-provider.interface';

export interface McpExecutionContext {
	businessId: string;
	sessionId?: string | null;
	userId?: string | null;
}

export interface McpToolDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
	name: string;
	description: string;
	schema: TSchema;
	execute: (context: McpExecutionContext, args: z.infer<TSchema>) => Promise<any>;
}

/**
 * Limpia un JSON Schema generado por Zod v4 para que sea 100% compatible tanto con
 * clientes MCP (JSON-RPC) como con las APIs de Function Calling de Gemini y Ollama.
 */
export function cleanJsonSchemaForAi(schemaObj: any): any {
	if (!schemaObj || typeof schemaObj !== 'object') return schemaObj;
	if (Array.isArray(schemaObj)) {
		return schemaObj.map((item) => cleanJsonSchemaForAi(item));
	}

	const cleaned: Record<string, any> = {};
	for (const [key, value] of Object.entries(schemaObj)) {
		if (key === '$schema' || key === 'additionalProperties') {
			continue;
		}
		cleaned[key] = cleanJsonSchemaForAi(value);
	}
	return cleaned;
}

export function zodToMcpInputSchema(schema: z.ZodTypeAny): AiToolParameters {
	try {
		const raw = z.toJSONSchema(schema) as Record<string, any>;
		const cleaned = cleanJsonSchemaForAi(raw);
		return {
			type: 'object',
			properties: cleaned.properties ?? {},
			required: Array.isArray(cleaned.required) ? cleaned.required : []
		};
	} catch {
		return {
			type: 'object',
			properties: {},
			required: []
		};
	}
}

export function toAiTool(def: McpToolDefinition): AiTool {
	return {
		name: def.name,
		description: def.description,
		parameters: zodToMcpInputSchema(def.schema)
	};
}
