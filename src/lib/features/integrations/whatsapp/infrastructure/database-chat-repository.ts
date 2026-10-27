import { eq, and, desc } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '#lib/server/db/index';
import { chatSessions, chatMessages } from '#lib/server/db/schema';
import type { WhatsAppMessage } from '../domain/whatsapp.entity';

export interface ChatSessionWithMessages {
	id: string;
	phone: string;
	contactName: string;
	lastMessageText: string;
	lastMessageAt: number;
	unreadCount: number;
	messages: WhatsAppMessage[];
}

export class DatabaseChatRepository {
	/**
	 * Obtiene o crea la sesión/conversación del cliente
	 */
	static async getOrCreateSession(
		businessId: string,
		customerPhone: string,
		customerName?: string
	): Promise<string> {
		const db = getDb();
		const cleanPhone = customerPhone.replace(/\D/g, '');

		const existing = await db.query.chatSessions.findFirst({
			where: and(
				eq(chatSessions.businessId, businessId),
				eq(chatSessions.customerPhone, cleanPhone),
				eq(chatSessions.channel, 'whatsapp')
			)
		});

		if (existing) {
			if (customerName && customerName !== cleanPhone && existing.customerName !== customerName) {
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
			channel: 'whatsapp',
			customerPhone: cleanPhone,
			customerName: customerName || cleanPhone,
			lastMessageText: '',
			lastMessageAt: new Date(),
			unreadCount: 0,
			createdAt: new Date(),
			updatedAt: new Date()
		});

		return newId;
	}

	/**
	 * Guarda un mensaje entrante (del cliente hacia nosotros)
	 */
	static async saveIncomingMessage(input: {
		businessId: string;
		customerPhone: string;
		senderName: string;
		text: string;
		timestamp: number;
		messageId?: string;
		rawKey?: any;
	}): Promise<WhatsAppMessage> {
		const db = getDb();
		const cleanPhone = input.customerPhone.replace(/\D/g, '');
		const sessionId = await this.getOrCreateSession(input.businessId, cleanPhone, input.senderName);

		const msgId = input.messageId || uuidv7();

		if (input.messageId) {
			const existingMsg = await db.query.chatMessages.findFirst({
				where: eq(chatMessages.id, input.messageId)
			});
			if (existingMsg) {
				return {
					id: existingMsg.id,
					businessId: existingMsg.businessId,
					from: cleanPhone,
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
			senderName: input.senderName || cleanPhone,
			text: input.text,
			isRead: false,
			rawKey: input.rawKey || null,
			timestamp: msgDate,
			createdAt: new Date()
		});

		// Actualizar sesión: último mensaje y sumar no leído
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
			from: cleanPhone,
			senderName: input.senderName || cleanPhone,
			text: input.text,
			fromMe: false,
			timestamp: input.timestamp,
			isRead: false,
			key: input.rawKey
		};
	}

	/**
	 * Guarda un mensaje saliente (enviado por GiveOS al cliente)
	 */
	static async saveOutgoingMessage(input: {
		businessId: string;
		toPhone: string;
		text: string;
		messageId?: string;
		rawKey?: any;
	}): Promise<WhatsAppMessage> {
		const db = getDb();
		const cleanPhone = input.toPhone.replace(/\D/g, '');
		const sessionId = await this.getOrCreateSession(input.businessId, cleanPhone);

		const msgId = input.messageId || uuidv7();
		const now = Date.now();
		const msgDate = new Date(now);

		await db.insert(chatMessages).values({
			id: msgId,
			sessionId,
			businessId: input.businessId,
			fromMe: true,
			senderName: 'Yo (GiveOS)',
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
			from: cleanPhone,
			senderName: 'Yo (GiveOS)',
			text: input.text,
			fromMe: true,
			timestamp: now,
			isRead: true,
			key: input.rawKey
		};
	}

	/**
	 * Obtiene todas las conversaciones y sus mensajes para la pantalla
	 */
	static async getConversationsWithMessages(businessId: string): Promise<WhatsAppMessage[]> {
		const db = getDb();

		const messages = await db
			.select({
				id: chatMessages.id,
				businessId: chatMessages.businessId,
				fromMe: chatMessages.fromMe,
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
			.where(eq(chatMessages.businessId, businessId))
			.orderBy(desc(chatMessages.timestamp))
			.limit(300);

		return messages.map((m) => ({
			id: m.id,
			businessId: m.businessId,
			from: m.customerPhone,
			senderName: m.customerName || m.senderName,
			text: m.text,
			fromMe: m.fromMe,
			timestamp: m.timestamp.getTime(),
			isRead: m.isRead,
			key: m.rawKey as any
		}));
	}

	/**
	 * Marca todos los mensajes de una conversación como leídos
	 */
	static async markSessionAsRead(businessId: string, customerPhone: string): Promise<void> {
		const db = getDb();
		const cleanPhone = customerPhone.replace(/\D/g, '');

		const session = await db.query.chatSessions.findFirst({
			where: and(
				eq(chatSessions.businessId, businessId),
				eq(chatSessions.customerPhone, cleanPhone)
			)
		});

		if (!session) return;

		await db
			.update(chatMessages)
			.set({ isRead: true })
			.where(eq(chatMessages.sessionId, session.id));

		await db
			.update(chatSessions)
			.set({ unreadCount: 0, updatedAt: new Date() })
			.where(eq(chatSessions.id, session.id));
	}

	/**
	 * Actualiza el nombre personalizado del contacto / sesión
	 */
	static async updateContactName(businessId: string, customerPhone: string, newName: string): Promise<void> {
		const db = getDb();
		const cleanPhone = customerPhone.replace(/\D/g, '');
		const trimmedName = newName.trim();
		if (!trimmedName) return;

		await db
			.update(chatSessions)
			.set({ customerName: trimmedName, updatedAt: new Date() })
			.where(
				and(
					eq(chatSessions.businessId, businessId),
					eq(chatSessions.customerPhone, cleanPhone)
				)
			);
	}

	/**
	 * Borra el historial completo de mensajes de un chat específico
	 */
	static async clearChatHistory(businessId: string, customerPhone: string): Promise<void> {
		const db = getDb();
		const cleanPhone = customerPhone.replace(/\D/g, '');

		const session = await db.query.chatSessions.findFirst({
			where: and(
				eq(chatSessions.businessId, businessId),
				eq(chatSessions.customerPhone, cleanPhone)
			)
		});

		if (!session) return;

		// Eliminar la sesión eliminará automáticamente en cascada todos sus mensajes
		await db.delete(chatSessions).where(eq(chatSessions.id, session.id));
	}
}
