export type AiRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AiToolParameterProperty {
	type: string;
	description?: string;
	enum?: string[];
	items?: {
		type: string;
		properties?: Record<string, any>;
	};
}

export interface AiToolParameters {
	type: 'object';
	properties: Record<string, AiToolParameterProperty>;
	required?: string[];
}

export interface AiTool {
	name: string;
	description: string;
	parameters: AiToolParameters;
}

export interface AiToolCall {
	id: string;
	name: string;
	arguments: Record<string, any>;
}

export interface AiMessage {
	role: AiRole;
	content: string;
	toolCallId?: string;
	toolCalls?: AiToolCall[];
}

export interface AiChatRequest {
	messages: AiMessage[];
	tools?: AiTool[];
	temperature?: number;
}

export interface AiChatResponse {
	content: string;
	toolCalls?: AiToolCall[];
}

export interface AiProvider {
	readonly id: string; // 'ollama' | 'gemini' | 'openai'
	readonly model: string;
	chat(request: AiChatRequest): Promise<AiChatResponse>;
}
