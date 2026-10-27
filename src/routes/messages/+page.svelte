<script lang="ts">
	import type { PageProps } from './$types';
	import AppShell from '#lib/components/layout/app-shell.svelte';
	import { Button } from '#lib/components/ui/button';
	import { Badge } from '#lib/components/ui/badge';
	import { Input } from '#lib/components/ui/input';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import X from '@lucide/svelte/icons/x';
	import Send from '@lucide/svelte/icons/send';
	import Check from '@lucide/svelte/icons/check';
	import CheckCheck from '@lucide/svelte/icons/check-check';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Bot from '@lucide/svelte/icons/bot';
	import Settings2 from '@lucide/svelte/icons/settings-2';
	import Pencil from '@lucide/svelte/icons/pencil';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import { Switch } from '#lib/components/ui/switch';
	import { toast } from '#lib/components/ui/toast';
	import { DEFAULT_BOT_PROMPT } from '#lib/features/ai/domain/bot-prompt.constants';
	import type {
		WhatsAppMessage,
		WhatsAppSessionStatus
	} from '#lib/features/integrations/whatsapp/domain/whatsapp.entity';

	let { data }: PageProps = $props();

	let showClearChatModal = $state(false);
	let isClearingChat = $state(false);

	// Estado reactivo de la sesión
	let status = $state<WhatsAppSessionStatus>('disconnected');
	let phone = $state<string | null>(null);
	let pushName = $state<string | null>(null);
	let messages = $state<WhatsAppMessage[]>([]);

	let isSending = $state(false);
	let replyText = $state('');
	let selectedRecipient = $state<string>('');
	let contactSearch = $state<string>('');
	let showNewChatInput = $state(false);
	let newChatPhone = $state('');

	// Estado del Bot de Ventas IA y Pedidos No Confirmados
	let botEnabled = $state(false);
	let botPrompt = $state(DEFAULT_BOT_PROMPT);
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
	const isConnected = $derived(status === 'connected' && !!phone);

	// Sincronizar estado inicial desde el servidor
	$effect(() => {
		if (data.initialWhatsAppSession) {
			status = data.initialWhatsAppSession.status || 'disconnected';
			phone = data.initialWhatsAppSession.phone || null;
			pushName = data.initialWhatsAppSession.pushName || null;

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

	// Conectar a EventSource SSE para eventos en tiempo real
	$effect(() => {
		if (typeof window === 'undefined') return;

		const es = new EventSource(`/api/realtime?business=${data.activeBusiness.id}`);

		es.addEventListener('whatsapp:status', (e) => {
			try {
				const payload = JSON.parse(e.data);
				status = payload.status;
				phone = payload.phone ?? null;
				pushName = payload.pushName ?? null;
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

	async function handleToggleBot(newVal?: boolean) {
		const targetStatus = typeof newVal === 'boolean' ? newVal : !botEnabled;
		botEnabled = targetStatus;
		isSavingBotSettings = true;
		try {
			const res = await fetch('/api/integrations/whatsapp/bot/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					businessId: data.activeBusiness.id,
					enabled: targetStatus
				})
			});
			const result = await res.json();
			if (result.success) {
				toast.success(
					targetStatus ? 'Bot activado' : 'Bot pausado',
					targetStatus
						? 'El bot responderá automáticamente a los mensajes de WhatsApp.'
						: 'El bot fue pausado. Ahora puedes responder manualmente.'
				);
			} else {
				botEnabled = !targetStatus;
				toast.error('Error al actualizar bot', result.error || 'No se pudo guardar la configuración.');
			}
		} catch (e: any) {
			botEnabled = !targetStatus;
			toast.error('Error de red', e.message || 'No se pudo conectar con el servidor.');
		} finally {
			isSavingBotSettings = false;
		}
	}

	function openConfirmOrderModal(order: any) {
		selectedOrderToConfirm = order;
		confirmPaidAmount = order.totalAmount;
		showConfirmOrderModal = true;
	}

	async function handleConfirmOrder() {
		if (!selectedOrderToConfirm) return;
		isConfirmingOrder = true;
		try {
			const res = await fetch('/api/integrations/whatsapp/orders/confirm', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					orderId: selectedOrderToConfirm.id,
					paidAmount: confirmPaidAmount,
					sendWhatsApp: sendWhatsAppConfirm
				})
			});
			const result = await res.json();
			if (result.success) {
				toast.success(
					'¡Pedido confirmado!',
					`La orden #${selectedOrderToConfirm.orderNumber} pasó a estado confirmado.`
				);
				unconfirmedOrders = unconfirmedOrders.filter((o) => o.id !== selectedOrderToConfirm.id);
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

	async function handleSendMessage(e?: Event) {
		if (e) e.preventDefault();
		const text = replyText.trim();
		const target = selectedRecipient;
		if (!text || !target || isSending) return;

		isSending = true;
		try {
			const res = await fetch('/api/integrations/whatsapp/send', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					businessId: data.activeBusiness.id,
					to: target,
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
				toast.success('Chat vaciado', 'El historial del chat fue borrado con éxito.');
				showClearChatModal = false;
			} else {
				toast.error('Error al vaciar chat', result.error || 'No se pudo borrar el historial.');
			}
		} catch (e: any) {
			toast.error('Error', e.message || 'Error de conexión.');
		} finally {
			isClearingChat = false;
		}
	}

	function handleStartNewChat() {
		const clean = newChatPhone.replace(/\D/g, '');
		if (clean.length < 8) {
			toast.error('Número inválido', 'Ingresa un número de WhatsApp con código de país/área.');
			return;
		}
		selectedRecipient = clean;
		newChatPhone = '';
		showNewChatInput = false;
	}

	function formatPhoneNumber(p: string): string {
		const clean = p.replace(/\D/g, '');
		if (clean.startsWith('549') && clean.length >= 13) {
			return `+54 9 ${clean.slice(3, 5)} ${clean.slice(5, 9)}-${clean.slice(9)}`;
		}
		return `+${clean}`;
	}

	function formatTime(timestamp: number): string {
		const d = new Date(timestamp);
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function openRenameModal() {
		if (!activeConversation) return;
		renameContactInput = activeConversation.contactName;
		showRenameModal = true;
	}

	async function handleSaveContactName() {
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
				customContactNames[targetPhone] = newName;
				customContactNames = { ...customContactNames };
				toast.success('Nombre actualizado', `El contacto ahora se llama "${newName}".`);
				showRenameModal = false;
			} else {
				toast.error('Error al renombrar', result.error || 'No se pudo guardar.');
			}
		} catch (e: any) {
			toast.error('Error de red', e.message || 'No se pudo guardar.');
		} finally {
			isRenamingContact = false;
		}
	}
</script>

<AppShell
	user={data.user}
	activeBusiness={data.activeBusiness}
	businesses={data.businesses}
	currentSection="messages"
	title="Mensajes"
	description="Atención por WhatsApp y pedidos en tiempo real."
	unconfirmedOrdersCount={unconfirmedCount}
>
	{#snippet headerActions()}
		{#if isConnected}
			<div class="flex items-center gap-2">
				<div class="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs">
					<span class="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
					<span class="font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400">+{phone}</span>
				</div>

				<div class="flex items-center gap-2 px-3 py-1 rounded-full bg-muted/60 border border-border text-xs">
					<Bot class="size-3.5 {botEnabled ? 'text-primary' : 'text-muted-foreground'}" />
					<span class="text-[11px] font-semibold text-foreground">
						Bot {botEnabled ? 'Activo' : 'Pausado'}
					</span>
					<Switch
						checked={botEnabled}
						disabled={isSavingBotSettings}
						onCheckedChange={handleToggleBot}
						aria-label="Activar o pausar bot de WhatsApp"
					/>
				</div>

				<Button
					type="button"
					variant="ghost"
					size="sm"
					href="/settings?tab=integrations"
					class="text-xs h-7 px-2 text-muted-foreground hover:text-foreground gap-1"
					title="Configuración de WhatsApp"
				>
					<Settings2 class="size-3.5" />
					<span class="hidden sm:inline">Ajustes</span>
				</Button>
			</div>
		{/if}
	{/snippet}

	{#if !isConnected}
		<!-- ESTADO VACÍO: WHATSAPP NO CONECTADO -->
		<div class="mx-auto max-w-xl py-16 px-4 text-center space-y-6">
			<div class="flex size-20 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto shadow-xs">
				<svg class="size-10 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
					<path d="M12.004 2C6.48 2 2 6.48 2 12c0 1.83.498 3.55 1.364 5.035L2 22l5.12-1.33A9.957 9.957 0 0012.004 22c5.523 0 10.004-4.48 10.004-10S17.527 2 12.004 2zm5.827 14.185c-.244.686-1.42 1.309-1.96 1.353-.51.042-1.157.062-3.738-.974-3.13-1.258-5.114-4.444-5.27-4.65-.157-.207-1.264-1.684-1.264-3.212 0-1.528.8-2.28 1.083-2.589.284-.31.623-.387.83-.387.208 0 .416.002.599.012.193.01.45.074.704.64.265.592.906 2.215.986 2.378.08.163.133.354.026.568-.106.213-.16.347-.318.533-.16.186-.337.416-.48.558-.16.158-.328.33-.14.653.187.324.832 1.371 1.786 2.222 1.228 1.094 2.263 1.433 2.586 1.593.324.16.513.134.704-.085.191-.22.822-.958 1.042-1.286.22-.328.44-.274.743-.162.304.112 1.93.91 2.261 1.074.33.164.55.244.63.382.08.138.08.802-.164 1.488z"/>
				</svg>
			</div>

			<div class="space-y-2">
				<h2 class="text-xl sm:text-2xl font-bold text-foreground">WhatsApp no está conectado</h2>
				<p class="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
					Para recibir y responder los mensajes de tus clientes y permitir que el bot con IA tome pedidos automáticamente, primero debes vincular tu número de WhatsApp.
				</p>
			</div>

			<div class="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
				<Button
					href="/settings?tab=integrations"
					class="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2 h-10 px-5 shadow-xs cursor-pointer"
				>
					<Settings2 class="size-4" />
					<span>Ir a Configurar WhatsApp</span>
					<ArrowRight class="size-4" />
				</Button>
			</div>
		</div>
	{:else}
		<!-- CHAT WORKSPACE (WHATSAPP CONECTADO): ALTURA FIJA EXACTA A PANTALLA -->
		<div class="flex h-[calc(100vh-140px)] max-h-[calc(100vh-140px)] w-full rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
			<!-- COLUMNA IZQUIERDA: LISTA DE CONVERSACIONES (ANCHO FIJO ERGONÓMICO 320px) -->
			<div class="w-80 lg:w-88 shrink-0 border-r border-border flex flex-col bg-muted/10 h-full">
				<!-- Barra de búsqueda y Nuevo Chat -->
				<div class="p-3 border-b border-border space-y-2 shrink-0">
					<div class="flex items-center gap-2">
						<div class="relative flex-1">
							<Search class="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
							<Input
								placeholder="Buscar chat o número..."
								bind:value={contactSearch}
								class="pl-8 h-8 text-xs bg-background"
							/>
							{#if contactSearch}
								<button
									type="button"
									onclick={() => (contactSearch = '')}
									class="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
								>
									<X class="size-3.5" />
								</button>
							{/if}
						</div>
						<Button
							type="button"
							variant="outline"
							size="icon"
							class="size-8 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
							onclick={() => (showNewChatInput = !showNewChatInput)}
							title="Iniciar chat con nuevo número"
						>
							<Plus class="size-4" />
						</Button>
					</div>

					{#if showNewChatInput}
						<div class="p-2.5 rounded-xl border border-border bg-card space-y-2 animate-in fade-in">
							<label for="new-phone-input" class="text-[10px] font-semibold text-muted-foreground">
								Ingresa número con código de país:
							</label>
							<div class="flex gap-1.5">
								<Input
									id="new-phone-input"
									placeholder="Ej: 5491122334455"
									bind:value={newChatPhone}
									class="h-7 text-xs font-mono"
								/>
								<Button
									type="button"
									size="sm"
									class="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
									onclick={handleStartNewChat}
								>
									Abrir
								</Button>
							</div>
						</div>
					{/if}
				</div>

				<!-- Lista de Contactos con Scroll Independiente -->
				<div class="flex-1 min-h-0 overflow-y-auto divide-y divide-border/40">
					{#if filteredConversations.length === 0}
						<div class="p-8 text-center text-xs text-muted-foreground space-y-1">
							<p class="font-medium text-foreground">No hay conversaciones</p>
							<p class="text-[11px]">Cuando tus clientes escriban por WhatsApp aparecerán aquí.</p>
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
									class="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 font-bold text-xs text-emerald-700 dark:text-emerald-400"
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
													class="size-2 rounded-full bg-amber-500 shrink-0 animate-pulse"
													title="Tiene pedido por confirmar"
												></span>
											{/if}
										</div>
										<span class="text-[10px] text-muted-foreground whitespace-nowrap">
											{formatTime(conv.lastMessage.timestamp)}
										</span>
									</div>

									<div class="flex items-center justify-between gap-2">
										<p class="text-[11px] text-muted-foreground truncate">
											{#if conv.lastMessage.fromMe}
												<span class="text-emerald-600 dark:text-emerald-400 font-semibold">Tú: </span>
											{/if}
											{conv.lastMessage.text}
										</p>

										{#if conv.unreadCount > 0}
											<span
												class="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white shadow-xs"
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

			<!-- COLUMNA DERECHA: VENTANA DE CHAT ACTIVO (FLEX-1 CON COMPOSER FIJO ABAJO) -->
			<div class="flex-1 min-w-0 flex flex-col bg-background h-full overflow-hidden">
				{#if !activeConversation}
					<div class="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-3">
						<div class="flex size-14 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground/60">
							<MessageSquare class="size-7" />
						</div>
						<div class="space-y-1">
							<p class="text-sm font-semibold text-foreground">Selecciona una conversación</p>
							<p class="text-xs max-w-sm">
								Elige un contacto de la izquierda o inicia una conversación para ver los mensajes.
							</p>
						</div>
					</div>
				{:else}
					<!-- Header del Chat Activo (shrink-0) -->
					<div class="p-3 sm:px-4 border-b border-border flex items-center justify-between gap-3 bg-muted/20 shrink-0">
						<div class="flex items-center gap-2.5 min-w-0">
							<div
								class="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 font-bold text-xs text-emerald-700 dark:text-emerald-400"
							>
								{activeConversation.contactName.charAt(0).toUpperCase()}
							</div>
							<div class="min-w-0">
								<div class="flex items-center gap-1.5">
									<span class="text-xs font-bold text-foreground truncate">
										{activeConversation.contactName}
									</span>
									<button
										type="button"
										class="text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded"
										onclick={openRenameModal}
										title="Editar nombre del contacto"
									>
										<Pencil class="size-3" />
									</button>
								</div>
								<p class="text-[10px] text-muted-foreground font-mono truncate">
									{formatPhoneNumber(activeConversation.phone)}
								</p>
							</div>
						</div>

						<div class="flex items-center gap-2 shrink-0">
							{#if activeConversation.unreadCount > 0}
								<Button
									type="button"
									variant="outline"
									size="sm"
									class="h-7 text-xs gap-1.5 font-semibold text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer"
									onclick={() => handleMarkAllAsRead(activeConversation)}
								>
									<CheckCheck class="size-3.5" />
									<span>Marcar leído</span>
								</Button>
							{/if}

							<Button
								type="button"
								variant="ghost"
								size="sm"
								class="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1 cursor-pointer"
								onclick={() => (showClearChatModal = true)}
								title="Vaciar mensajes de este chat"
							>
								<Trash2 class="size-3.5" />
								<span class="hidden sm:inline">Vaciar chat</span>
							</Button>
						</div>
					</div>

					<!-- BANNER: PEDIDO PENDIENTE DE CONFIRMACIÓN (shrink-0) -->
					{#if activeUnconfirmedOrder}
						<div
							class="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between gap-3 text-xs shrink-0"
						>
							<div class="flex items-center gap-2 text-amber-800 dark:text-amber-200">
								<ShoppingBag class="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
								<span>
									Pedido <strong>#{activeUnconfirmedOrder.orderNumber}</strong> pendiente por
									<strong>${activeUnconfirmedOrder.totalAmount.toLocaleString('es-AR')}</strong>
								</span>
							</div>
							<Button
								type="button"
								size="sm"
								class="h-6.5 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1.5 cursor-pointer shadow-xs"
								onclick={() => openConfirmOrderModal(activeUnconfirmedOrder)}
							>
								<Check class="size-3" />
								<span>Confirmar</span>
							</Button>
						</div>
					{/if}

					<!-- Área de Mensajes del Chat con Scroll (flex-1 min-h-0 overflow-y-auto) -->
					<div
						bind:this={chatScrollContainer}
						class="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-muted/5 flex flex-col"
					>
						{#each activeConversation.messages as msg, i (`${msg.id}_${i}`)}
							<div class="flex flex-col {msg.fromMe ? 'items-end' : 'items-start'}">
								<div
									class="max-w-[85%] sm:max-w-lg lg:max-w-xl rounded-2xl p-3 text-xs space-y-1.5 shadow-2xs relative group {msg.fromMe
										? msg.isBot
											? 'bg-primary text-primary-foreground rounded-tr-xs'
											: 'bg-emerald-600 text-white rounded-tr-xs'
										: 'bg-card border border-border text-foreground rounded-tl-xs'}"
								>
									{#if msg.fromMe}
										<div class="flex items-center gap-1.5 text-[10px] font-semibold {msg.isBot ? 'text-primary-foreground/90' : 'text-white/90'} pb-0.5 border-b {msg.isBot ? 'border-primary-foreground/15' : 'border-white/20'}">
											{#if msg.isBot}
												<Bot class="size-3" />
												<span>Bot IA</span>
											{:else}
												<span>Tú</span>
											{/if}
										</div>
									{/if}

									<p class="whitespace-pre-line leading-relaxed select-text">
										{msg.text}
									</p>

									<div
										class="flex items-center justify-end gap-1.5 text-[10px] {msg.fromMe
											? msg.isBot
												? 'text-primary-foreground/80'
												: 'text-white/80'
											: 'text-muted-foreground'} pt-0.5"
									>
										<span>{formatTime(msg.timestamp)}</span>
										{#if msg.fromMe}
											<CheckCheck class="size-3.5 {msg.isBot ? 'text-primary-foreground/90' : 'text-white/90'}" />
										{:else if !msg.isRead}
											<button
												type="button"
												class="opacity-0 group-hover:opacity-100 hover:underline cursor-pointer text-emerald-600 dark:text-emerald-400"
												onclick={() => handleMarkAsRead(msg)}
											>
												Leído
											</button>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>

					<!-- Barra Inferior de Composición y Respuestas Rápidas (shrink-0) -->
					<div class="p-3 border-t border-border bg-background space-y-2 shrink-0">
						<!-- Chips de Respuestas Rápidas -->
						<div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] text-muted-foreground">
							<span class="text-[10px] font-semibold shrink-0">Atajos:</span>
							<button
								type="button"
								class="px-2 py-0.5 rounded-full border border-border bg-muted/30 hover:bg-muted text-foreground cursor-pointer shrink-0 transition-colors"
								onclick={() => (replyText = '¡Hola! Te paso los datos para la transferencia:\nAlias: PASTELERIA.SWEET.CAKES\nTitular: Pastelería Dulce')}
							>
								💳 Alias / CBU
							</button>
							<button
								type="button"
								class="px-2 py-0.5 rounded-full border border-border bg-muted/30 hover:bg-muted text-foreground cursor-pointer shrink-0 transition-colors"
								onclick={() => (replyText = 'Nuestro horario de atención es de Lunes a Sábado de 09:00 a 19:00 hs.')}
							>
								🕒 Horarios
							</button>
							<button
								type="button"
								class="px-2 py-0.5 rounded-full border border-border bg-muted/30 hover:bg-muted text-foreground cursor-pointer shrink-0 transition-colors"
								onclick={() => (replyText = '¡Hola! Con gusto te paso nuestro catálogo disponible de tortas y productos.')}
							>
								🎂 Catálogo
							</button>
						</div>

						<!-- Input de Texto y Botón Enviar -->
						<form onsubmit={handleSendMessage} class="flex items-center gap-2">
							<Input
								placeholder="Escribe un mensaje para el cliente..."
								bind:value={replyText}
								class="h-9 text-xs"
								disabled={isSending}
							/>
							<Button
								type="submit"
								size="sm"
								class="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shrink-0 cursor-pointer"
								disabled={!replyText.trim() || isSending}
							>
								{#if isSending}
									<RefreshCw class="size-3.5 animate-spin" />
								{:else}
									<Send class="size-3.5" />
									<span class="hidden sm:inline">Enviar</span>
								{/if}
							</Button>
						</form>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</AppShell>

<!-- MODAL RENOMBRAR CONTACTO -->
{#if showRenameModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
		<div class="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
			<div class="flex items-center gap-2">
				<Pencil class="size-4 text-emerald-600" />
				<h3 class="font-bold text-sm">Editar nombre del contacto</h3>
			</div>

			<div class="space-y-1">
				<label for="rename-contact-input" class="text-xs text-muted-foreground">Nombre para este cliente:</label>
				<Input id="rename-contact-input" bind:value={renameContactInput} class="h-9 text-xs" />
			</div>

			<div class="flex items-center justify-end gap-2 pt-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					class="text-xs h-8"
					disabled={isRenamingContact}
					onclick={() => (showRenameModal = false)}
				>
					Cancelar
				</Button>
				<Button
					type="button"
					size="sm"
					class="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
					disabled={isRenamingContact || !renameContactInput.trim()}
					onclick={handleSaveContactName}
				>
					Guardar
				</Button>
			</div>
		</div>
	</div>
{/if}

<!-- MODAL VACIAR CHAT -->
{#if showClearChatModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
		<div class="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
			<div class="flex items-center gap-3 text-destructive">
				<Trash2 class="size-5" />
				<h3 class="font-bold text-sm text-foreground">¿Vaciar este chat?</h3>
			</div>

			<p class="text-xs text-muted-foreground leading-relaxed">
				Se borrarán todos los mensajes de este chat en GiveOS. El cliente en su teléfono seguirá teniendo su historial.
			</p>

			<div class="flex items-center justify-end gap-2 pt-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					class="text-xs h-8"
					disabled={isClearingChat}
					onclick={() => (showClearChatModal = false)}
				>
					Cancelar
				</Button>
				<Button
					type="button"
					variant="destructive"
					size="sm"
					class="text-xs h-8 font-semibold"
					disabled={isClearingChat}
					onclick={handleClearChat}
				>
					{#if isClearingChat}
						<RefreshCw class="size-3.5 animate-spin" />
						<span>Borrando...</span>
					{:else}
						<span>Sí, vaciar chat</span>
					{/if}
				</Button>
			</div>
		</div>
	</div>
{/if}

<!-- MODAL CONFIRMAR PEDIDO DE WHATSAPP -->
{#if showConfirmOrderModal && selectedOrderToConfirm}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
		<div class="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
			<div class="flex items-center justify-between border-b border-border pb-3">
				<div class="flex items-center gap-2">
					<ShoppingBag class="size-5 text-emerald-600" />
					<h3 class="font-bold text-sm">Confirmar Pedido #{selectedOrderToConfirm.orderNumber}</h3>
				</div>
				<button
					type="button"
					class="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
					onclick={() => (showConfirmOrderModal = false)}
				>
					<X class="size-4" />
				</button>
			</div>

			<div class="space-y-3 text-xs">
				<div class="p-3 rounded-xl border border-border bg-muted/30 space-y-1">
					<p class="text-muted-foreground">
						Cliente: <strong class="text-foreground">{selectedOrderToConfirm.customerName}</strong>
					</p>
					<p class="text-muted-foreground">
						Total del pedido: <strong class="text-foreground">${selectedOrderToConfirm.totalAmount.toLocaleString('es-AR')}</strong>
					</p>
				</div>

				<div class="space-y-1">
					<label for="confirm-paid-input" class="text-xs font-semibold">Monto cobrado/transferido:</label>
					<Input
						id="confirm-paid-input"
						type="number"
						bind:value={confirmPaidAmount}
						class="h-9 text-xs"
					/>
				</div>

				<label class="flex items-center gap-2 pt-1 cursor-pointer">
					<input
						type="checkbox"
						bind:checked={sendWhatsAppConfirm}
						class="rounded border-input text-emerald-600 focus:ring-emerald-500"
					/>
					<span class="text-xs text-muted-foreground">
						Enviar mensaje de confirmación por WhatsApp al cliente automáticamente.
					</span>
				</label>
			</div>

			<div class="flex items-center justify-end gap-2 pt-2 border-t border-border">
				<Button
					type="button"
					variant="outline"
					size="sm"
					class="text-xs h-8"
					disabled={isConfirmingOrder}
					onclick={() => (showConfirmOrderModal = false)}
				>
					Cancelar
				</Button>
				<Button
					type="button"
					size="sm"
					class="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
					disabled={isConfirmingOrder}
					onclick={handleConfirmOrder}
				>
					{#if isConfirmingOrder}
						<RefreshCw class="size-3.5 animate-spin" />
						<span>Confirmando...</span>
					{:else}
						<Check class="size-3.5" />
						<span>Confirmar Pedido</span>
					{/if}
				</Button>
			</div>
		</div>
	</div>
{/if}
