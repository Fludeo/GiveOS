import type {
	MessagingChannelId,
	ChatMessage,
	ChatMessageKey,
	ChannelSessionInfo
} from './chat.entity';

/**
 * Puerto de salida (Hexagonal Architecture) para cualquier canal de mensajería
 * (WhatsApp, Telegram, Instagram, WebChat, etc.).
 */
export interface MessagingChannelPort {
	readonly channelId: MessagingChannelId;

	/**
	 * Envía un mensaje saliente a través del canal externo y devuelve el mensaje persistido.
	 */
	sendMessage(
		businessId: string,
		toContact: string,
		text: string,
		isBot?: boolean
	): Promise<ChatMessage>;

	/**
	 * Notifica estado de escritura o pausa en el canal externo (opcional según soporte del canal).
	 */
	sendPresenceUpdate?(
		businessId: string,
		toContact: string,
		state: 'composing' | 'paused',
		remoteHandle?: string
	): Promise<void>;

	/**
	 * Marca una conversación completa como leída tanto en base de datos como en el canal externo.
	 */
	markSessionAsRead(
		businessId: string,
		contactId: string,
		messageIds?: string[]
	): Promise<boolean>;

	/**
	 * Marca un mensaje puntual como leído.
	 */
	markAsRead(
		businessId: string,
		messageKey?: ChatMessageKey,
		messageId?: string
	): Promise<boolean>;

	/**
	 * Limpia el historial de mensajes de un contacto en este canal.
	 */
	clearChatHistory(businessId: string, contactId: string): Promise<void>;

	/**
	 * Obtiene la información de estado de sesión del canal para un negocio.
	 */
	getSessionInfo?(businessId: string): ChannelSessionInfo;
}
