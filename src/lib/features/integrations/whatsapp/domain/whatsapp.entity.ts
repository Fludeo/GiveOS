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
