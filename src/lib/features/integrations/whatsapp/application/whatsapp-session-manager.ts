import path from 'node:path';
import fs from 'node:fs';
import makeWASocket, {
	useMultiFileAuthState,
	DisconnectReason,
	fetchLatestBaileysVersion,
	type WASocket
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { v7 as uuidv7 } from 'uuid';
import type {
	WhatsAppMessage,
	WhatsAppMessageKey,
	WhatsAppSessionInfo,
	WhatsAppSessionStatus,
	RealtimeEvent
} from '../domain/whatsapp.entity';

const SESSIONS_DIR = path.resolve(process.cwd(), 'storage', 'whatsapp_sessions');

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
		try {
			fs.mkdirSync(SESSIONS_DIR, { recursive: true });
		} catch (e) {
			console.error('[WhatsAppSessionManager] Error al crear directorio de sesiones:', e);
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

		// Si ya está conectado, no reconectar
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

				const sessionPath = path.resolve(SESSIONS_DIR, businessId);
				fs.mkdirSync(sessionPath, { recursive: true });

				const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
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
							// Desvinculado / sesión cerrada desde el celular
							holder.status = 'disconnected';
							holder.phone = null;
							holder.pushName = null;
							this.broadcast(holder, {
								type: 'whatsapp:status',
								businessId,
								status: 'disconnected'
							});
							try {
								fs.rmSync(sessionPath, { recursive: true, force: true });
							} catch (_) {}
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

						const fromJid = m.key.remoteJid || '';
						if (fromJid.endsWith('@broadcast') || fromJid.includes('status')) continue;

						const cleanPhone = fromJid.split('@')[0];
						const senderName = m.pushName || cleanPhone;

						const msgObj: WhatsAppMessage = {
							id: m.key.id || uuidv7(),
							businessId,
							from: cleanPhone,
							senderName,
							text,
							fromMe: Boolean(m.key.fromMe),
							timestamp:
								typeof m.messageTimestamp === 'number' ? m.messageTimestamp * 1000 : Date.now(),
							isRead: Boolean(m.key.fromMe),
							key: {
								remoteJid: m.key.remoteJid,
								id: m.key.id,
								fromMe: m.key.fromMe,
								participant: m.key.participant
							}
						};

						// Insertar al inicio de la lista en memoria
						holder.messages.unshift(msgObj);
						if (holder.messages.length > 100) {
							holder.messages.pop();
						}

						this.broadcast(holder, {
							type: 'whatsapp:message',
							businessId,
							message: msgObj
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

	async sendMessage(businessId: string, toPhone: string, text: string): Promise<WhatsAppMessage> {
		const holder = this.getOrCreateHolder(businessId);
		if (!holder.sock || holder.status !== 'connected') {
			throw new Error('WhatsApp no se encuentra conectado para este negocio.');
		}

		const cleanPhone = toPhone.replace(/\D/g, '');
		const jid = `${cleanPhone}@s.whatsapp.net`;

		const result = await holder.sock.sendMessage(jid, { text });

		const msgObj: WhatsAppMessage = {
			id: result?.key?.id || uuidv7(),
			businessId,
			from: cleanPhone,
			senderName: 'Yo (GiveOS)',
			text,
			fromMe: true,
			timestamp: Date.now(),
			isRead: true,
			key: {
				remoteJid: result?.key?.remoteJid || jid,
				id: result?.key?.id,
				fromMe: true
			}
		};

		holder.messages.unshift(msgObj);
		if (holder.messages.length > 100) {
			holder.messages.pop();
		}

		this.broadcast(holder, {
			type: 'whatsapp:message',
			businessId,
			message: msgObj
		});

		return msgObj;
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
			const sessionPath = path.resolve(SESSIONS_DIR, businessId);
			try {
				fs.rmSync(sessionPath, { recursive: true, force: true });
			} catch (_) {}
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
