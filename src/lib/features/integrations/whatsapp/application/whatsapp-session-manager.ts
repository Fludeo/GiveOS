import makeWASocket, {
	DisconnectReason,
	fetchLatestBaileysVersion,
	type WASocket
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { v7 as uuidv7 } from 'uuid';
import { eq } from 'drizzle-orm';
import { getDb } from '#lib/server/db/index';
import { businesses } from '#lib/server/db/schema';
import {
	useDatabaseAuthState,
	getDatabaseSessionPhone,
	getAllActiveSessionBusinessIds
} from '../infrastructure/database-auth-state';
import { DatabaseChatRepository } from '../infrastructure/database-chat-repository';
import { getEcommerceBotService } from '#lib/features/ai/application/ecommerce-bot.service';
import type {
	WhatsAppMessage,
	WhatsAppMessageKey,
	WhatsAppSessionInfo,
	WhatsAppSessionStatus,
	RealtimeEvent
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

export class WhatsAppSessionManager {
	private sessions = new Map<string, SessionHolder>();

	constructor() {
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

	getSessionInfo(businessId: string): WhatsAppSessionInfo {
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
			status: holder.status,
			phone: holder.phone,
			pushName: holder.pushName,
			qr: holder.qr,
			connectedAt: holder.connectedAt,
			messages: holder.messages
		};
	}

	subscribe(businessId: string, listener: (event: RealtimeEvent) => void): () => void {
		const holder = this.getOrCreateHolder(businessId);
		holder.listeners.add(listener);
		return () => {
			holder.listeners.delete(listener);
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

	async connect(businessId: string): Promise<void> {
		const holder = this.getOrCreateHolder(businessId);

		// Si ya está conectado con socket activo, no reconectar
		if (holder.status === 'connected' && holder.sock) {
			return;
		}

		// Si ya está en proceso de conexión, retornar la promesa existente
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

				// Obtener adaptador de autenticación persistido en PostgreSQL
				const { state, saveCreds, clearSession } = await useDatabaseAuthState(businessId);
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

				// Guardar credenciales en PostgreSQL cada vez que Baileys las actualice
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

						// Persistir estado y número en la base de datos (tabla businesses)
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
							// Reconexión automática con backoff
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
							// Desvinculación o desconexión crítica reportada por WhatsApp
							holder.status = 'disconnected';
							this.broadcast(holder, {
								type: 'whatsapp:status',
								businessId,
								status: 'disconnected'
							});
						}
					}
				});

				sock.ev.on('messages.upsert', async ({ messages, type }) => {
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

						// Evitar procesar mensajes duplicados de Baileys
						if (m.key.id && holder.messages.some((msg) => msg.id === m.key.id)) {
							continue;
						}

						let cleanFrom = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '').replace(/:\d+/, '');

						// Si el JID viene en formato LID (@lid), intentar resolver el número de teléfono real (PN)
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

						const timestamp = typeof m.messageTimestamp === 'number' ? m.messageTimestamp * 1000 : Date.now();

						// 1. Si el mensaje fue enviado por nosotros (desde el celular vinculado o GiveOS)
						if (m.key.fromMe) {
							const newMsg = await DatabaseChatRepository.saveOutgoingMessage({
								businessId,
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
								message: newMsg
							});
							continue;
						}

						// 2. Si el mensaje viene del cliente (entrante)
						const senderName = m.pushName || cleanFrom;

						const newMsg = await DatabaseChatRepository.saveIncomingMessage({
							businessId,
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
							message: newMsg
						});

						// Si el mensaje viene del cliente, evaluar si el bot de IA debe intervenir
						if (!m.key.fromMe) {
							(async () => {
								try {
									const db = getDb();
									const biz = await db.query.businesses.findFirst({
										where: eq(businesses.id, businessId)
									});
									const botConfig = biz?.settings?.integrations?.bot;

									if (botConfig?.enabled) {
										const normalized = text.trim().toLowerCase();

										// Simulación de comprobante enviado
										if (
											normalized.includes('comprobante enviado') ||
											normalized === 'comprobante' ||
											normalized === 'ya transferí' ||
											normalized === 'transferido'
										) {
											const reply = `¡Muchas gracias ${senderName}! 🍰 Recibimos tu aviso de pago. Un encargado de la pastelería está verificando la transferencia en la cuenta para confirmar tu pedido en breve.`;
											await this.sendMessage(businessId, cleanFrom, reply);

											this.broadcast(holder, {
												type: 'whatsapp:proof_submitted',
												businessId,
												phone: cleanFrom
											} as any);
											return;
										}

										// Obtener historial reciente del chat con este cliente (excluyendo el actual)
										const history = holder.messages
											.filter((msg) => msg.from === cleanFrom && msg.id !== newMsg.id)
											.slice(0, 10)
											.reverse()
											.map((msg) => ({
												role: msg.fromMe ? ('assistant' as const) : ('user' as const),
												text: msg.text
											}));

										console.log(
											`[WhatsApp Bot] Evaluando mensaje de "${senderName}" (${cleanFrom}): "${text}"`
										);

										const botService = getEcommerceBotService();
										const botOutput = await botService.processMessage({
											businessId,
											customerPhone: cleanFrom,
											customerName: senderName,
											messageText: text,
											chatHistory: history,
											customSystemPrompt: botConfig.systemPrompt
										});

										console.log(`[WhatsApp Bot] Respuesta de IA:`, botOutput.replyText);

										if (botOutput.replyText) {
											await this.sendMessage(businessId, cleanFrom, botOutput.replyText);
										}

										if (botOutput.orderCreated) {
											this.broadcast(holder, {
												type: 'whatsapp:unconfirmed_order_created',
												businessId,
												phone: cleanFrom,
												order: botOutput.orderCreated
											} as any);
										}
									}
								} catch (botErr) {
									console.error('[WhatsAppSessionManager] Error ejecutando bot de IA:', botErr);
								}
							})();
						}
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

	async sendMessage(businessId: string, toPhone: string, text: string): Promise<WhatsAppMessage> {
		const holder = this.getOrCreateHolder(businessId);
		if (!holder.sock || holder.status !== 'connected') {
			throw new Error('WhatsApp no se encuentra conectado para este negocio.');
		}

		let jid = toPhone.trim();
		const cleanPhone = toPhone.replace(/\D/g, '');

		if (!jid.includes('@')) {
			// Buscar si este contacto tiene un remoteJid original registrado (por ejemplo si es un @lid)
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
			toPhone: cleanPhone,
			text,
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
			message: msgObj
		});

		return msgObj;
	}

	async clearChatHistory(businessId: string, phone: string): Promise<void> {
		const clean = phone.replace(/\D/g, '');
		await DatabaseChatRepository.clearChatHistory(businessId, clean);
		const holder = this.getOrCreateHolder(businessId);
		holder.messages = holder.messages.filter((m) => m.from !== clean);
		this.broadcast(holder, {
			type: 'whatsapp:message_cleared',
			businessId,
			phone: clean
		} as any);
	}

	async markAsRead(businessId: string, messageKey: WhatsAppMessageKey): Promise<boolean> {
		const holder = this.getOrCreateHolder(businessId);
		if (!holder.sock || holder.status !== 'connected') {
			return false;
		}

		if (!messageKey.remoteJid || !messageKey.id) {
			return false;
		}

		try {
			await holder.sock.readMessages([messageKey as any]);
			const found = holder.messages.find((m) => m.id === messageKey.id);
			if (found) {
				found.isRead = true;
			}
			return true;
		} catch (err) {
			console.error('[WhatsApp] Error al marcar mensaje como leído:', err);
			return false;
		}
	}

	async disconnect(businessId: string, isLogout = false): Promise<void> {
		const holder = this.getOrCreateHolder(businessId);
		if (holder.sock) {
			try {
				if (isLogout) {
					await holder.sock.logout();
				} else {
					holder.sock.end(undefined);
				}
			} catch (_) {}
		}

		holder.sock = null;
		holder.status = 'disconnected';
		holder.qr = null;

		if (isLogout) {
			holder.phone = null;
			holder.pushName = null;
			holder.connectedAt = null;

			// Limpiar credenciales de PostgreSQL
			const { clearSession } = await useDatabaseAuthState(businessId);
			await clearSession();

			// Actualizar estado en tabla businesses
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
							settings: {
								...currentSettings,
								integrations: {
									...(currentSettings.integrations || {}),
									whatsapp: {
										status: 'disconnected',
										phone: null,
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
			status: 'disconnected'
		});
	}
}

// Singleton en globalThis para preservar sesiones activas entre recargas de Vite HMR
const globalForWhatsApp = globalThis as unknown as {
	_whatsAppSessionManager?: WhatsAppSessionManager;
};

export function getWhatsAppSessionManager(): WhatsAppSessionManager {
	if (!globalForWhatsApp._whatsAppSessionManager) {
		globalForWhatsApp._whatsAppSessionManager = new WhatsAppSessionManager();
	}
	return globalForWhatsApp._whatsAppSessionManager;
}
