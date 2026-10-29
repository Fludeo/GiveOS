import { eq } from 'drizzle-orm';
import { getDb } from '#lib/server/db/index';
import { businesses, orders, orderItems } from '#lib/server/db/schema';
import { getEcommerceBotService } from '#lib/features/ai/application/ecommerce-bot.service';
import { getHumanDelaySeconds } from '#lib/features/ai/domain/human-delay.utils';
import {
	contactsMatch,
	type ChatMessage,
	type ChatMessageKey,
	type MessagingChannelId,
	type RealtimeChatEvent
} from '../domain/chat.entity';
import type { ChatRepository } from '../domain/chat.repository';
import type { MessagingChannelPort } from '../domain/messaging-channel.port';
import { DrizzleChatRepository } from '../infrastructure/drizzle-chat.repository';

export class ChatService {
	private adapters = new Map<MessagingChannelId, MessagingChannelPort>();
	private listenersByBusiness = new Map<string, Set<(event: RealtimeChatEvent) => void>>();
	private botDebounceTimers = new Map<string, NodeJS.Timeout>();

	constructor(private readonly chatRepository: ChatRepository = new DrizzleChatRepository()) {}

	registerChannelAdapter(adapter: MessagingChannelPort): void {
		this.adapters.set(adapter.channelId, adapter);
	}

	getChannelAdapter(channel: MessagingChannelId = 'whatsapp'): MessagingChannelPort | undefined {
		return this.adapters.get(channel);
	}

	subscribe(businessId: string, listener: (event: RealtimeChatEvent) => void): () => void {
		let set = this.listenersByBusiness.get(businessId);
		if (!set) {
			set = new Set();
			this.listenersByBusiness.set(businessId, set);
		}
		set.add(listener);
		return () => {
			set?.delete(listener);
		};
	}

	broadcast(businessId: string, event: RealtimeChatEvent): void {
		const set = this.listenersByBusiness.get(businessId);
		if (!set) return;
		for (const listener of set) {
			try {
				listener(event);
			} catch (err) {
				console.error('[ChatService] Error en listener SSE:', err);
			}
		}
	}

	/**
	 * Cancela cualquier respuesta programada del bot para un contacto (ej. cuando un humano interviene).
	 */
	cancelPendingBotResponse(
		businessId: string,
		contactId: string,
		channel: MessagingChannelId = 'whatsapp'
	): void {
		const timerKey = `${businessId}:${channel}:${contactId}`;
		const pendingTimer = this.botDebounceTimers.get(timerKey);
		if (pendingTimer) {
			clearTimeout(pendingTimer);
			this.botDebounceTimers.delete(timerKey);
			console.log(
				`[ChatService] Intervención humana en ${channel} (${contactId}). Cancelando respuesta programada del bot.`
			);
		}
	}

	/**
	 * Programa la respuesta del bot de IA con debounce humano (7 a 10 segundos) para cualquier canal.
	 */
	scheduleBotResponse(params: {
		businessId: string;
		channel: MessagingChannelId;
		customerPhone: string;
		customerName: string;
		remoteHandle?: string;
		getRecentMessages?: () => ChatMessage[];
		onOrderCreated?: (order: any) => void;
		onProofSubmitted?: (phone: string) => void;
	}): void {
		const { businessId, channel, customerPhone, customerName } = params;

		(async () => {
			try {
				const db = getDb();
				const biz = await db.query.businesses.findFirst({
					where: eq(businesses.id, businessId)
				});
				const botConfig = biz?.settings?.integrations?.bot;

				if (!botConfig?.enabled) return;

				const timerKey = `${businessId}:${channel}:${customerPhone}`;
				const existingTimer = this.botDebounceTimers.get(timerKey);
				if (existingTimer) {
					clearTimeout(existingTimer);
					this.botDebounceTimers.delete(timerKey);
					console.log(
						`[ChatService] Mensaje adicional en ${channel} de "${customerName}" (${customerPhone}). Reiniciando temporizador humano.`
					);
				}

				const delaySec = getHumanDelaySeconds(7, 10);
				const delayMs = Math.round(delaySec * 1000);
				console.log(
					`[ChatService] Programando respuesta de bot en ${channel} para "${customerName}" (${customerPhone}) en ${delaySec}s...`
				);

				const timer = setTimeout(async () => {
					this.botDebounceTimers.delete(timerKey);
					await this.processDebouncedBotResponse({
						...params,
						botConfig
					});
				}, delayMs);

				this.botDebounceTimers.set(timerKey, timer);
			} catch (err) {
				console.error('[ChatService] Error programando bot con delay:', err);
			}
		})();
	}

	private async processDebouncedBotResponse(params: {
		businessId: string;
		channel: MessagingChannelId;
		customerPhone: string;
		customerName: string;
		remoteHandle?: string;
		botConfig: any;
		getRecentMessages?: () => ChatMessage[];
		onOrderCreated?: (order: any) => void;
		onProofSubmitted?: (phone: string) => void;
	}): Promise<void> {
		const {
			businessId,
			channel,
			customerPhone,
			customerName,
			remoteHandle,
			botConfig,
			getRecentMessages,
			onOrderCreated,
			onProofSubmitted
		} = params;

		const adapter = this.getChannelAdapter(channel);

		try {
			// 1. Obtener mensajes del contacto (de memoria del adaptador o desde BD)
			const allMsgs = getRecentMessages
				? getRecentMessages()
				: await this.chatRepository.getConversationsWithMessages(businessId, channel);

			const contactMsgs = allMsgs.filter((m) => contactsMatch(m.from, customerPhone));
			if (contactMsgs.length === 0) return;

			// 2. Mensajes consecutivos del cliente desde nuestra última respuesta
			const lastAssistantIndex = contactMsgs.findIndex((m) => m.fromMe);
			const unrepliedUserMsgs = (
				lastAssistantIndex === -1 ? contactMsgs : contactMsgs.slice(0, lastAssistantIndex)
			)
				.filter((m) => !m.fromMe)
				.reverse();

			if (unrepliedUserMsgs.length === 0) return;

			const combinedText = unrepliedUserMsgs
				.map((m) => m.text.trim())
				.filter(Boolean)
				.join('\n');

			if (!combinedText) return;

			// 3. Historial conversacional previo
			const historySource = (
				lastAssistantIndex === -1
					? []
					: contactMsgs.slice(lastAssistantIndex, lastAssistantIndex + 10)
			).reverse();

			const chatHistory = historySource.map((msg) => ({
				role: msg.fromMe ? ('assistant' as const) : ('user' as const),
				text: msg.text
			}));

			// 4. Evaluar aviso de comprobante de pago
			const normalized = combinedText.toLowerCase();
			if (
				normalized.includes('comprobante enviado') ||
				normalized === 'comprobante' ||
				normalized === 'ya transferí' ||
				normalized === 'transferido'
			) {
				const reply = `¡Muchas gracias ${customerName}! ✨ Recibimos tu aviso de pago. Un encargado del negocio está verificando la transferencia en la cuenta para confirmar tu pedido a la brevedad.`;
				if (adapter) {
					await adapter.sendMessage(businessId, customerPhone, reply, true);
				}

				onProofSubmitted?.(customerPhone);
				this.broadcast(businessId, {
					type: 'whatsapp:proof_submitted',
					businessId,
					channel,
					phone: customerPhone
				});
				return;
			}

			// 5. Simular presencia humana ("Escribiendo...") en el canal si lo soporta
			if (adapter?.sendPresenceUpdate) {
				await adapter
					.sendPresenceUpdate(businessId, customerPhone, 'composing', remoteHandle)
					.catch(() => {});
			}

			console.log(
				`[ChatService] Procesando mensajes acumulados (${channel}) de "${customerName}" (${customerPhone}):\n"${combinedText}"`
			);

			// 6. Ejecutar el servicio de Bot de IA agnóstico al canal
			const botService = getEcommerceBotService();
			const botOutput = await botService.processMessage({
				businessId,
				channel,
				customerPhone,
				customerName,
				messageText: combinedText,
				chatHistory,
				customSystemPrompt: botConfig?.systemPrompt
			});

			// 7. Pausar presencia y enviar respuesta por el adaptador del canal
			if (adapter?.sendPresenceUpdate) {
				await adapter
					.sendPresenceUpdate(businessId, customerPhone, 'paused', remoteHandle)
					.catch(() => {});
			}

			if (botOutput.replyText && adapter) {
				await adapter.sendMessage(businessId, customerPhone, botOutput.replyText, true);
			}

			if (botOutput.orderCreated) {
				const db = getDb();
				const fullOrder = await db.query.orders.findFirst({
					where: eq(orders.id, botOutput.orderCreated.orderId)
				});
				const items = await db.query.orderItems.findMany({
					where: eq(orderItems.orderId, botOutput.orderCreated.orderId)
				});

				const enrichedOrder = {
					...(fullOrder || botOutput.orderCreated),
					items: items || []
				};

				onOrderCreated?.(enrichedOrder);
				this.broadcast(businessId, {
					type: 'whatsapp:unconfirmed_order_created',
					businessId,
					channel,
					phone: customerPhone,
					order: enrichedOrder
				});
			}
		} catch (err) {
			console.error('[ChatService] Error ejecutando bot de IA tras espera humana:', err);
		}
	}

	async sendMessage(
		businessId: string,
		toContact: string,
		text: string,
		channel: MessagingChannelId = 'whatsapp',
		isBot = false
	): Promise<ChatMessage> {
		this.cancelPendingBotResponse(businessId, toContact, channel);
		const adapter = this.getChannelAdapter(channel);
		if (!adapter) {
			throw new Error(`No hay un adaptador registrado para el canal "${channel}".`);
		}
		return adapter.sendMessage(businessId, toContact, text, isBot);
	}

	async getConversationsWithMessages(
		businessId: string,
		channel?: MessagingChannelId
	): Promise<ChatMessage[]> {
		return this.chatRepository.getConversationsWithMessages(businessId, channel);
	}

	async markSessionAsRead(
		businessId: string,
		contactId: string,
		messageIds?: string[],
		channel: MessagingChannelId = 'whatsapp'
	): Promise<boolean> {
		const adapter = this.getChannelAdapter(channel);
		if (adapter) {
			return adapter.markSessionAsRead(businessId, contactId, messageIds);
		}
		await this.chatRepository.markSessionAsRead(businessId, contactId, messageIds, channel);
		return true;
	}

	async markAsRead(
		businessId: string,
		messageKey?: ChatMessageKey,
		messageId?: string,
		channel: MessagingChannelId = 'whatsapp'
	): Promise<boolean> {
		const adapter = this.getChannelAdapter(channel);
		if (adapter) {
			return adapter.markAsRead(businessId, messageKey, messageId);
		}
		if (messageId) {
			await this.chatRepository.markMessageAsRead(businessId, messageId);
		}
		return true;
	}

	async updateContactName(
		businessId: string,
		contactId: string,
		newName: string,
		channel?: MessagingChannelId
	): Promise<void> {
		await this.chatRepository.updateContactName(businessId, contactId, newName, channel);
	}

	async clearChatHistory(
		businessId: string,
		contactId: string,
		channel: MessagingChannelId = 'whatsapp'
	): Promise<void> {
		const adapter = this.getChannelAdapter(channel);
		if (adapter) {
			await adapter.clearChatHistory(businessId, contactId);
			return;
		}
		await this.chatRepository.clearChatHistory(businessId, contactId, channel);
	}
}

const globalForChatService = globalThis as unknown as {
	_chatService?: ChatService;
};

export function getChatService(): ChatService {
	if (!globalForChatService._chatService) {
		globalForChatService._chatService = new ChatService();
	} else {
		Object.setPrototypeOf(globalForChatService._chatService, ChatService.prototype);
	}
	return globalForChatService._chatService;
}
