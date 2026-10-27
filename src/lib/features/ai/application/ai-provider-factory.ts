import type { AiProvider } from '../domain/ai-provider.interface';
import { OllamaAiProvider } from '../infrastructure/ollama-ai-provider';
import { GeminiAiProvider } from '../infrastructure/gemini-ai-provider';

export function getAiProvider(): AiProvider {
	const providerType = (process.env.AI_PROVIDER || 'ollama').toLowerCase().trim();

	switch (providerType) {
		case 'gemini':
			return new GeminiAiProvider({
				apiKey: process.env.GEMINI_API_KEY,
				model: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
			});

		case 'ollama':
		default:
			return new OllamaAiProvider({
				baseUrl: process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
				model: process.env.OLLAMA_MODEL || 'gemma3:4b'
			});
	}
}
