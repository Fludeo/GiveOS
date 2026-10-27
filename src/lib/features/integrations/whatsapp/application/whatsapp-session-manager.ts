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
import { businesses, orders, orderItems } from '#lib/server/db/schema';
import {
	useDatabaseAuthState,
	getDatabaseSessionPhone,
	getAllActiveSessionBusinessIds
} from '../infrastructure/database-auth-state';
import { DatabaseChatRepository } from '../infrastructure/database-chat-repository';
import { getEcommerceBotService } from '#lib/features/ai/application/ecommerce-bot.service';
import { getHumanDelaySeconds } from '#lib/features/ai/domain/human-delay.utils';
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

export class WhatsAppSessionManager {
	private sessions = new Map<string, SessionHolder>();
	private botDebounceTimers = new Map<string, NodeJS.Timeout>();

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

	async getSessionInfoAsync(businessId: string): Promise<WhatsAppSessionInfo> {
		const holder = this.getOrCreateHolder(businessId);

		// Si el socket en RAM no está activo, verificar si existen credenciales en PostgreSQL para auto-reconectar
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
							// Cancelar cualquier respuesta pendiente del bot para este cliente ya que intervino un operador
							const timerKey = `${businessId}:${cleanFrom}`;
							const pendingTimer = this.botDebounceTimers.get(timerKey);
							if (pendingTimer) {
								clearTimeout(pendingTimer);
								this.botDebounceTimers.delete(timerKey);
								console.log(
									`[WhatsApp Bot] Mensaje saliente enviado a ${cleanFrom}. Cancelando respuesta programada del bot.`
								);
							}

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

						// Si el mensaje viene del cliente, evaluar si el bot de IA debe intervenir con retardo humano
						(async () => {
							try {
								const db = getDb();
								const biz = await db.query.businesses.findFirst({
									where: eq(businesses.id, businessId)
								});
								const botConfig = biz?.settings?.integrations?.bot;

								if (botConfig?.enabled) {
									const timerKey = `${businessId}:${cleanFrom}`;

									// Si el cliente ya había enviado otro mensaje hace instantes, reiniciamos el temporizador
									// para que el bot espere a que termine de enviar todas sus ideas antes de responder.
									const existingTimer = this.botDebounceTimers.get(timerKey);
									if (existingTimer) {
										clearTimeout(existingTimer);
										this.botDebounceTimers.delete(timerKey);
										console.log(
											`[WhatsApp Bot] Mensaje adicional recibido de "${senderName}" (${cleanFrom}). Reiniciando temporizador humano.`
										);
									}

									// Generar retardo humano entre 7 y 10 segundos
									const delaySec = getHumanDelaySeconds(7, 10);
									const delayMs = Math.round(delaySec * 1000);
									console.log(
										`[WhatsApp Bot] Programando respuesta para "${senderName}" (${cleanFrom}) en ${delaySec}s...`
									);

									const timer = setTimeout(async () => {
										this.botDebounceTimers.delete(timerKey);
										await this.processDebouncedBotResponse({
											businessId,
											customerPhone: cleanFrom,
											customerName: senderName,
											remoteJid,
											botConfig,
											holder
										});
									}, delayMs);

									this.botDebounceTimers.set(timerKey, timer);
								}
							} catch (botErr) {
								console.error('[WhatsAppSessionManager] Error programando bot con delay:', botErr);
							}
						})();
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
			message: msgObj
		});

		return msgObj;
	}

	/**
	 * Procesa y responde a los mensajes acumulados del cliente tras expirar el debounce humano (7-10s)
	 */
	private async processDebouncedBotResponse(params: {
		businessId: string;
		customerPhone: string;
		customerName: string;
		remoteJid: string;
		botConfig: any;
		holder: SessionHolder;
	}): Promise<void> {
		const { businessId, customerPhone, customerName, remoteJid, botConfig, holder } = params;

		try {
			// 1. Obtener mensajes del contacto en memoria (ordenados de más nuevo a más viejo)
			const contactMsgs = holder.messages.filter((m) => {
				const p = m.from.replace(/\D/g, '');
				return p === customerPhone || p.endsWith(customerPhone) || customerPhone.endsWith(p);
			});

			if (contactMsgs.length === 0) return;

			// 2. Encontrar todos los mensajes consecutivos enviados por el cliente desde la última respuesta nuestra
			const lastAssistantIndex = contactMsgs.findIndex((m) => m.fromMe);
			const unrepliedUserMsgs = (
				lastAssistantIndex === -1 ? contactMsgs : contactMsgs.slice(0, lastAssistantIndex)
			)
				.filter((m) => !m.fromMe)
				.reverse();

			if (unrepliedUserMsgs.length === 0) return;

			// Unificar los textos enviados consecutivamente durante el tiempo de espera
			const combinedText = unrepliedUserMsgs
				.map((m) => m.text.trim())
				.filter(Boolean)
				.join('\n');

			if (!combinedText) return;

			// 3. Historial conversacional previo a estos mensajes no respondidos
			const historySource = (
				lastAssistantIndex === -1
					? []
					: contactMsgs.slice(lastAssistantIndex, lastAssistantIndex + 10)
			).reverse();

			const chatHistory = historySource.map((msg) => ({
				role: msg.fromMe ? ('assistant' as const) : ('user' as const),
				text: msg.text
			}));

			// 4. Evaluar simulación de comprobante de pago
			const normalized = combinedText.toLowerCase();
			if (
				normalized.includes('comprobante enviado') ||
				normalized === 'comprobante' ||
				normalized === 'ya transferí' ||
				normalized === 'transferido'
			) {
				const reply = `¡Muchas gracias ${customerName}! ✨ Recibimos tu aviso de pago. Un encargado del negocio está verificando la transferencia en la cuenta para confirmar tu pedido a la brevedad.`;
				await this.sendMessage(businessId, customerPhone, reply, true);

				this.broadcast(holder, {
					type: 'whatsapp:proof_submitted',
					businessId,
					phone: customerPhone
				} as any);
				return;
			}

			// 5. Simular presencia humana ("Escribiendo...") en WhatsApp
			if (holder.sock && holder.status === 'connected' && remoteJid) {
				try {
					await holder.sock.sendPresenceUpdate('composing', remoteJid);
				} catch (_) {}
			}

			console.log(
				`[WhatsApp Bot] Procesando mensajes acumulados de "${customerName}" (${customerPhone}):\n"${combinedText}"`
			);

			// 6. Ejecutar el modelo de IA con la totalidad de los mensajes acumulados
			const botService = getEcommerceBotService();
			const botOutput = await botService.processMessage({
				businessId,
				customerPhone,
				customerName,
				messageText: combinedText,
				chatHistory,
				botConfig,
				customSystemPrompt: botConfig?.systemPrompt
			});

			// 7. Pausar estado de presencia y enviar respuesta
			if (holder.sock && holder.status === 'connected' && remoteJid) {
				try {
					await holder.sock.sendPresenceUpdate('paused', remoteJid);
				} catch (_) {}
			}

			console.log(`[WhatsApp Bot] Respuesta generada tras espera humana:`, botOutput.replyText);

			if (botOutput.replyText) {
				await this.sendMessage(businessId, customerPhone, botOutput.replyText, true);
			}

			if (botOutput.orderCreated) {
				const db = getDb();
				const fullOrder = await db.query.orders.findFirst({
					where: eq(orders.id, botOutput.orderCreated.orderId)
				});
				const items = await db.query.orderItems.findMany({
					where: eq(orderItems.orderId, botOutput.orderCreated.orderId)
				});

				this.broadcast(holder, {
					type: 'whatsapp:unconfirmed_order_created',
					businessId,
					phone: customerPhone,
					order: {
						...(fullOrder || botOutput.orderCreated),
						items: items || []
					}
				} as any);
			}
		} catch (err) {
			console.error('[WhatsAppSessionManager] Error ejecutando bot de IA tras espera humana:', err);
		}
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

	/**
	 * Marca todos los mensajes de un contacto como leídos (memoria, BD y WhatsApp)
	 */
	async markSessionAsRead(
		businessId: string,
		phone: string,
		messageIds?: string[]
	): Promise<boolean> {
		const cleanPhone = phone.replace(/\D/g, '');
		const holder = this.getOrCreateHolder(businessId);

		// 1. Actualizar memoria en vivo
		for (const msg of holder.messages) {
			const cleanFrom = msg.from.replace(/\D/g, '');
			const isMatch =
				(messageIds && msg.id && messageIds.includes(msg.id)) ||
				phonesMatch(cleanFrom, cleanPhone);

			if (isMatch && !msg.fromMe) {
				msg.isRead = true;
			}
		}

		// 2. Persistir en la base de datos (PostgreSQL)
		try {
			await DatabaseChatRepository.markSessionAsRead(businessId, cleanPhone, messageIds);
		} catch (err) {
			console.error('[WhatsAppSessionManager] Error al marcar sesión como leída en BD:', err);
		}

		// 3. Notificar a WhatsApp (Baileys) si el socket está conectado (sin bloquear la respuesta HTTP)
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
						console.warn('[WhatsAppSessionManager] Error async en readMessages de Baileys:', sockErr?.message);
					});
				}
			} catch (sockErr) {
				console.error('[WhatsAppSessionManager] Error al preparar confirmación de lectura para Baileys:', sockErr);
			}
		}

		// 4. Emitir evento por SSE a todos los clientes web conectados
		this.broadcast(holder, {
			type: 'whatsapp:session_read',
			businessId,
			phone: cleanPhone
		} as any);

		return true;
	}

	/**
	 * Marca un mensaje específico como leído (memoria, BD y WhatsApp)
	 */
	async markAsRead(
		businessId: string,
		messageKey?: WhatsAppMessageKey,
		messageId?: string
	): Promise<boolean> {
		const holder = this.getOrCreateHolder(businessId);
		const targetId = messageId || messageKey?.id;

		// 1. Actualizar memoria en vivo
		if (targetId) {
			const found = holder.messages.find((m) => m.id === targetId || m.key?.id === targetId);
			if (found) {
				found.isRead = true;
			}
		}

		// 2. Persistir en base de datos (PostgreSQL)
		if (targetId) {
			try {
				await DatabaseChatRepository.markMessageAsRead(businessId, targetId);
			} catch (err) {
				console.error('[WhatsAppSessionManager] Error al marcar mensaje en BD:', err);
			}
		}

		// 3. Notificar a WhatsApp (Baileys) si está conectado
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
	} else {
		Object.setPrototypeOf(globalForWhatsApp._whatsAppSessionManager, WhatsAppSessionManager.prototype);
	}
	return globalForWhatsApp._whatsAppSessionManager;
}
