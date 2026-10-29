import makeWASocket, {
	DisconnectReason,
	fetchLatestBaileysVersion,
	type WASocket
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { eq } from 'drizzle-orm';
import { getDb } from '#lib/server/db/index';
import { businesses, whatsappAuthKeys } from '#lib/server/db/schema';
import {
	useDatabaseAuthState,
	getDatabaseSessionPhone,
	getAllActiveSessionBusinessIds
} from '../infrastructure/database-auth-state';
import { DatabaseChatRepository } from '../infrastructure/database-chat-repository';
import { getChatService } from '#lib/features/messaging/application/chat.service';
import type { MessagingChannelPort } from '#lib/features/messaging/domain/messaging-channel.port';
import {
	phonesMatch,
	type WhatsAppMessage,
	type WhatsAppMessageKey,
	type WhatsAppSessionInfo,
	type WhatsAppSessionStatus,
	type RealtimeEvent
} from '../domain/whatsapp.entity';

interface SessionHolder {
	businessId: string;
	sock: WASocket | null;
	status: WhatsAppSessionStatus;
	phone: string | null;
	pushName: string | null;
	qr: string | null;
	connectedAt: string | null;
	messages: WhatsAppMessage[];
	listeners: Set<(event: RealtimeEvent) => void>;
	connectingPromise: Promise<void> | null;
}

export class WhatsAppSessionManager implements MessagingChannelPort {
	readonly channelId = 'whatsapp' as const;
	private sessions = new Map<string, SessionHolder>();

	constructor() {
		// Registrar este adaptador en el servicio agnóstico de mensajería
		getChatService().registerChannelAdapter(this);

		// Auto-restaurar sesiones activas guardadas en PostgreSQL al iniciar el servidor
		setTimeout(() => {
			this.restoreAllSessions();
		}, 1500);
	}

	async restoreAllSessions(): Promise<void> {
		try {
			const activeBusinessIds = await getAllActiveSessionBusinessIds();
			for (const businessId of activeBusinessIds) {
				const holder = this.getOrCreateHolder(businessId);
				const { phone, pushName } = await getDatabaseSessionPhone(businessId);
				if (phone) {
					holder.phone = phone;
					holder.pushName = pushName;
				}

				if (holder.status !== 'connected' && !holder.sock) {
					holder.status = 'connecting';
					console.log(
						`[WhatsAppSessionManager] Auto-reconectando WhatsApp desde PostgreSQL para negocio ${businessId} (+${holder.phone})...`
					);
					this.connect(businessId).catch((err) =>
						console.error(`[WhatsAppSessionManager] Error al auto-conectar ${businessId}:`, err)
					);
				}
			}
		} catch (err) {
			console.error('[WhatsAppSessionManager] Error en restoreAllSessions:', err);
		}
	}

	private getOrCreateHolder(businessId: string): SessionHolder {
		let holder = this.sessions.get(businessId);
		if (!holder) {
			holder = {
				businessId,
				sock: null,
				status: 'disconnected',
				phone: null,
				pushName: null,
				qr: null,
				connectedAt: null,
				messages: [],
				listeners: new Set(),
				connectingPromise: null
			};
			this.sessions.set(businessId, holder);
		}
		return holder;
	}

	getSessionInfo(businessId: string): WhatsAppSessionInfo & { channel: 'whatsapp' } {
		const holder = this.getOrCreateHolder(businessId);

		// Si el socket en RAM no está activo, verificar si existen credenciales en PostgreSQL para auto-reconectar
		if (holder.status === 'disconnected' && !holder.sock && !holder.connectingPromise) {
			(async () => {
				const { phone, pushName } = await getDatabaseSessionPhone(businessId);
				if (phone) {
					holder.phone = phone;
					holder.pushName = pushName;
					holder.status = 'connecting';
					this.broadcast(holder, {
						type: 'whatsapp:status',
						businessId,
						status: 'connecting',
						phone,
						pushName
					});
					this.connect(businessId).catch((err) =>
						console.error(`[WhatsAppSessionManager] Error auto-conectando ${businessId}:`, err)
					);
				}
			})();
		}

		return {
			businessId,
			channel: 'whatsapp',
			status: holder.status,
			phone: holder.phone,
			pushName: holder.pushName,
			qr: holder.qr,
			connectedAt: holder.connectedAt,
			messages: holder.messages
		};
	}

	async getSessionInfoAsync(businessId: string): Promise<WhatsAppSessionInfo> {
		const holder = this.getOrCreateHolder(businessId);

		if (holder.status === 'disconnected' && !holder.sock && !holder.connectingPromise) {
			try {
				const { phone, pushName } = await getDatabaseSessionPhone(businessId);
				if (phone) {
					holder.phone = phone;
					holder.pushName = pushName;
					holder.status = 'connecting';
					this.broadcast(holder, {
						type: 'whatsapp:status',
						businessId,
						status: 'connecting',
						phone,
						pushName
					});
					this.connect(businessId).catch((err) =>
						console.error(`[WhatsAppSessionManager] Error auto-conectando ${businessId}:`, err)
					);
				}
			} catch (_) {}
		}

		return {
			businessId,
			channel: 'whatsapp',
			status: holder.status,
			phone: holder.phone,
			pushName: holder.pushName,
			qr: holder.qr,
			connectedAt: holder.connectedAt,
			messages: holder.messages
		};
	}

	syncHolderMessages(businessId: string, messages: WhatsAppMessage[]): void {
		const holder = this.getOrCreateHolder(businessId);
		if (holder.messages.length === 0 && messages.length > 0) {
			holder.messages = [...messages];
		}
	}

	subscribe(businessId: string, listener: (event: RealtimeEvent) => void): () => void {
		const holder = this.getOrCreateHolder(businessId);
		holder.listeners.add(listener);
		const unsubscribeChat = getChatService().subscribe(businessId, listener);
		return () => {
			holder.listeners.delete(listener);
			unsubscribeChat();
		};
	}

	private broadcast(holder: SessionHolder, event: RealtimeEvent) {
		for (const listener of holder.listeners) {
			try {
				listener(event);
			} catch (err) {
				console.error('[WhatsAppSessionManager] Error en listener SSE:', err);
			}
		}
	}

	async sendPresenceUpdate(
		businessId: string,
		_toContact: string,
		state: 'composing' | 'paused',
		remoteHandle?: string
	): Promise<void> {
		const holder = this.getOrCreateHolder(businessId);
		if (holder.sock && holder.status === 'connected' && remoteHandle) {
			try {
				await holder.sock.sendPresenceUpdate(state, remoteHandle);
			} catch (_) {}
		}
	}

	async connect(businessId: string): Promise<void> {
		const holder = this.getOrCreateHolder(businessId);

		if (holder.status === 'connected' && holder.sock) {
			return;
		}

		if (holder.connectingPromise) {
			return holder.connectingPromise;
		}

		holder.connectingPromise = (async () => {
			try {
				holder.status = 'connecting';
				this.broadcast(holder, {
					type: 'whatsapp:status',
					businessId,
					status: 'connecting'
				});

				const { state, saveCreds } = await useDatabaseAuthState(businessId);
				const { version } = await fetchLatestBaileysVersion();

				const sock = makeWASocket({
					version,
					auth: state,
					printQRInTerminal: false,
					logger: pino({ level: 'silent' }),
					browser: ['GiveOS Terminal', 'Chrome', '124.0.0.0'],
					syncFullHistory: false
				});

				holder.sock = sock;

				sock.ev.on('creds.update', saveCreds);

				sock.ev.on('connection.update', async (update) => {
					const { connection, lastDisconnect, qr } = update;

					if (qr) {
						try {
							const qrDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 7 });
							holder.qr = qrDataUrl;
							holder.status = 'scanning_qr';
							this.broadcast(holder, {
								type: 'whatsapp:qr',
								businessId,
								qr: qrDataUrl
							});
							this.broadcast(holder, {
								type: 'whatsapp:status',
								businessId,
								status: 'scanning_qr'
							});
						} catch (qrErr) {
							console.error('[WhatsApp] Error al convertir QR a imagen base64:', qrErr);
						}
					}

					if (connection === 'open') {
						holder.status = 'connected';
						holder.qr = null;
						const rawUser = sock.user?.id || '';
						const phone = rawUser.split(':')[0].split('@')[0] || null;
						const pushName = sock.user?.name || null;
						holder.phone = phone;
						holder.pushName = pushName;
						holder.connectedAt = new Date().toISOString();

						this.broadcast(holder, {
							type: 'whatsapp:status',
							businessId,
							status: 'connected',
							phone,
							pushName
						});

						(async () => {
							try {
								const db = getDb();
								const existing = await db.query.businesses.findFirst({
									where: eq(businesses.id, businessId)
								});
								if (existing) {
									const currentSettings = existing.settings || {};
									await db
										.update(businesses)
										.set({
											whatsapp: phone || existing.whatsapp,
											settings: {
												...currentSettings,
												integrations: {
													...(currentSettings.integrations || {}),
													whatsapp: {
														status: 'connected',
														phone,
														pushName,
														connectedAt: holder.connectedAt
													}
												}
											}
										})
										.where(eq(businesses.id, businessId));
								}
							} catch (dbErr) {
								console.error('[WhatsAppSessionManager] Error al persistir conexión en DB:', dbErr);
							}
						})();
					} else if (connection === 'close') {
						const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
						const isLoggedOut = statusCode === DisconnectReason.loggedOut;

						holder.qr = null;
						holder.sock = null;

						if (!isLoggedOut) {
							holder.status = 'connecting';
							this.broadcast(holder, {
								type: 'whatsapp:status',
								businessId,
								status: 'connecting'
							});
							setTimeout(() => {
								this.connect(businessId).catch((err) =>
									console.error('[WhatsApp] Error en reconexión automática:', err)
								);
							}, 4000);
						} else {
							holder.status = 'disconnected';
							this.broadcast(holder, {
								type: 'whatsapp:status',
								businessId,
								status: 'disconnected'
							});
						}
					}
				});

				sock.ev.on('messages.upsert', async ({ messages }) => {
					for (const m of messages) {
						const text =
							m.message?.conversation ||
							m.message?.extendedTextMessage?.text ||
							(m.message?.imageMessage?.caption
								? `📷 [Foto] ${m.message.imageMessage.caption}`
								: m.message?.imageMessage
									? '📷 [Foto]'
									: m.message?.audioMessage
										? '🎤 [Audio]'
										: m.message?.documentMessage
											? '📎 [Documento]'
											: null);

						if (!text) continue;

						const remoteJid = m.key.remoteJid || '';
						if (remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') {
							continue;
						}

						if (m.key.id && holder.messages.some((msg) => msg.id === m.key.id)) {
							continue;
						}

						let cleanFrom = remoteJid
							.replace('@s.whatsapp.net', '')
							.replace('@lid', '')
							.replace(/:\d+/, '');

						if (remoteJid.endsWith('@lid')) {
							try {
								const pn = await (sock.signalRepository as any)?.lidMapping?.getPNForLID?.(remoteJid);
								if (pn) {
									cleanFrom = pn.replace('@s.whatsapp.net', '').replace(/:\d+/, '');
								} else if (m.key.participant && m.key.participant.endsWith('@s.whatsapp.net')) {
									cleanFrom = m.key.participant.replace('@s.whatsapp.net', '').replace(/:\d+/, '');
								}
							} catch (_) {}
						}

						const timestamp =
							typeof m.messageTimestamp === 'number' ? m.messageTimestamp * 1000 : Date.now();

						const chatService = getChatService();

						// 1. Mensaje enviado por nosotros (desde el celular vinculado o GiveOS)
						if (m.key.fromMe) {
							chatService.cancelPendingBotResponse(businessId, cleanFrom, 'whatsapp');

							const newMsg = await DatabaseChatRepository.saveOutgoingMessage({
								businessId,
								channel: 'whatsapp',
								toPhone: cleanFrom,
								text,
								timestamp,
								messageId: m.key.id || undefined,
								rawKey: {
									remoteJid: m.key.remoteJid,
									id: m.key.id,
									fromMe: true,
									participant: m.key.participant
								}
							});

							holder.messages.unshift(newMsg);
							if (holder.messages.length > 200) {
								holder.messages.pop();
							}

							this.broadcast(holder, {
								type: 'whatsapp:message',
								businessId,
								channel: 'whatsapp',
								message: newMsg
							});
							continue;
						}

						// 2. Mensaje entrante del cliente
						const senderName = m.pushName || cleanFrom;

						const newMsg = await DatabaseChatRepository.saveIncomingMessage({
							businessId,
							channel: 'whatsapp',
							customerPhone: cleanFrom,
							senderName,
							text,
							timestamp,
							messageId: m.key.id || undefined,
							rawKey: {
								remoteJid: m.key.remoteJid,
								id: m.key.id,
								fromMe: false,
								participant: m.key.participant
							}
						});

						holder.messages.unshift(newMsg);
						if (holder.messages.length > 200) {
							holder.messages.pop();
						}

						this.broadcast(holder, {
							type: 'whatsapp:message',
							businessId,
							channel: 'whatsapp',
							message: newMsg
						});

						// 3. Delegar programación de respuesta del bot al servicio de mensajería agnóstico
						chatService.scheduleBotResponse({
							businessId,
							channel: 'whatsapp',
							customerPhone: cleanFrom,
							customerName: senderName,
							remoteHandle: remoteJid,
							getRecentMessages: () => holder.messages,
							onProofSubmitted: (phone) => {
								this.broadcast(holder, {
									type: 'whatsapp:proof_submitted',
									businessId,
									channel: 'whatsapp',
									phone
								});
							},
							onOrderCreated: (order) => {
								this.broadcast(holder, {
									type: 'whatsapp:unconfirmed_order_created',
									businessId,
									channel: 'whatsapp',
									phone: cleanFrom,
									order
								});
							}
						});
					}
				});
			} catch (err) {
				console.error('[WhatsAppSessionManager] Error al conectar socket:', err);
				holder.status = 'disconnected';
				holder.sock = null;
				this.broadcast(holder, {
					type: 'whatsapp:status',
					businessId,
					status: 'disconnected'
				});
			} finally {
				holder.connectingPromise = null;
			}
		})();

		return holder.connectingPromise;
	}

	async sendMessage(
		businessId: string,
		toPhone: string,
		text: string,
		isBot = false
	): Promise<WhatsAppMessage> {
		const holder = this.getOrCreateHolder(businessId);
		if (!holder.sock || holder.status !== 'connected') {
			throw new Error('WhatsApp no se encuentra conectado para este negocio.');
		}

		let jid = toPhone.trim();
		const cleanPhone = toPhone.replace(/\D/g, '');

		if (!jid.includes('@')) {
			const existingMsg = holder.messages.find(
				(m) =>
					m.from === cleanPhone ||
					m.from.endsWith(cleanPhone) ||
					(m.key?.remoteJid && m.key.remoteJid.includes(cleanPhone))
			);

			if (existingMsg?.key?.remoteJid) {
				jid = existingMsg.key.remoteJid;
			} else {
				jid = `${cleanPhone}@s.whatsapp.net`;
			}
		}

		console.log(`[WhatsAppSessionManager] Enviando mensaje a JID "${jid}":`, text);
		const result = await holder.sock.sendMessage(jid, { text });

		const msgObj = await DatabaseChatRepository.saveOutgoingMessage({
			businessId,
			channel: 'whatsapp',
			toPhone: cleanPhone,
			text,
			isBot,
			messageId: result?.key?.id || undefined,
			rawKey: {
				remoteJid: result?.key?.remoteJid || jid,
				id: result?.key?.id,
				fromMe: true
			}
		});

		holder.messages.unshift(msgObj);
		if (holder.messages.length > 200) {
			holder.messages.pop();
		}

		this.broadcast(holder, {
			type: 'whatsapp:message',
			businessId,
			channel: 'whatsapp',
			message: msgObj
		});

		return msgObj;
	}

	async clearChatHistory(businessId: string, phone: string): Promise<void> {
		const clean = phone.replace(/\D/g, '');
		await DatabaseChatRepository.clearChatHistory(businessId, clean, 'whatsapp');
		const holder = this.getOrCreateHolder(businessId);
		holder.messages = holder.messages.filter((m) => m.from !== clean);
		this.broadcast(holder, {
			type: 'whatsapp:message_cleared',
			businessId,
			channel: 'whatsapp',
			phone: clean
		});
	}

	async markSessionAsRead(
		businessId: string,
		phone: string,
		messageIds?: string[]
	): Promise<boolean> {
		const cleanPhone = phone.replace(/\D/g, '');
		const holder = this.getOrCreateHolder(businessId);

		for (const msg of holder.messages) {
			const cleanFrom = msg.from.replace(/\D/g, '');
			const isMatch =
				(messageIds && msg.id && messageIds.includes(msg.id)) ||
				phonesMatch(cleanFrom, cleanPhone);

			if (isMatch && !msg.fromMe) {
				msg.isRead = true;
			}
		}

		try {
			await DatabaseChatRepository.markSessionAsRead(businessId, cleanPhone, messageIds, 'whatsapp');
		} catch (err) {
			console.error('[WhatsAppSessionManager] Error al marcar sesión como leída en BD:', err);
		}

		if (holder.sock && holder.status === 'connected') {
			try {
				const unreadKeys = holder.messages
					.filter((m) => {
						const cleanFrom = m.from.replace(/\D/g, '');
						const isMatch =
							(messageIds && m.id && messageIds.includes(m.id)) ||
							phonesMatch(cleanFrom, cleanPhone);
						return isMatch && !m.fromMe && m.key?.id && m.key?.remoteJid;
					})
					.map((m) => m.key as any);

				if (unreadKeys.length > 0) {
					holder.sock.readMessages(unreadKeys).catch((sockErr: any) => {
						console.warn(
							'[WhatsAppSessionManager] Error async en readMessages de Baileys:',
							sockErr?.message
						);
					});
				}
			} catch (sockErr) {
				console.error(
					'[WhatsAppSessionManager] Error al preparar confirmación de lectura para Baileys:',
					sockErr
				);
			}
		}

		this.broadcast(holder, {
			type: 'whatsapp:session_read',
			businessId,
			channel: 'whatsapp',
			phone: cleanPhone
		});

		return true;
	}

	async markAsRead(
		businessId: string,
		messageKey?: WhatsAppMessageKey,
		messageId?: string
	): Promise<boolean> {
		const holder = this.getOrCreateHolder(businessId);
		const targetId = messageId || messageKey?.id;

		if (targetId) {
			const found = holder.messages.find((m) => m.id === targetId || m.key?.id === targetId);
			if (found) {
				found.isRead = true;
			}
		}

		if (targetId) {
			try {
				await DatabaseChatRepository.markMessageAsRead(businessId, targetId);
			} catch (err) {
				console.error('[WhatsAppSessionManager] Error al marcar mensaje en BD:', err);
			}
		}

		if (holder.sock && holder.status === 'connected' && messageKey?.remoteJid && messageKey?.id) {
			try {
				await holder.sock.readMessages([messageKey as any]);
			} catch (err) {
				console.error('[WhatsAppSessionManager] Error al marcar mensaje como leído en Baileys:', err);
			}
		}

		return true;
	}

	async disconnect(businessId: string, isLogout = false): Promise<void> {
		const holder = this.getOrCreateHolder(businessId);
		holder.connectingPromise = null;

		if (holder.sock) {
			try {
				holder.sock.ev.removeAllListeners('connection.update');
				holder.sock.ev.removeAllListeners('creds.update');
				holder.sock.ev.removeAllListeners('messages.upsert');
				if (isLogout) {
					await holder.sock.logout().catch(() => {});
				}
				holder.sock.end(undefined);
			} catch (_) {}
		}

		holder.sock = null;
		holder.status = 'disconnected';
		holder.qr = null;

		if (isLogout) {
			holder.phone = null;
			holder.pushName = null;
			holder.connectedAt = null;

			const { clearSession } = await useDatabaseAuthState(businessId);
			await clearSession();

			try {
				const db = getDb();
				await db.delete(whatsappAuthKeys).where(eq(whatsappAuthKeys.businessId, businessId));

				const existing = await db.query.businesses.findFirst({
					where: eq(businesses.id, businessId)
				});
				if (existing) {
					const currentSettings = existing.settings || {};
					await db
						.update(businesses)
						.set({
							settings: {
								...currentSettings,
								integrations: {
									...(currentSettings.integrations || {}),
									whatsapp: {
										status: 'disconnected',
										phone: null,
										pushName: null,
										disconnectedAt: new Date().toISOString()
									}
								}
							}
						})
						.where(eq(businesses.id, businessId));
				}
			} catch (dbErr) {
				console.error('[WhatsAppSessionManager] Error al actualizar estado en DB al desconectar:', dbErr);
			}
		}

		this.broadcast(holder, {
			type: 'whatsapp:status',
			businessId,
			status: 'disconnected',
			phone: null,
			pushName: null
		});
	}
}

const globalForWhatsApp = globalThis as unknown as {
	_whatsAppSessionManager?: WhatsAppSessionManager;
};

export function getWhatsAppSessionManager(): WhatsAppSessionManager {
	if (!globalForWhatsApp._whatsAppSessionManager) {
		globalForWhatsApp._whatsAppSessionManager = new WhatsAppSessionManager();
	} else {
		Object.setPrototypeOf(
			globalForWhatsApp._whatsAppSessionManager,
			WhatsAppSessionManager.prototype
		);
		getChatService().registerChannelAdapter(globalForWhatsApp._whatsAppSessionManager);
	}
	return globalForWhatsApp._whatsAppSessionManager;
}
