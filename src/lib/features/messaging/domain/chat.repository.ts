import type { MessagingChannelId, ChatMessage } from './chat.entity';

export interface SaveIncomingMessageInput {
	businessId: string;
	channel?: MessagingChannelId;
	customerPhone: string;
	senderName: string;
	text: string;
	timestamp: number;
	messageId?: string;
	rawKey?: any;
}

export interface SaveOutgoingMessageInput {
	businessId: string;
	channel?: MessagingChannelId;
	toPhone: string;
	text: string;
	isBot?: boolean;
	timestamp?: number;
	messageId?: string;
	rawKey?: any;
}

export interface ChatRepository {
	getOrCreateSession(
		businessId: string,
		customerPhone: string,
		customerName?: string,
		channel?: MessagingChannelId
	): Promise<string>;

	saveIncomingMessage(input: SaveIncomingMessageInput): Promise<ChatMessage>;

	saveOutgoingMessage(input: SaveOutgoingMessageInput): Promise<ChatMessage>;

	getConversationsWithMessages(
		businessId: string,
		channel?: MessagingChannelId
	): Promise<ChatMessage[]>;

	markSessionAsRead(
		businessId: string,
		customerPhone: string,
		messageIds?: string[],
		channel?: MessagingChannelId
	): Promise<void>;

	markMessageAsRead(businessId: string, messageId: string): Promise<void>;

	updateContactName(
		businessId: string,
		customerPhone: string,
		newName: string,
		channel?: MessagingChannelId
	): Promise<void>;

	clearChatHistory(
		businessId: string,
		customerPhone: string,
		channel?: MessagingChannelId
	): Promise<void>;
}
