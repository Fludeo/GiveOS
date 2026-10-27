import { buildBotSystemPrompt, DEFAULT_BOT_CONFIG } from './bot-config.entity';

export const DEFAULT_BOT_PROMPT = buildBotSystemPrompt(
	{
		name: 'nuestro negocio',
		description: 'Venta de productos y atención al cliente.',
		openingHours: 'Lunes a Sábado de 09:00 a 19:00 hs',
		currencySymbol: '$'
	},
	DEFAULT_BOT_CONFIG
);
