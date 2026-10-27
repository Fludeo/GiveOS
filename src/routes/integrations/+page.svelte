<script lang="ts">
	import type { PageProps } from './$types';
	import AppShell from '#lib/components/layout/app-shell.svelte';
	import { Button } from '#lib/components/ui/button';
	import { Badge } from '#lib/components/ui/badge';
	import { Input } from '#lib/components/ui/input';
	import { Card, CardHeader, CardTitle, CardContent } from '#lib/components/ui/card';
	import QrCode from '@lucide/svelte/icons/qr-code';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import X from '@lucide/svelte/icons/x';
	import Send from '@lucide/svelte/icons/send';
	import Check from '@lucide/svelte/icons/check';
	import CheckCheck from '@lucide/svelte/icons/check-check';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Eye from '@lucide/svelte/icons/eye';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Bot from '@lucide/svelte/icons/bot';
	import Settings2 from '@lucide/svelte/icons/settings-2';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import { toast } from '#lib/components/ui/toast';
	import { DEFAULT_BOT_PROMPT } from '#lib/features/ai/domain/bot-prompt.constants';
	import type {
		WhatsAppMessage,
		WhatsAppSessionStatus
	} from '#lib/features/integrations/whatsapp/domain/whatsapp.entity';

	let { data }: PageProps = $props();

	let showQrModal = $state(false);
	let showDisconnectModal = $state(false);
	let isDisconnecting = $state(false);
	let showClearChatModal = $state(false);
	let isClearingChat = $state(false);

	// Estado reactivo de la sesión
	let status = $state<WhatsAppSessionStatus>('disconnected');
	let phone = $state<string | null>(null);
	let pushName = $state<string | null>(null);
	let qrCodeData = $state<string | null>(null);
	let messages = $state<WhatsAppMessage[]>([]);

	let isConnecting = $state(false);
	let isSending = $state(false);
	let replyText = $state('');
	let selectedRecipient = $state<string>('');
	let contactSearch = $state<string>('');
	let showNewChatInput = $state(false);
	let newChatPhone = $state('');

	// Estado del Bot de Ventas IA y Pedidos No Confirmados
	let botEnabled = $state(false);
	let botPrompt = $state(DEFAULT_BOT_PROMPT);
	let showBotPromptModal = $state(false);
	let isSavingBotSettings = $state(false);

	let unconfirmedOrders = $state<any[]>([]);
	let showConfirmOrderModal = $state(false);
	let selectedOrderToConfirm = $state<any | null>(null);
	let confirmPaidAmount = $state<number>(0);
	let sendWhatsAppConfirm = $state(true);
	let isConfirmingOrder = $state(false);

	let showRenameModal = $state(false);
	let renameContactInput = $state('');
	let isRenamingContact = $state(false);
	let customContactNames = $state<Record<string, string>>({});

	let chatScrollContainer = $state<HTMLDivElement | null>(null);

	const unconfirmedCount = $derived(unconfirmedOrders.length);

	// Sincronizar estado inicial desde el servidor
	$effect(() => {
		if (data.initialWhatsAppSession) {
			status = data.initialWhatsAppSession.status || 'disconnected';
			phone = data.initialWhatsAppSession.phone || null;
			pushName = data.initialWhatsAppSession.pushName || null;
			qrCodeData = data.initialWhatsAppSession.qr || null;

			// Deduplicar mensajes iniciales por id
			const seen = new Set<string>();
			messages = (data.initialWhatsAppSession.messages || []).filter((m) => {
				if (!m.id || seen.has(m.id)) return false;
				seen.add(m.id);
				return true;
			});
		}
		if (data.botSettings) {
			botEnabled = data.botSettings.enabled;
			if (data.botSettings.systemPrompt) {
				botPrompt = data.botSettings.systemPrompt;
			}
		}
		if (data.unconfirmedOrders) {
			unconfirmedOrders = data.unconfirmedOrders;
		}
	});

	// Conectar al bus de eventos SSE en tiempo real
	$effect(() => {
		if (typeof window === 'undefined') return;
		const url = `/api/realtime?businessId=${data.activeBusiness.id}`;
		const es = new EventSource(url);

		es.addEventListener('whatsapp:status', (e) => {
			try {
				const payload = JSON.parse(e.data);
				status = payload.status;
				if (payload.phone !== undefined) phone = payload.phone;
				if (payload.pushName !== undefined) pushName = payload.pushName;
				if (status === 'connected') {
					qrCodeData = null;
					isConnecting = false;
					showQrModal = false;
					toast.success('¡WhatsApp Conectado!', 'La línea está lista para recibir y enviar mensajes.');
				}
			} catch (_) {}
		});

		es.addEventListener('whatsapp:qr', (e) => {
			try {
				const payload = JSON.parse(e.data);
				qrCodeData = payload.qr;
				status = 'scanning_qr';
				isConnecting = false;
			} catch (_) {}
		});

		es.addEventListener('whatsapp:message', (e) => {
			try {
				const payload = JSON.parse(e.data);
				const msg = payload.message as WhatsAppMessage;
				if (!messages.some((m) => m.id === msg.id)) {
					messages = [msg, ...messages];
					if (!msg.fromMe) {
						toast.info(`Nuevo WhatsApp de ${msg.senderName}`, msg.text);
						if (!selectedRecipient) {
							selectedRecipient = msg.from;
						}
					}
				}
			} catch (_) {}
		});

		es.addEventListener('whatsapp:unconfirmed_order_created', (e) => {
			try {
				const payload = JSON.parse(e.data);
				if (payload.order) {
					unconfirmedOrders = [
						payload.order,
						...unconfirmedOrders.filter((o: any) => o.id !== payload.order.id)
					];
					toast.info(
						'Nuevo Pedido de WhatsApp',
						`El bot tomó el pedido #${payload.order.orderNumber}. Esperando comprobante de pago.`
					);
				}
			} catch (_) {}
		});

		es.addEventListener('whatsapp:proof_submitted', (e) => {
			try {
				const payload = JSON.parse(e.data);
				toast.warning(
					'Comprobante enviado',
					`El cliente +${payload.phone} notificó que envió el comprobante. Por favor verifícalo.`
				);
			} catch (_) {}
		});

		es.addEventListener('whatsapp:session_read', (e) => {
			try {
				const payload = JSON.parse(e.data);
				const cleanTarget = (payload.phone || '').replace(/\D/g, '');
				if (cleanTarget) {
					let changed = false;
					for (const m of messages) {
						const cleanFrom = m.from.replace(/\D/g, '');
						if (
							(cleanFrom === cleanTarget ||
								cleanFrom.endsWith(cleanTarget) ||
								cleanTarget.endsWith(cleanFrom)) &&
							!m.fromMe &&
							!m.isRead
						) {
							m.isRead = true;
							changed = true;
						}
					}
					if (changed) {
						messages = [...messages];
					}
				}
			} catch (_) {}
		});

		return () => {
			es.close();
		};
	});

	// Agrupar mensajes en conversaciones por número de teléfono
	interface Conversation {
		phone: string;
		contactName: string;
		lastMessage: WhatsAppMessage;
		unreadCount: number;
		messages: WhatsAppMessage[];
	}

	const conversations = $derived.by<Conversation[]>(() => {
		const map = new Map<string, Conversation>();
		const seenMsgIdsByConv = new Map<string, Set<string>>();

		for (const msg of messages) {
			const phoneKey = msg.from;
			let conv = map.get(phoneKey);
			let seenIds = seenMsgIdsByConv.get(phoneKey);
			if (!conv || !seenIds) {
				const customName = customContactNames[phoneKey];
				conv = {
					phone: phoneKey,
					contactName: customName || (msg.fromMe ? phoneKey : msg.senderName || phoneKey),
					lastMessage: msg,
					unreadCount: 0,
					messages: []
				};
				map.set(phoneKey, conv);
				seenIds = new Set<string>();
				seenMsgIdsByConv.set(phoneKey, seenIds);
			}

			// Evitar mensajes duplicados por ID dentro de la conversación
			if (msg.id && seenIds.has(msg.id)) {
				continue;
			}
			if (msg.id) {
				seenIds.add(msg.id);
			}

			const customName = customContactNames[phoneKey];
			if (customName) {
				conv.contactName = customName;
			} else if (!msg.fromMe && msg.senderName && conv.contactName === conv.phone) {
				conv.contactName = msg.senderName;
			}

			if (!msg.fromMe && !msg.isRead) {
				conv.unreadCount += 1;
			}

			conv.messages.push(msg);
		}

		const list = Array.from(map.values());
		list.sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);

		for (const conv of list) {
			conv.messages.sort((a, b) => a.timestamp - b.timestamp);
		}

		return list;
	});

	// Filtrar conversaciones por término de búsqueda
	const filteredConversations = $derived.by<Conversation[]>(() => {
		if (!contactSearch.trim()) return conversations;
		const term = contactSearch.toLowerCase().trim();
		return conversations.filter(
			(c) =>
				c.contactName.toLowerCase().includes(term) ||
				c.phone.includes(term) ||
				c.lastMessage.text.toLowerCase().includes(term)
		);
	});

	// Conversación actualmente seleccionada
	const activeConversation = $derived<Conversation | null>(
		conversations.find((c) => c.phone === selectedRecipient) ?? conversations[0] ?? null
	);

	// Pedido pendiente de confirmación correspondiente al chat activo
	const activeUnconfirmedOrder = $derived.by<any | null>(() => {
		if (!activeConversation) return null;
		const cleanActive = activeConversation.phone.replace(/\D/g, '');
		return (
			unconfirmedOrders.find((ord: any) => {
				const ordPhone = (ord.transactionId || '').replace(/\D/g, '');
				return ordPhone && (cleanActive.endsWith(ordPhone) || ordPhone.endsWith(cleanActive));
			}) ?? null
		);
	});

	// Mantener sincronizado selectedRecipient si hay conversaciones
	$effect(() => {
		if (!selectedRecipient && conversations.length > 0) {
			selectedRecipient = conversations[0].phone;
		}
	});

	// Auto-scroll al final del chat al abrir o recibir mensajes
	$effect(() => {
		if (activeConversation?.messages.length && chatScrollContainer) {
			setTimeout(() => {
				if (chatScrollContainer) {
					chatScrollContainer.scrollTop = chatScrollContainer.scrollHeight;
				}
			}, 30);
		}
	});

	async function handleToggleBot() {
		const newStatus = !botEnabled;
		botEnabled = newStatus;
		isSavingBotSettings = true;
		try {
			const res = await fetch('/api/integrations/whatsapp/bot/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					businessId: data.activeBusiness.id,
					enabled: newStatus,
					systemPrompt: botPrompt
				})
			});
			const result = await res.json();
			if (result.success) {
				toast.success(
					newStatus ? 'Bot activado' : 'Bot desactivado',
					newStatus
						? 'El bot responderá automáticamente a los mensajes de WhatsApp.'
						: 'El bot fue pausado.'
				);
			} else {
				botEnabled = !newStatus;
				toast.error('Error al actualizar bot', result.error || 'No se pudo guardar la configuración.');
			}
		} catch (e: any) {
			botEnabled = !newStatus;
			toast.error('Error de red', e.message || 'No se pudo conectar con el servidor.');
		} finally {
			isSavingBotSettings = false;
		}
	}

	async function handleSavePrompt() {
		isSavingBotSettings = true;
		try {
			const res = await fetch('/api/integrations/whatsapp/bot/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					businessId: data.activeBusiness.id,
					enabled: botEnabled,
					systemPrompt: botPrompt
				})
			});
			const result = await res.json();
			if (result.success) {
				toast.success('Prompt actualizado', 'Las instrucciones del bot fueron guardadas correctamente.');
				showBotPromptModal = false;
			} else {
				toast.error('Error al guardar prompt', result.error || 'No se pudo guardar.');
			}
		} catch (e: any) {
			toast.error('Error de red', e.message || 'No se pudo conectar.');
		} finally {
			isSavingBotSettings = false;
		}
	}

	async function handleConfirmOrder() {
		if (!selectedOrderToConfirm) return;
		isConfirmingOrder = true;
		try {
			const res = await fetch('/api/integrations/whatsapp/orders/confirm', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					businessId: data.activeBusiness.id,
					orderId: selectedOrderToConfirm.id,
					paidAmount: Number(confirmPaidAmount),
					sendWhatsApp: sendWhatsAppConfirm
				})
			});
			const result = await res.json();
			if (result.success) {
				unconfirmedOrders = unconfirmedOrders.filter((o: any) => o.id !== selectedOrderToConfirm.id);
				toast.success(
					'¡Pedido confirmado!',
					`El pedido #${selectedOrderToConfirm.orderNumber} fue confirmado e ingresó a producción.`
				);
				showConfirmOrderModal = false;
				selectedOrderToConfirm = null;
			} else {
				toast.error('Error al confirmar pedido', result.error || 'No se pudo confirmar.');
			}
		} catch (e: any) {
			toast.error('Error al confirmar pedido', e.message || 'Error de red.');
		} finally {
			isConfirmingOrder = false;
		}
	}

	async function handleStartConnect() {
		isConnecting = true;
		showQrModal = true;
		try {
			const res = await fetch('/api/integrations/whatsapp/connect', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ businessId: data.activeBusiness.id })
			});
			const result = await res.json();
			if (result.qr) {
				qrCodeData = result.qr;
				status = 'scanning_qr';
			}
		} catch (e) {
			console.error(e);
			toast.error('Error al iniciar', 'No se pudo generar la sesión de WhatsApp.');
		} finally {
			isConnecting = false;
		}
	}

	async function handleDisconnect(isLogout = false) {
		try {
			await fetch('/api/integrations/whatsapp/disconnect', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ businessId: data.activeBusiness.id, isLogout })
			});
			status = 'disconnected';
			phone = null;
			pushName = null;
			qrCodeData = null;
			showQrModal = false;
			toast.info('Sesión cerrada', isLogout ? 'Se eliminaron las credenciales.' : 'Socket desconectado.');
		} catch (e) {
			console.error(e);
		}
	}

	async function handleSendMessage() {
		const targetPhone = selectedRecipient.trim();
		const text = replyText.trim();
		if (!targetPhone || !text) return;

		isSending = true;
		try {
			const res = await fetch('/api/integrations/whatsapp/send', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					businessId: data.activeBusiness.id,
					to: targetPhone,
					text
				})
			});
			const result = await res.json();
			if (result.success) {
				replyText = '';
			} else {
				toast.error('Error al enviar', result.error || 'No se pudo enviar el mensaje.');
			}
		} catch (e: any) {
			toast.error('Error al enviar', e.message || 'Error de red.');
		} finally {
			isSending = false;
		}
	}

	async function handleMarkAsRead(msg: WhatsAppMessage) {
		msg.isRead = true;
		messages = [...messages];
		try {
			await fetch('/api/integrations/whatsapp/read', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					businessId: data.activeBusiness.id,
					messageKey: msg.key,
					messageId: msg.id
				})
			});
		} catch (e) {
			console.error(e);
		}
	}

	async function handleMarkAllAsRead(conv: Conversation) {
		for (const m of conv.messages) {
			if (!m.fromMe) {
				m.isRead = true;
			}
		}
		messages = [...messages];

		try {
			await fetch('/api/integrations/whatsapp/read', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					businessId: data.activeBusiness.id,
					phone: conv.phone
				})
			});
			toast.success('Leídos', `Mensajes de ${conv.contactName} marcados como vistos.`);
		} catch (e) {
			console.error(e);
		}
	}

	async function handleClearChat() {
		if (!activeConversation) return;
		const targetPhone = activeConversation.phone;
		isClearingChat = true;
		try {
			const res = await fetch('/api/integrations/whatsapp/chat/clear', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					businessId: data.activeBusiness.id,
					phone: targetPhone
				})
			});
			const result = await res.json();
			if (result.success) {
				messages = messages.filter((m) => m.from !== targetPhone);
				if (selectedRecipient === targetPhone) {
					selectedRecipient = '';
				}
				toast.success('Historial borrado', 'Se eliminaron los mensajes de esta conversación.');
			} else {
				toast.error('Error al borrar', result.error || 'No se pudo eliminar el historial.');
			}
		} catch (e: any) {
			toast.error('Error al borrar', e.message || 'Error de red.');
		} finally {
			isClearingChat = false;
			showClearChatModal = false;
		}
	}

	function handleStartNewChat() {
		const clean = newChatPhone.replace(/\D/g, '');
		if (clean.length < 8) {
			toast.error('Número inválido', 'Ingresa el código de país y número (ej: 5493412110779).');
			return;
		}
		selectedRecipient = clean;
		newChatPhone = '';
		showNewChatInput = false;
	}

	function formatPhoneNumber(raw: string) {
		if (!raw) return '';
		const clean = raw.replace(/\D/g, '');
		// Número móvil estándar de Argentina (549341xxxxxxx)
		if (clean.startsWith('549') && clean.length >= 12) {
			const area = clean.slice(3, 6);
			const first = clean.slice(6, 9);
			const rest = clean.slice(9);
			return `+54 9 ${area} ${first}-${rest}`;
		}
		if (clean.length >= 10) {
			return `+${clean}`;
		}
		return clean;
	}

	async function handleRenameContact() {
		if (!activeConversation) return;
		const targetPhone = activeConversation.phone;
		const newName = renameContactInput.trim();
		if (!newName) return;

		isRenamingContact = true;
		try {
			const res = await fetch('/api/integrations/whatsapp/chat/rename', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					businessId: data.activeBusiness.id,
					phone: targetPhone,
					name: newName
				})
			});
			const result = await res.json();
			if (result.success) {
				customContactNames = { ...customContactNames, [targetPhone]: newName };
				messages = messages.map((m) =>
					m.from === targetPhone && !m.fromMe ? { ...m, senderName: newName } : m
				);
				toast.success('Nombre actualizado', `El contacto ahora se muestra como "${newName}".`);
				showRenameModal = false;
			} else {
				toast.error('Error al renombrar', result.error || 'No se pudo guardar el nombre.');
			}
		} catch (e: any) {
			toast.error('Error de red', e.message || 'No se pudo conectar.');
		} finally {
			isRenamingContact = false;
		}
	}

	function formatTime(timestamp: number) {
		return new Intl.DateTimeFormat('es-AR', {
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(timestamp));
	}
</script>

<svelte:head>
	<title>Integraciones — {data.activeBusiness.name}</title>
</svelte:head>

<AppShell
	user={data.user}
	activeBusiness={data.activeBusiness}
	businesses={data.businesses}
	currentSection="integrations"
	title="Integraciones"
	description="Conecta GiveOS con tus canales de mensajería y servicios externos."
	unconfirmedOrdersCount={unconfirmedCount}
>
	<div class="mx-auto max-w-5xl space-y-6">
		<!-- TARJETA ÚNICA DE WHATSAPP -->
		<Card
			class="relative overflow-hidden border-2 {status === 'connected'
				? 'border-emerald-500/50 shadow-emerald-500/5'
				: 'border-emerald-500/30'} shadow-sm transition-all"
		>
			<div
				class="absolute -right-8 -top-8 size-28 rounded-full bg-emerald-500/10 blur-xl pointer-events-none"
			></div>

			<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 sm:p-6">
				<!-- Lado Izquierdo: Icono, Título y Texto Breve -->
				<div class="flex items-center gap-3.5 min-w-0">
					<div
						class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-xs shadow-emerald-500/30"
					>
						<svg class="size-6.5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
							<path
								d="M12.004 2C6.48 2 2 6.48 2 12c0 1.83.498 3.55 1.364 5.035L2 22l5.12-1.33A9.957 9.957 0 0012.004 22c5.523 0 10.004-4.48 10.004-10S17.527 2 12.004 2zm5.827 14.185c-.244.686-1.42 1.309-1.96 1.353-.51.042-1.157.062-3.738-.974-3.13-1.258-5.114-4.444-5.27-4.65-.157-.207-1.264-1.684-1.264-3.212 0-1.528.8-2.28 1.083-2.589.284-.31.623-.387.83-.387.208 0 .416.002.599.012.193.01.45.074.704.64.265.592.906 2.215.986 2.378.08.163.133.354.026.568-.106.213-.16.347-.318.533-.16.186-.337.416-.48.558-.16.158-.328.33-.14.653.187.324.832 1.371 1.786 2.222 1.228 1.094 2.263 1.433 2.586 1.593.324.16.513.134.704-.085.191-.22.822-.958 1.042-1.286.22-.328.44-.274.743-.162.304.112 1.93.91 2.261 1.074.33.164.55.244.63.382.08.138.08.802-.164 1.488z"
							/>
						</svg>
					</div>

					<div class="space-y-0.5">
						<div class="flex items-center gap-2">
							<h3 class="text-base font-bold text-foreground">WhatsApp</h3>
							{#if status === 'connected'}
								<span
									class="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 font-mono"
								>
									<span class="size-1.5 rounded-full bg-emerald-500"></span>
									+{phone}
								</span>
							{/if}
						</div>
						<p class="text-xs text-muted-foreground">
							Recibí mensajes en la plataforma.
						</p>
					</div>
				</div>

				<!-- Lado Derecho: Estado y Acción -->
				<div class="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
					{#if status === 'connected'}
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={() => (showDisconnectModal = true)}
							class="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
						>
							<LogOut class="size-3.5 mr-1" />
							Desvincular
						</Button>
					{:else if status === 'scanning_qr'}
						<Button
							type="button"
							size="sm"
							onclick={() => (showQrModal = true)}
							class="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
						>
							<QrCode class="size-4" />
							<span>Ver Código QR</span>
						</Button>
					{:else}
						<Button
							type="button"
							size="sm"
							onclick={handleStartConnect}
							disabled={isConnecting}
							class="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
						>
							{#if isConnecting}
								<RefreshCw class="size-4 animate-spin" />
								<span>Iniciando...</span>
							{:else}
								<QrCode class="size-4" />
								<span>Vincular con QR</span>
							{/if}
						</Button>
					{/if}
				</div>
			</div>

			<!-- SUB-BARRA: BOT DE VENTAS IA (GEMMA 4) -->
			<div
				class="border-t border-border/80 bg-muted/20 px-5 sm:px-6 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
			>
				<div class="flex items-center gap-3 min-w-0">
					<div
						class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold shadow-2xs"
					>
						<Bot class="size-4.5" />
					</div>
					<div>
						<div class="flex items-center gap-2">
							<span class="text-xs font-bold text-foreground">Bot de Ventas IA (Gemma 4)</span>
							{#if botEnabled}
								<span
									class="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400"
								>
									<span class="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
									Activo
								</span>
							{:else}
								<span
									class="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border"
								>
									Inactivo
								</span>
							{/if}
						</div>
						<p class="text-[11px] text-muted-foreground">
							Atiende a los clientes, toma los datos del pedido paso a paso y solicita comprobante de pago.
						</p>
					</div>
				</div>

				<div class="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
					<Button
						href="/chat-test"
						variant="outline"
						size="sm"
						class="h-8 text-xs gap-1.5 font-medium border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10"
					>
						<Sparkles class="size-3.5 text-purple-600" />
						<span>Probar Bot</span>
					</Button>

					<Button
						type="button"
						variant="outline"
						size="sm"
						onclick={() => (showBotPromptModal = true)}
						class="h-8 text-xs gap-1.5 font-medium"
					>
						<Settings2 class="size-3.5" />
						<span>Configurar Prompt</span>
					</Button>

					<button
						type="button"
						role="switch"
						aria-checked={botEnabled}
						onclick={handleToggleBot}
						disabled={isSavingBotSettings}
						class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none {botEnabled
							? 'bg-emerald-600'
							: 'bg-muted-foreground/30'}"
						title={botEnabled ? 'Desactivar bot' : 'Activar bot'}
					>
						<span
							class="pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {botEnabled
								? 'translate-x-5'
								: 'translate-x-0'}"
						></span>
					</button>
				</div>
			</div>
		</Card>

		<!-- SECCIÓN MENSAJES (SÓLO SI ESTÁ HABILITADO / CONECTADO) -->
		{#if status === 'connected'}
			<div class="space-y-3 animate-in fade-in duration-300">
				<div class="flex items-center justify-between">
					<h3 class="text-sm font-bold text-foreground flex items-center gap-2">
						<MessageSquare class="size-4 text-emerald-600" />
						<span>Mensajes</span>
					</h3>
					<span class="font-mono text-xs text-muted-foreground">
						{conversations.length} {conversations.length === 1 ? 'conversación' : 'conversaciones'}
					</span>
				</div>

				<!-- Interfaz de Chat Estilo Mensajería -->
				<div
					class="grid grid-cols-1 md:grid-cols-12 rounded-2xl border border-border bg-card shadow-sm overflow-hidden h-[540px]"
				>
					<!-- Columna Izquierda: Lista de Conversaciones (4 cols) -->
					<div
						class="md:col-span-4 border-r border-border bg-muted/10 flex flex-col h-full overflow-hidden"
					>
						<!-- Buscador y Nuevo Chat -->
						<div class="p-3 border-b border-border space-y-2 shrink-0">
							<div class="flex items-center gap-1.5">
								<div class="relative flex-1">
									<Search class="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
									<Input
										bind:value={contactSearch}
										placeholder="Buscar chat o teléfono..."
										class="h-8.5 pl-8 text-xs bg-background"
									/>
								</div>
								<Button
									type="button"
									size="icon"
									variant="outline"
									class="size-8.5 shrink-0"
									title="Nuevo chat"
									onclick={() => (showNewChatInput = !showNewChatInput)}
								>
									<Plus class="size-4" />
								</Button>
							</div>

							{#if showNewChatInput}
								<div class="flex items-center gap-1.5 p-1 bg-background rounded-xl border border-border">
									<Input
										bind:value={newChatPhone}
										placeholder="549341..."
										class="h-7 text-xs border-0 focus-visible:ring-0"
										onkeydown={(e) => e.key === 'Enter' && handleStartNewChat()}
									/>
									<Button
										type="button"
										size="sm"
										class="h-7 px-2.5 text-xs bg-emerald-600 text-white"
										onclick={handleStartNewChat}
									>
										Abrir
									</Button>
								</div>
							{/if}
						</div>

						<!-- Lista Scrollable de Contactos -->
						<div class="flex-1 overflow-y-auto divide-y divide-border/60">
							{#if filteredConversations.length === 0}
								<div class="flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-2">
									<MessageSquare class="size-6 text-muted-foreground/60" />
									<p class="text-xs">No hay conversaciones</p>
								</div>
							{:else}
								{#each filteredConversations as conv (conv.phone)}
									{@const isSelected = activeConversation?.phone === conv.phone}
									{@const hasUnconfirmed = unconfirmedOrders.some((ord: any) => {
										const ordPhone = (ord.transactionId || '').replace(/\D/g, '');
										return ordPhone && (conv.phone.endsWith(ordPhone) || ordPhone.endsWith(conv.phone));
									})}
									<button
										type="button"
										onclick={() => {
											selectedRecipient = conv.phone;
											if (conv.unreadCount > 0) {
												handleMarkAllAsRead(conv);
											}
										}}
										class="w-full text-left p-3 transition-colors flex items-start gap-3 cursor-pointer {isSelected
											? 'bg-muted/80 border-l-3 border-emerald-600'
											: 'hover:bg-muted/40'}"
									>
										<!-- Avatar con Iniciales -->
										<div
											class="flex size-9.5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 font-bold text-xs text-emerald-700 dark:text-emerald-400"
										>
											{conv.contactName.charAt(0).toUpperCase()}
										</div>

										<div class="flex-1 min-w-0 space-y-0.5">
											<div class="flex items-center justify-between gap-1">
												<div class="flex items-center gap-1.5 min-w-0">
													<span class="text-xs font-bold text-foreground truncate">
														{conv.contactName === conv.phone
															? formatPhoneNumber(conv.phone)
															: conv.contactName}
													</span>
													{#if hasUnconfirmed}
														<span
															class="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0"
														>
															Pedido
														</span>
													{/if}
												</div>
												<span class="text-[10px] text-muted-foreground shrink-0 font-mono">
													{formatTime(conv.lastMessage.timestamp)}
												</span>
											</div>

											{#if conv.contactName !== conv.phone}
												<span class="block text-[10.5px] font-mono text-muted-foreground/80 truncate -mt-0.5">
													{formatPhoneNumber(conv.phone)}
												</span>
											{/if}

											<div class="flex items-center justify-between gap-2">
												<p class="text-[11px] text-muted-foreground truncate leading-tight">
													{#if conv.lastMessage.fromMe}
														<span class="text-foreground">Tú: </span>
													{/if}
													{conv.lastMessage.text}
												</p>
												{#if conv.unreadCount > 0}
													<span
														class="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white font-mono"
													>
														{conv.unreadCount}
													</span>
												{/if}
											</div>
										</div>
									</button>
								{/each}
							{/if}
						</div>
					</div>

					<!-- Columna Derecha: Hilo de Chat y Barra de Entrada (8 cols) -->
					<div class="md:col-span-8 flex flex-col h-full bg-background overflow-hidden">
						{#if activeConversation}
							<!-- Header del Chat Activo -->
							<div
								class="p-3.5 border-b border-border bg-card flex items-center justify-between gap-3 shrink-0"
							>
								<div class="flex items-center gap-2.5 min-w-0">
									<div
										class="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 font-bold text-xs text-emerald-700 dark:text-emerald-400"
									>
										{activeConversation.contactName.charAt(0).toUpperCase()}
									</div>
									<div class="min-w-0">
										<div class="flex items-center gap-1.5">
											<h4 class="text-xs font-bold text-foreground truncate">
												{activeConversation.contactName === activeConversation.phone
													? formatPhoneNumber(activeConversation.phone)
													: activeConversation.contactName}
											</h4>
											<button
												type="button"
												class="text-muted-foreground/60 hover:text-foreground transition-colors p-0.5 rounded hover:bg-muted cursor-pointer"
												title="Editar nombre del contacto"
												onclick={() => {
													renameContactInput =
														activeConversation.contactName === activeConversation.phone
															? ''
															: activeConversation.contactName;
													showRenameModal = true;
												}}
											>
												<Pencil class="size-3" />
											</button>
										</div>
										{#if activeConversation.contactName !== activeConversation.phone}
											<span class="font-mono text-[10.5px] text-muted-foreground block -mt-0.5">
												{formatPhoneNumber(activeConversation.phone)}
											</span>
										{/if}
									</div>
								</div>

								<div class="flex items-center gap-1.5 shrink-0">
									{#if activeConversation.unreadCount > 0}
										<Button
											type="button"
											variant="ghost"
											size="sm"
											class="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
											onclick={() => handleMarkAllAsRead(activeConversation)}
											title="Marcar todos como leídos"
										>
											<Eye class="size-3.5 mr-1 text-sky-600" />
											<span>Marcar leído</span>
										</Button>
									{/if}
									<Button
										href="/orders/new"
										variant="outline"
										size="sm"
										class="h-7 gap-1 px-2.5 text-xs font-semibold"
										title="Crear orden para este cliente"
									>
										<ShoppingBag class="size-3.5 text-primary" />
										<span>Crear Orden</span>
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										class="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
										onclick={() => (showClearChatModal = true)}
										title="Borrar historial de este chat"
									>
										<Trash2 class="size-3.5" />
									</Button>
								</div>
							</div>

							<!-- Banner de Pedido Pendiente de Confirmación -->
							{#if activeUnconfirmedOrder}
								<div
									class="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/25 flex flex-wrap items-center justify-between gap-3 shrink-0 animate-in fade-in"
								>
									<div class="flex items-center gap-2.5 min-w-0">
										<div
											class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400"
										>
											<AlertCircle class="size-4" />
										</div>
										<div class="min-w-0">
											<div class="flex items-center gap-2">
												<span class="text-xs font-bold text-amber-900 dark:text-amber-200">
													Pedido #{activeUnconfirmedOrder.orderNumber} por confirmar
												</span>
												<span class="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
													${activeUnconfirmedOrder.totalAmount?.toLocaleString('es-AR')}
												</span>
											</div>
											<p class="text-[11px] text-amber-800/80 dark:text-amber-300/80 truncate">
												{activeUnconfirmedOrder.notes || 'El cliente envió aviso de comprobante de pago.'}
											</p>
										</div>
									</div>

									<Button
										type="button"
										size="sm"
										class="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-xs"
										onclick={() => {
											selectedOrderToConfirm = activeUnconfirmedOrder;
											confirmPaidAmount = activeUnconfirmedOrder.totalAmount || 0;
											sendWhatsAppConfirm = true;
											showConfirmOrderModal = true;
										}}
									>
										<Check class="size-3.5" />
										<span>Confirmar Pedido</span>
									</Button>
								</div>
							{/if}

							<!-- Flujo de Mensajes (Scrollable) -->
							<div
								bind:this={chatScrollContainer}
								class="flex-1 overflow-y-auto p-4 space-y-2.5 bg-muted/15"
							>
								{#each activeConversation.messages as msg, i (msg.id ? `${msg.id}_${i}` : `msg_${i}`)}
									<div class="flex {msg.fromMe ? 'justify-end' : 'justify-start'}">
										<div
											class="relative max-w-[82%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 text-xs shadow-2xs leading-relaxed {msg.fromMe
												? 'bg-emerald-600 text-white rounded-tr-xs'
												: 'bg-card border border-border text-foreground rounded-tl-xs'}"
										>
											<p class="break-words font-normal">
												{msg.text}
											</p>

											<div
												class="mt-1 flex items-center justify-end gap-1 text-[9px] {msg.fromMe
													? 'text-emerald-100'
													: 'text-muted-foreground'}"
											>
												<span>{formatTime(msg.timestamp)}</span>
												{#if msg.fromMe}
													<CheckCheck class="size-3 text-sky-200" />
												{:else if !msg.isRead}
													<button
														type="button"
														onclick={() => handleMarkAsRead(msg)}
														class="underline hover:text-foreground ml-1"
														title="Marcar como visto"
													>
														Visto
													</button>
												{/if}
											</div>
										</div>
									</div>
								{/each}
							</div>

							<!-- Barra de Entrada Inferior -->
							<div class="p-3 border-t border-border bg-card shrink-0">
								<form
									onsubmit={(e) => {
										e.preventDefault();
										handleSendMessage();
									}}
									class="flex items-center gap-2"
								>
									<Input
										bind:value={replyText}
										placeholder="Escribe un mensaje a {activeConversation.contactName}..."
										class="h-9.5 text-xs bg-background"
										disabled={isSending}
									/>
									<Button
										type="submit"
										size="icon"
										disabled={isSending || !replyText.trim()}
										class="size-9.5 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 rounded-xl"
										title="Enviar mensaje"
									>
										{#if isSending}
											<RefreshCw class="size-4 animate-spin" />
										{:else}
											<Send class="size-4" />
										{/if}
									</Button>
								</form>
							</div>
						{:else}
							<div
								class="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-2"
							>
								<MessageSquare class="size-8 text-muted-foreground/40" />
								<p class="text-xs">Selecciona una conversación para ver los mensajes</p>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- MODAL: ESCANEO DE CÓDIGO QR -->
	{#if showQrModal}
		<div
			class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 p-0 sm:p-4 backdrop-blur-[1px]"
			role="dialog"
			aria-modal="true"
		>
			<div
				class="w-full max-w-full sm:max-w-md overflow-hidden rounded-t-2xl sm:rounded-2xl border-t sm:border border-border bg-card shadow-2xl"
			>
				<!-- Header Modal -->
				<div
					class="flex items-center justify-between border-b border-border bg-card/95 backdrop-blur-sm p-5"
				>
					<div class="flex items-center gap-2.5">
						<div
							class="flex size-9 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-xs"
						>
							<QrCode class="size-5" />
						</div>
						<div>
							<h3 class="text-sm font-bold text-foreground">
								Vincular WhatsApp
							</h3>
							<p class="text-xs text-muted-foreground">
								Escanea el código QR desde tu teléfono
							</p>
						</div>
					</div>

					<Button
						type="button"
						size="icon"
						variant="ghost"
						class="size-8"
						onclick={() => (showQrModal = false)}
					>
						<X class="size-4" />
					</Button>
				</div>

				<!-- Contenido del Modal -->
				<div class="p-6 space-y-5">
					<div class="flex justify-center">
						<div
							class="relative flex size-56 items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card p-3 shadow-inner"
						>
							{#if qrCodeData && typeof qrCodeData === 'string' && qrCodeData.startsWith('data:')}
								<img
									src={qrCodeData}
									alt="Código QR de WhatsApp"
									class="size-full object-contain rounded-lg animate-in fade-in"
								/>
							{:else}
								<div
									class="flex flex-col items-center justify-center gap-2.5 text-center text-muted-foreground p-4"
								>
									<RefreshCw class="size-8 text-emerald-600 animate-spin" />
									<span class="text-xs font-semibold">Generando código QR...</span>
									<span class="text-[10px] text-muted-foreground">
										Conectando al socket de WhatsApp...
									</span>
								</div>
							{/if}
						</div>
					</div>

					<div class="space-y-2 text-xs text-foreground bg-muted/30 p-3.5 rounded-xl border border-border">
						<div class="flex items-start gap-2">
							<span class="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">1</span>
							<p>Abre <strong>WhatsApp</strong> en tu teléfono celular.</p>
						</div>
						<div class="flex items-start gap-2">
							<span class="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">2</span>
							<p>Toca <strong>Dispositivos vinculados</strong> en Menú (⋮) o Configuración.</p>
						</div>
						<div class="flex items-start gap-2">
							<span class="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">3</span>
							<p>Selecciona <strong>Vincular un dispositivo</strong> y apunta al código.</p>
						</div>
					</div>
				</div>

				<div class="flex justify-end border-t border-border bg-muted/20 px-5 py-3">
					<Button
						type="button"
						size="sm"
						variant="outline"
						onclick={() => (showQrModal = false)}
					>
						Cerrar
					</Button>
				</div>
			</div>
		</div>
	{/if}

	<!-- MODAL: CONFIRMACIÓN DE DESVINCULACIÓN -->
	{#if showDisconnectModal}
		<div
			class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 p-0 sm:p-4 backdrop-blur-[1px] animate-in fade-in"
			role="dialog"
			aria-modal="true"
		>
			<div
				class="w-full max-w-full sm:max-w-md overflow-hidden rounded-t-2xl sm:rounded-2xl border-t sm:border border-border bg-card shadow-2xl animate-in zoom-in-95"
			>
				<div class="flex items-center justify-between border-b border-border bg-card/95 p-5">
					<div class="flex items-center gap-2.5">
						<div
							class="flex size-9 items-center justify-center rounded-xl bg-destructive/15 text-destructive"
						>
							<LogOut class="size-5" />
						</div>
						<div>
							<h3 class="text-sm font-bold text-foreground">¿Desvincular WhatsApp?</h3>
							<p class="text-xs text-muted-foreground">Confirmar cierre de sesión</p>
						</div>
					</div>
					<Button
						type="button"
						size="icon"
						variant="ghost"
						class="size-8"
						onclick={() => (showDisconnectModal = false)}
						disabled={isDisconnecting}
					>
						<X class="size-4" />
					</Button>
				</div>

				<div class="p-6 space-y-3">
					<p class="text-xs text-muted-foreground leading-relaxed">
						Se cerrará la sesión del número vinculado
						{#if phone}
							<strong class="text-foreground font-mono">+{phone}</strong>
						{/if}
						en este negocio.
					</p>
					<div
						class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300"
					>
						⚠️ Dejarás de recibir y enviar mensajes desde la plataforma hasta que vuelvas a escanear el código QR.
					</div>
				</div>

				<div class="flex items-center justify-end gap-2 border-t border-border bg-muted/20 px-5 py-3">
					<Button
						type="button"
						size="sm"
						variant="outline"
						onclick={() => (showDisconnectModal = false)}
						disabled={isDisconnecting}
					>
						Cancelar
					</Button>
					<Button
						type="button"
						size="sm"
						variant="destructive"
						disabled={isDisconnecting}
						onclick={async () => {
							isDisconnecting = true;
							try {
								await handleDisconnect(true);
							} finally {
								isDisconnecting = false;
								showDisconnectModal = false;
							}
						}}
					>
						{#if isDisconnecting}
							<RefreshCw class="size-3.5 animate-spin mr-1" />
							<span>Desvinculando...</span>
						{:else}
							<LogOut class="size-3.5 mr-1" />
							<span>Sí, desvincular</span>
						{/if}
					</Button>
				</div>
			</div>
		</div>
	{/if}

	<!-- MODAL: CONFIRMACIÓN BORRAR HISTORIAL DE CHAT -->
	{#if showClearChatModal && activeConversation}
		<div
			class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 p-0 sm:p-4 backdrop-blur-[1px] animate-in fade-in"
			role="dialog"
			aria-modal="true"
		>
			<div
				class="w-full max-w-full sm:max-w-md overflow-hidden rounded-t-2xl sm:rounded-2xl border-t sm:border border-border bg-card shadow-2xl animate-in zoom-in-95"
			>
				<div class="flex items-center justify-between border-b border-border bg-card/95 p-5">
					<div class="flex items-center gap-2.5">
						<div
							class="flex size-9 items-center justify-center rounded-xl bg-destructive/15 text-destructive"
						>
							<Trash2 class="size-5" />
						</div>
						<div>
							<h3 class="text-sm font-bold text-foreground">¿Borrar historial de chat?</h3>
							<p class="text-xs text-muted-foreground">Eliminación permanente</p>
						</div>
					</div>
					<Button
						type="button"
						size="icon"
						variant="ghost"
						class="size-8"
						onclick={() => (showClearChatModal = false)}
						disabled={isClearingChat}
					>
						<X class="size-4" />
					</Button>
				</div>

				<div class="p-6 space-y-3">
					<p class="text-xs text-muted-foreground leading-relaxed">
						Se eliminarán todos los mensajes guardados de la conversación con
						<strong class="text-foreground">{activeConversation.contactName}</strong>
						<span class="font-mono text-[11px] text-muted-foreground">(+{activeConversation.phone})</span>.
					</p>
					<div
						class="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive leading-relaxed"
					>
						⚠️ Esta acción eliminará los mensajes de la base de datos de GiveOS de forma irreversible.
					</div>
				</div>

				<div class="flex items-center justify-end gap-2 border-t border-border bg-muted/20 px-5 py-3">
					<Button
						type="button"
						size="sm"
						variant="outline"
						onclick={() => (showClearChatModal = false)}
						disabled={isClearingChat}
					>
						Cancelar
					</Button>
					<Button
						type="button"
						size="sm"
						variant="destructive"
						disabled={isClearingChat}
						onclick={handleClearChat}
					>
						{#if isClearingChat}
							<RefreshCw class="size-3.5 animate-spin mr-1" />
							<span>Borrando...</span>
						{:else}
							<Trash2 class="size-3.5 mr-1" />
							<span>Sí, borrar historial</span>
						{/if}
					</Button>
				</div>
			</div>
		</div>
	{/if}

	<!-- MODAL: CONFIGURAR PROMPT DEL BOT DE VENTAS -->
	{#if showBotPromptModal}
		<div
			class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 p-0 sm:p-4 backdrop-blur-[1px] animate-in fade-in"
			role="dialog"
			aria-modal="true"
		>
			<div
				class="w-full max-w-full sm:max-w-2xl overflow-hidden rounded-t-2xl sm:rounded-2xl border-t sm:border border-border bg-card shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col"
			>
				<div class="flex items-center justify-between border-b border-border bg-card/95 p-5 shrink-0">
					<div class="flex items-center gap-2.5">
						<div
							class="flex size-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400"
						>
							<Bot class="size-5" />
						</div>
						<div>
							<h3 class="text-sm font-bold text-foreground">Configurar Bot de Ventas</h3>
							<p class="text-xs text-muted-foreground">Instrucciones y comportamiento de Gemma 4</p>
						</div>
					</div>
					<Button
						type="button"
						size="icon"
						variant="ghost"
						class="size-8"
						onclick={() => (showBotPromptModal = false)}
						disabled={isSavingBotSettings}
					>
						<X class="size-4" />
					</Button>
				</div>

				<div class="p-6 space-y-4 overflow-y-auto flex-1">
					<div class="space-y-1.5">
						<div class="flex items-center justify-between">
							<label for="bot-prompt-input" class="text-xs font-bold text-foreground">
								Prompt del Sistema (Instrucciones)
							</label>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								class="h-6 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
								onclick={() => (botPrompt = DEFAULT_BOT_PROMPT)}
							>
								<RotateCcw class="size-3" />
								<span>Restaurar por defecto</span>
							</Button>
						</div>
						<textarea
							id="bot-prompt-input"
							bind:value={botPrompt}
							rows="14"
							class="w-full rounded-xl border border-input bg-background p-3.5 text-xs font-mono leading-relaxed placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
							placeholder="Escribe el prompt del sistema..."
						></textarea>
					</div>

					<div class="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
						<p class="font-semibold text-foreground">🛠️ Herramientas disponibles para el modelo:</p>
						<ul class="list-disc list-inside space-y-0.5 text-[11px]">
							<li><code class="font-mono text-foreground font-semibold">get_catalog()</code>: Consulta productos activos y precios.</li>
							<li><code class="font-mono text-foreground font-semibold">get_business_info()</code>: Consulta CBU, Alias y datos del negocio.</li>
							<li><code class="font-mono text-foreground font-semibold">create_unconfirmed_order(items, customerName, notes, deliveryDate)</code>: Registra la orden pendiente.</li>
						</ul>
					</div>
				</div>

				<div class="flex items-center justify-end gap-2 border-t border-border bg-muted/20 px-5 py-3 shrink-0">
					<Button
						type="button"
						size="sm"
						variant="outline"
						onclick={() => (showBotPromptModal = false)}
						disabled={isSavingBotSettings}
					>
						Cancelar
					</Button>
					<Button
						type="button"
						size="sm"
						class="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
						disabled={isSavingBotSettings}
						onclick={handleSavePrompt}
					>
						{#if isSavingBotSettings}
							<RefreshCw class="size-3.5 animate-spin mr-1" />
							<span>Guardando...</span>
						{:else}
							<Check class="size-3.5 mr-1" />
							<span>Guardar Configuración</span>
						{/if}
					</Button>
				</div>
			</div>
		</div>
	{/if}

	<!-- MODAL: CONFIRMACIÓN MANUAL DE PEDIDO -->
	{#if showConfirmOrderModal && selectedOrderToConfirm}
		<div
			class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 p-0 sm:p-4 backdrop-blur-[1px] animate-in fade-in"
			role="dialog"
			aria-modal="true"
		>
			<div
				class="w-full max-w-full sm:max-w-md overflow-hidden rounded-t-2xl sm:rounded-2xl border-t sm:border border-border bg-card shadow-2xl animate-in zoom-in-95"
			>
				<div class="flex items-center justify-between border-b border-border bg-card/95 p-5">
					<div class="flex items-center gap-2.5">
						<div
							class="flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
						>
							<ShoppingBag class="size-5" />
						</div>
						<div>
							<h3 class="text-sm font-bold text-foreground">
								Confirmar Pedido #{selectedOrderToConfirm.orderNumber}
							</h3>
							<p class="text-xs text-muted-foreground">Verificación de comprobante bancario</p>
						</div>
					</div>
					<Button
						type="button"
						size="icon"
						variant="ghost"
						class="size-8"
						onclick={() => (showConfirmOrderModal = false)}
						disabled={isConfirmingOrder}
					>
						<X class="size-4" />
					</Button>
				</div>

				<div class="p-6 space-y-4">
					<div class="rounded-xl border border-border bg-muted/30 p-3.5 space-y-2 text-xs">
						<div class="flex justify-between items-center">
							<span class="text-muted-foreground">Cliente:</span>
							<strong class="text-foreground">{selectedOrderToConfirm.customerName}</strong>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-muted-foreground">Teléfono:</span>
							<span class="font-mono text-foreground">+{selectedOrderToConfirm.transactionId}</span>
						</div>
						<div class="flex justify-between items-center border-t border-border/60 pt-2">
							<span class="text-muted-foreground">Total del pedido:</span>
							<strong class="text-sm font-mono text-emerald-600 dark:text-emerald-400">
								${selectedOrderToConfirm.totalAmount?.toLocaleString('es-AR')}
							</strong>
						</div>
						{#if selectedOrderToConfirm.notes}
							<div class="border-t border-border/60 pt-2">
								<span class="text-muted-foreground">Detalles / Notas:</span>
								<p class="mt-0.5 text-foreground leading-relaxed">{selectedOrderToConfirm.notes}</p>
							</div>
						{/if}
					</div>

					<div class="space-y-1.5">
						<label for="confirm-paid-amount" class="text-xs font-bold text-foreground">
							Monto recibido según comprobante ($)
						</label>
						<Input
							id="confirm-paid-amount"
							type="number"
							min="0"
							step="0.01"
							bind:value={confirmPaidAmount}
							class="h-9.5 text-xs font-mono"
							placeholder="Monto transferido..."
						/>
						<p class="text-[11px] text-muted-foreground">
							Si el monto coincide con el total, el estado de pago quedará como pagado.
						</p>
					</div>

					<label class="flex items-center gap-2 cursor-pointer text-xs text-foreground select-none">
						<input
							type="checkbox"
							bind:checked={sendWhatsAppConfirm}
							class="size-4 rounded border-border text-emerald-600 focus:ring-emerald-500"
						/>
						<span>Enviar mensaje automático de confirmación por WhatsApp</span>
					</label>
				</div>

				<div class="flex items-center justify-end gap-2 border-t border-border bg-muted/20 px-5 py-3">
					<Button
						type="button"
						size="sm"
						variant="outline"
						onclick={() => (showConfirmOrderModal = false)}
						disabled={isConfirmingOrder}
					>
						Cancelar
					</Button>
					<Button
						type="button"
						size="sm"
						class="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
						disabled={isConfirmingOrder}
						onclick={handleConfirmOrder}
					>
						{#if isConfirmingOrder}
							<RefreshCw class="size-3.5 animate-spin mr-1" />
							<span>Confirmando...</span>
						{:else}
							<Check class="size-3.5 mr-1" />
							<span>Confirmar y Notificar</span>
						{/if}
					</Button>
				</div>
			</div>
		</div>
	{/if}

	<!-- MODAL: RENOMBRAR CONTACTO -->
	{#if showRenameModal && activeConversation}
		<div
			class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 p-0 sm:p-4 backdrop-blur-[1px] animate-in fade-in"
			role="dialog"
			aria-modal="true"
		>
			<div
				class="w-full max-w-full sm:max-w-sm overflow-hidden rounded-t-2xl sm:rounded-2xl border-t sm:border border-border bg-card shadow-2xl animate-in zoom-in-95"
			>
				<div class="flex items-center justify-between border-b border-border bg-card/95 p-4">
					<div class="flex items-center gap-2">
						<div
							class="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary"
						>
							<Pencil class="size-4" />
						</div>
						<div>
							<h3 class="text-xs font-bold text-foreground">Editar Nombre</h3>
							<p class="text-[10px] text-muted-foreground font-mono">
								{formatPhoneNumber(activeConversation.phone)}
							</p>
						</div>
					</div>
					<Button
						type="button"
						size="icon"
						variant="ghost"
						class="size-7"
						onclick={() => (showRenameModal = false)}
						disabled={isRenamingContact}
					>
						<X class="size-3.5" />
					</Button>
				</div>

				<form
					onsubmit={(e) => {
						e.preventDefault();
						handleRenameContact();
					}}
					class="p-4 space-y-3"
				>
					<div class="space-y-1">
						<label for="rename-contact-input" class="text-xs font-medium text-foreground">
							Nombre del contacto o cliente
						</label>
						<Input
							id="rename-contact-input"
							bind:value={renameContactInput}
							placeholder="Ej: Rita o Marcos Gómez..."
							class="h-9 text-xs"
						/>
					</div>

					<div class="flex items-center justify-end gap-2 pt-2">
						<Button
							type="button"
							size="sm"
							variant="outline"
							onclick={() => (showRenameModal = false)}
							disabled={isRenamingContact}
						>
							Cancelar
						</Button>
						<Button
							type="submit"
							size="sm"
							class="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
							disabled={isRenamingContact || !renameContactInput.trim()}
						>
							{#if isRenamingContact}
								<RefreshCw class="size-3.5 animate-spin mr-1" />
								<span>Guardando...</span>
							{:else}
								<Check class="size-3.5 mr-1" />
								<span>Guardar</span>
							{/if}
						</Button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</AppShell>
