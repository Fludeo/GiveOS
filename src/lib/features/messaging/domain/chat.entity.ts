export type MessagingChannelId = 'whatsapp' | 'telegram' | 'instagram' | 'web' | (string & {});

export type ChannelSessionStatus = 'disconnected' | 'connecting' | 'scanning_qr' | 'connected';

export interface ChatMessageKey {
	remoteJid?: string | null;
	id?: string | null;
	fromMe?: boolean | null;
	participant?: string | null;
	[key: string]: unknown;
}

export interface ChatMessage {
	id: string;
	businessId: string;
	channel: MessagingChannelId;
	from: string;
	senderName: string;
	text: string;
	fromMe: boolean;
	isBot?: boolean;
	timestamp: number;
	isRead: boolean;
	key?: ChatMessageKey;
}

export interface ChannelSessionInfo {
	businessId: string;
	channel: MessagingChannelId;
	status: ChannelSessionStatus;
	phone: string | null;
	pushName: string | null;
	qr: string | null;
	connectedAt: string | null;
	messages: ChatMessage[];
}

export type RealtimeChatEvent =
	| {
			type: 'chat:message' | 'whatsapp:message';
			businessId: string;
			channel?: MessagingChannelId;
			message: ChatMessage;
	  }
	| {
			type: 'chat:session_read' | 'whatsapp:session_read';
			businessId: string;
			channel?: MessagingChannelId;
			phone: string;
	  }
	| {
			type: 'chat:message_cleared' | 'whatsapp:message_cleared';
			businessId: string;
			channel?: MessagingChannelId;
			phone: string;
	  }
	| {
			type: 'chat:unconfirmed_order_created' | 'whatsapp:unconfirmed_order_created';
			businessId: string;
			channel?: MessagingChannelId;
			phone: string;
			order: any;
	  }
	| {
			type: 'chat:proof_submitted' | 'whatsapp:proof_submitted';
			businessId: string;
			channel?: MessagingChannelId;
			phone: string;
	  }
	| {
			type: 'whatsapp:qr';
			businessId: string;
			qr: string;
	  }
	| {
			type: 'whatsapp:status';
			businessId: string;
			status: ChannelSessionStatus;
			phone?: string | null;
			pushName?: string | null;
	  };

/**
 * Normaliza y compara dos números de teléfono o identificadores de contacto para determinar si corresponden al mismo contacto.
 * Maneja diferencias de formato (+, espacios, guiones), prefijos móviles como el '9' de Argentina (+549 vs +54),
 * y coincidencia por sufijo / últimos 8 a 10 dígitos significativos, o igualdad exacta para identificadores alfanuméricos.
 */
export function contactsMatch(c1?: string | null, c2?: string | null): boolean {
	if (!c1 || !c2) return false;
	const t1 = c1.trim();
	const t2 = c2.trim();
	if (!t1 || !t2) return false;
	if (t1 === t2) return true;

	const d1 = t1.replace(/\D/g, '');
	const d2 = t2.replace(/\D/g, '');
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
