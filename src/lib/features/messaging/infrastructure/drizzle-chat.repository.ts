import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '#lib/server/db/index';
import { chatSessions, chatMessages } from '#lib/server/db/schema';
import {
	contactsMatch,
	type ChatMessage,
	type MessagingChannelId
} from '../domain/chat.entity';
import type {
	ChatRepository,
	SaveIncomingMessageInput,
	SaveOutgoingMessageInput
} from '../domain/chat.repository';

function normalizeContactId(contact: string, channel: MessagingChannelId = 'whatsapp'): string {
	const trimmed = contact.trim();
	if (channel === 'whatsapp') {
		return trimmed.replace(/\D/g, '') || trimmed;
	}
	return trimmed;
}

export class DrizzleChatRepository implements ChatRepository {
	async getOrCreateSession(
		businessId: string,
		customerPhone: string,
		customerName?: string,
		channel: MessagingChannelId = 'whatsapp'
	): Promise<string> {
		const db = getDb();
		const cleanContact = normalizeContactId(customerPhone, channel);

		const existing = await db.query.chatSessions.findFirst({
			where: and(
				eq(chatSessions.businessId, businessId),
				eq(chatSessions.customerPhone, cleanContact),
				eq(chatSessions.channel, channel)
			)
		});

		if (existing) {
			if (customerName && customerName !== cleanContact && existing.customerName !== customerName) {
				await db
					.update(chatSessions)
					.set({ customerName, updatedAt: new Date() })
					.where(eq(chatSessions.id, existing.id));
			}
			return existing.id;
		}

		const newId = uuidv7();
		await db.insert(chatSessions).values({
			id: newId,
			businessId,
			channel,
			customerPhone: cleanContact,
			customerName: customerName || cleanContact,
			lastMessageText: '',
			lastMessageAt: new Date(),
			unreadCount: 0,
			createdAt: new Date(),
			updatedAt: new Date()
		});

		return newId;
	}

	async saveIncomingMessage(input: SaveIncomingMessageInput): Promise<ChatMessage> {
		const db = getDb();
		const channel = input.channel || 'whatsapp';
		const cleanContact = normalizeContactId(input.customerPhone, channel);
		const sessionId = await this.getOrCreateSession(
			input.businessId,
			cleanContact,
			input.senderName,
			channel
		);

		const msgId = input.messageId || uuidv7();

		if (input.messageId) {
			const existingMsg = await db.query.chatMessages.findFirst({
				where: eq(chatMessages.id, input.messageId)
			});
			if (existingMsg) {
				return {
					id: existingMsg.id,
					businessId: existingMsg.businessId,
					channel,
					from: cleanContact,
					senderName: existingMsg.senderName,
					text: existingMsg.text,
					fromMe: existingMsg.fromMe,
					timestamp: existingMsg.timestamp.getTime(),
					isRead: existingMsg.isRead,
					key: existingMsg.rawKey as any
				};
			}
		}

		const msgDate = new Date(input.timestamp);

		await db.insert(chatMessages).values({
			id: msgId,
			sessionId,
			businessId: input.businessId,
			fromMe: false,
			senderName: input.senderName || cleanContact,
			text: input.text,
			isRead: false,
			rawKey: input.rawKey || null,
			timestamp: msgDate,
			createdAt: new Date()
		});

		const session = await db.query.chatSessions.findFirst({
			where: eq(chatSessions.id, sessionId)
		});

		const currentUnread = session?.unreadCount ?? 0;
		await db
			.update(chatSessions)
			.set({
				lastMessageText: input.text,
				lastMessageAt: msgDate,
				unreadCount: currentUnread + 1,
				updatedAt: new Date()
			})
			.where(eq(chatSessions.id, sessionId));

		return {
			id: msgId,
			businessId: input.businessId,
			channel,
			from: cleanContact,
			senderName: input.senderName || cleanContact,
			text: input.text,
			fromMe: false,
			timestamp: input.timestamp,
			isRead: false,
			key: input.rawKey
		};
	}

	async saveOutgoingMessage(input: SaveOutgoingMessageInput): Promise<ChatMessage> {
		const db = getDb();
		const channel = input.channel || 'whatsapp';
		const cleanContact = normalizeContactId(input.toPhone, channel);
		const sessionId = await this.getOrCreateSession(
			input.businessId,
			cleanContact,
			undefined,
			channel
		);

		const msgId = input.messageId || uuidv7();

		if (input.messageId) {
			const existingMsg = await db.query.chatMessages.findFirst({
				where: eq(chatMessages.id, input.messageId)
			});
			if (existingMsg) {
				return {
					id: existingMsg.id,
					businessId: existingMsg.businessId,
					channel,
					from: cleanContact,
					senderName: existingMsg.senderName,
					text: existingMsg.text,
					fromMe: true,
					isBot: existingMsg.isBot,
					timestamp: existingMsg.timestamp.getTime(),
					isRead: true,
					key: existingMsg.rawKey as any
				};
			}
		}

		const now = input.timestamp || Date.now();
		const msgDate = new Date(now);
		const isBotMessage = input.isBot ?? false;

		await db.insert(chatMessages).values({
			id: msgId,
			sessionId,
			businessId: input.businessId,
			fromMe: true,
			isBot: isBotMessage,
			senderName: isBotMessage ? 'Bot IA' : 'Yo (GiveOS)',
			text: input.text,
			isRead: true,
			rawKey: input.rawKey || null,
			timestamp: msgDate,
			createdAt: new Date()
		});

		await db
			.update(chatSessions)
			.set({
				lastMessageText: input.text,
				lastMessageAt: msgDate,
				updatedAt: new Date()
			})
			.where(eq(chatSessions.id, sessionId));

		return {
			id: msgId,
			businessId: input.businessId,
			channel,
			from: cleanContact,
			senderName: isBotMessage ? 'Bot IA' : 'Yo (GiveOS)',
			text: input.text,
			fromMe: true,
			isBot: isBotMessage,
			timestamp: now,
			isRead: true,
			key: input.rawKey
		};
	}

	async getConversationsWithMessages(
		businessId: string,
		channel?: MessagingChannelId
	): Promise<ChatMessage[]> {
		const db = getDb();

		const conditions = [eq(chatMessages.businessId, businessId)];
		if (channel) {
			conditions.push(eq(chatSessions.channel, channel));
		}

		const messages = await db
			.select({
				id: chatMessages.id,
				businessId: chatMessages.businessId,
				channel: chatSessions.channel,
				fromMe: chatMessages.fromMe,
				isBot: chatMessages.isBot,
				senderName: chatMessages.senderName,
				text: chatMessages.text,
				isRead: chatMessages.isRead,
				rawKey: chatMessages.rawKey,
				timestamp: chatMessages.timestamp,
				customerPhone: chatSessions.customerPhone,
				customerName: chatSessions.customerName
			})
			.from(chatMessages)
			.innerJoin(chatSessions, eq(chatMessages.sessionId, chatSessions.id))
			.where(and(...conditions))
			.orderBy(desc(chatMessages.timestamp))
			.limit(300);

		return messages.map((m) => ({
			id: m.id,
			businessId: m.businessId,
			channel: (m.channel as MessagingChannelId) || 'whatsapp',
			from: m.customerPhone,
			senderName: m.customerName || m.senderName,
			text: m.text,
			fromMe: m.fromMe,
			isBot: m.isBot,
			timestamp: m.timestamp.getTime(),
			isRead: m.isRead,
			key: m.rawKey as any
		}));
	}

	async markSessionAsRead(
		businessId: string,
		customerPhone: string,
		messageIds?: string[],
		channel?: MessagingChannelId
	): Promise<void> {
		const db = getDb();
		const cleanContact = normalizeContactId(customerPhone, channel);

		// 1. Si se especifican messageIds directos, actualizarlos en lote
		if (messageIds && messageIds.length > 0) {
			await db
				.update(chatMessages)
				.set({ isRead: true })
				.where(
					and(
						eq(chatMessages.businessId, businessId),
						inArray(chatMessages.id, messageIds)
					)
				);

			const affectedMessages = await db.query.chatMessages.findMany({
				where: and(
					eq(chatMessages.businessId, businessId),
					inArray(chatMessages.id, messageIds)
				),
				columns: { sessionId: true }
			});
			const sessionIds = Array.from(new Set(affectedMessages.map((m) => m.sessionId)));
			for (const sid of sessionIds) {
				const unread = await db
					.select({ count: sql<number>`count(*)::int` })
					.from(chatMessages)
					.where(
						and(
							eq(chatMessages.sessionId, sid),
							eq(chatMessages.fromMe, false),
							eq(chatMessages.isRead, false)
						)
					);
				const remaining = unread[0]?.count ?? 0;
				await db
					.update(chatSessions)
					.set({ unreadCount: remaining, updatedAt: new Date() })
					.where(eq(chatSessions.id, sid));
			}
		}

		// 2. Si se proporcionó un identificador de contacto, buscar todas las sesiones coincidentes
		if (cleanContact) {
			const conditions = [eq(chatSessions.businessId, businessId)];
			if (channel) {
				conditions.push(eq(chatSessions.channel, channel));
			}
			const sessions = await db.query.chatSessions.findMany({
				where: and(...conditions)
			});

			const matchingSessions = sessions.filter((s) =>
				contactsMatch(s.customerPhone, cleanContact)
			);

			for (const session of matchingSessions) {
				await db
					.update(chatMessages)
					.set({ isRead: true })
					.where(eq(chatMessages.sessionId, session.id));

				await db
					.update(chatSessions)
					.set({ unreadCount: 0, updatedAt: new Date() })
					.where(eq(chatSessions.id, session.id));
			}
		}
	}

	async markMessageAsRead(businessId: string, messageId: string): Promise<void> {
		const db = getDb();
		const msg = await db.query.chatMessages.findFirst({
			where: and(
				eq(chatMessages.id, messageId),
				eq(chatMessages.businessId, businessId)
			)
		});

		if (!msg) return;

		await db
			.update(chatMessages)
			.set({ isRead: true })
			.where(eq(chatMessages.id, msg.id));

		const unreadRemaining = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(chatMessages)
			.where(
				and(
					eq(chatMessages.sessionId, msg.sessionId),
					eq(chatMessages.fromMe, false),
					eq(chatMessages.isRead, false)
				)
			);

		const remainingCount = unreadRemaining[0]?.count ?? 0;

		await db
			.update(chatSessions)
			.set({ unreadCount: remainingCount, updatedAt: new Date() })
			.where(eq(chatSessions.id, msg.sessionId));
	}

	async updateContactName(
		businessId: string,
		customerPhone: string,
		newName: string,
		channel?: MessagingChannelId
	): Promise<void> {
		const db = getDb();
		const cleanContact = normalizeContactId(customerPhone, channel);
		const trimmedName = newName.trim();
		if (!trimmedName) return;

		const conditions = [
			eq(chatSessions.businessId, businessId),
			eq(chatSessions.customerPhone, cleanContact)
		];
		if (channel) {
			conditions.push(eq(chatSessions.channel, channel));
		}

		await db
			.update(chatSessions)
			.set({ customerName: trimmedName, updatedAt: new Date() })
			.where(and(...conditions));
	}

	async clearChatHistory(
		businessId: string,
		customerPhone: string,
		channel?: MessagingChannelId
	): Promise<void> {
		const db = getDb();
		const cleanContact = normalizeContactId(customerPhone, channel);

		const conditions = [
			eq(chatSessions.businessId, businessId),
			eq(chatSessions.customerPhone, cleanContact)
		];
		if (channel) {
			conditions.push(eq(chatSessions.channel, channel));
		}

		const session = await db.query.chatSessions.findFirst({
			where: and(...conditions)
		});

		if (!session) return;

		await db.delete(chatSessions).where(eq(chatSessions.id, session.id));
	}
}
