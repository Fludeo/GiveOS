import { DrizzleChatRepository } from '#lib/features/messaging/infrastructure/drizzle-chat.repository';
import type { ChatMessage, MessagingChannelId } from '#lib/features/messaging/domain/chat.entity';

const repo = new DrizzleChatRepository();

export interface ChatSessionWithMessages {
	id: string;
	phone: string;
	contactName: string;
	lastMessageText: string;
	lastMessageAt: number;
	unreadCount: number;
	messages: ChatMessage[];
}

export class DatabaseChatRepository {
	static getOrCreateSession(
		businessId: string,
		customerPhone: string,
		customerName?: string,
		channel: MessagingChannelId = 'whatsapp'
	): Promise<string> {
		return repo.getOrCreateSession(businessId, customerPhone, customerName, channel);
	}

	static saveIncomingMessage(input: {
		businessId: string;
		channel?: MessagingChannelId;
		customerPhone: string;
		senderName: string;
		text: string;
		timestamp: number;
		messageId?: string;
		rawKey?: any;
	}): Promise<ChatMessage> {
		return repo.saveIncomingMessage(input);
	}

	static saveOutgoingMessage(input: {
		businessId: string;
		channel?: MessagingChannelId;
		toPhone: string;
		text: string;
		isBot?: boolean;
		timestamp?: number;
		messageId?: string;
		rawKey?: any;
	}): Promise<ChatMessage> {
		return repo.saveOutgoingMessage(input);
	}

	static getConversationsWithMessages(
		businessId: string,
		channel?: MessagingChannelId
	): Promise<ChatMessage[]> {
		return repo.getConversationsWithMessages(businessId, channel);
	}

	static markSessionAsRead(
		businessId: string,
		customerPhone: string,
		messageIds?: string[],
		channel?: MessagingChannelId
	): Promise<void> {
		return repo.markSessionAsRead(businessId, customerPhone, messageIds, channel);
	}

	static markMessageAsRead(businessId: string, messageId: string): Promise<void> {
		return repo.markMessageAsRead(businessId, messageId);
	}

	static updateContactName(
		businessId: string,
		customerPhone: string,
		newName: string,
		channel?: MessagingChannelId
	): Promise<void> {
		return repo.updateContactName(businessId, customerPhone, newName, channel);
	}

	static clearChatHistory(
		businessId: string,
		customerPhone: string,
		channel?: MessagingChannelId
	): Promise<void> {
		return repo.clearChatHistory(businessId, customerPhone, channel);
	}
}
