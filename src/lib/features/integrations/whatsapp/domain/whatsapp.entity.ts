export type WhatsAppSessionStatus = 'disconnected' | 'connecting' | 'scanning_qr' | 'connected';

export interface WhatsAppMessageKey {
	remoteJid?: string | null;
	id?: string | null;
	fromMe?: boolean | null;
	participant?: string | null;
}

export interface WhatsAppMessage {
	id: string;
	businessId: string;
	from: string;
	senderName: string;
	text: string;
	fromMe: boolean;
	isBot?: boolean;
	timestamp: number;
	isRead: boolean;
	key: WhatsAppMessageKey;
}

export interface WhatsAppSessionInfo {
	businessId: string;
	status: WhatsAppSessionStatus;
	phone: string | null;
	pushName: string | null;
	qr: string | null;
	connectedAt: string | null;
	messages: WhatsAppMessage[];
}

export type RealtimeEvent =
	| {
			type: 'whatsapp:qr';
			businessId: string;
			qr: string;
	  }
	| {
			type: 'whatsapp:status';
			businessId: string;
			status: WhatsAppSessionStatus;
			phone?: string | null;
			pushName?: string | null;
	  }
	| {
			type: 'whatsapp:message';
			businessId: string;
			message: WhatsAppMessage;
	  };

/**
 * Normaliza y compara dos números de teléfono o identificadores para determinar si corresponden al mismo contacto.
 * Maneja diferencias de formato (+, espacios, guiones), prefijos móviles como el '9' de Argentina (+549 vs +54),
 * y coincidencia por sufijo / últimos 8 a 10 dígitos significativos.
 */
export function phonesMatch(p1?: string | null, p2?: string | null): boolean {
	if (!p1 || !p2) return false;
	const d1 = p1.replace(/\D/g, '');
	const d2 = p2.replace(/\D/g, '');
	if (!d1 || !d2) return false;
	if (d1 === d2) return true;
	if (d1.endsWith(d2) || d2.endsWith(d1)) return true;

	// Comparar últimos dígitos significativos para abonados de telefonía móvil
	if (d1.length >= 8 && d2.length >= 8) {
		const compareLen = Math.min(10, Math.min(d1.length, d2.length));
		if (d1.slice(-compareLen) === d2.slice(-compareLen)) {
			return true;
		}
	}

	return false;
}

