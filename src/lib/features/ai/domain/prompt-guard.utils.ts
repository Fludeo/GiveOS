/**
 * Utilidades de protección y guardrails para impedir la filtración del System Prompt
 * ante intentos de inyección, jailbreak o regurgitación del modelo.
 */

const EXTRACTION_PATTERNS: RegExp[] = [
	/\b(system\s*prompt|systemprompt)\b/i,
	/\b(instrucciones?\s+(internas?|del\s+sistema|ocultas?|previas?))\b/i,
	/\b(prompt\s+(inicial|del\s+sistema|interno|oculto))\b/i,
	/\b(revel(ar?|a|ame)|mostr(ar?|a|ame)|dime|cu[aá]l\s+es|p[aá]same)\s+(tu\s+)?(prompt|instrucci[oó]n|directiva)/i,
	/\b(ignore|ignora)\s+(all\s+|todas?\s+las?\s+)?(previous|previas?|anteriores?)\s+(instructions?|instrucciones?|directivas?)/i,
	/\b(olvida|forget)\s+(todas?\s+las?\s+)?(instrucciones?|instructions?)/i,
	/\b(developer\s+mode|modo\s+desarrollador|jailbreak|dan\s+mode)\b/i,
	/\b(repite\s+(el\s+texto|las\s+palabras)\s+(anteriores?|de\s+arriba|iniciales?))\b/i,
	/\b(what\s+is\s+your\s+(system\s+)?prompt)\b/i,
	/\b(print\s+(your\s+)?(system\s+)?prompt)\b/i
];

const LEAKED_MARKERS: string[] = [
	'Eres el asistente virtual por WhatsApp',
	'FLUJO DE ATENCIÓN OBLIGATORIO',
	'get_catalog()',
	'create_unconfirmed_order()',
	'get_business_info()',
	'CONFIDENCIALIDAD Y SEGURIDAD ESTRICTA',
	'REGLAS ESTRICTAS:',
	'POLÍTICA DE SEÑA Y PEDIDOS:',
	'DATOS PARA TRANSFERENCIA BANCARIA:',
	'buildBotSystemPrompt',
	'DEFAULT_BOT_CONFIG',
	'tool_call',
	'systemInstruction',
	'functionDeclarations'
];

/**
 * Detecta si el mensaje entrante del usuario intenta extraer el prompt del sistema.
 */
export function isPromptExtractionAttempt(message: string): boolean {
	if (!message || typeof message !== 'string') return false;
	const text = message.trim();
	return EXTRACTION_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Detecta si una respuesta generada por el modelo contiene accidentalmente directivas internas o código del prompt.
 */
export function isPromptLeakedInResponse(response: string): boolean {
	if (!response || typeof response !== 'string') return false;
	return LEAKED_MARKERS.some((marker) => response.includes(marker));
}

/**
 * Respuesta segura y cordial cuando se bloquea una consulta no autorizada.
 */
export function getSafeGuardRefusal(businessName: string): string {
	const name = businessName || 'la pastelería';
	return `¡Hola! Soy el asistente virtual de ${name}. Mis directivas e instrucciones internas son de carácter confidencial y privado. Con gusto puedo ayudarte a consultar nuestros productos, precios y tomar tu pedido. ¿En qué te puedo asesorar hoy? 🍰`;
}

/**
 * Sanitiza la respuesta de salida asegurando que bajo ninguna circunstancia se revele el prompt.
 */
export function sanitizeBotOutput(rawOutput: string, businessName: string): string {
	if (isPromptLeakedInResponse(rawOutput)) {
		console.warn('[PromptGuard] Intento de fuga de System Prompt interceptado y neutralizado con éxito.');
		return getSafeGuardRefusal(businessName);
	}
	return rawOutput;
}
