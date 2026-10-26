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
	import { toast } from '#lib/components/ui/toast';
	import type {
		WhatsAppMessage,
		WhatsAppSessionStatus
	} from '#lib/features/integrations/whatsapp/domain/whatsapp.entity';

	let { data }: PageProps = $props();

	let showQrModal = $state(false);
	let showDisconnectModal = $state(false);
	let isDisconnecting = $state(false);

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

	// Sincronizar estado inicial desde el servidor
	$effect(() => {
		if (data.initialWhatsAppSession) {
			status = data.initialWhatsAppSession.status || 'disconnected';
			phone = data.initialWhatsAppSession.phone || null;
			pushName = data.initialWhatsAppSession.pushName || null;
			qrCodeData = data.initialWhatsAppSession.qr || null;
			messages = data.initialWhatsAppSession.messages || [];
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

		for (const msg of messages) {
			const phoneKey = msg.from;
			let conv = map.get(phoneKey);
			if (!conv) {
				conv = {
					phone: phoneKey,
					contactName: msg.fromMe ? phoneKey : msg.senderName || phoneKey,
					lastMessage: msg,
					unreadCount: 0,
					messages: []
				};
				map.set(phoneKey, conv);
			}

			if (!msg.fromMe && msg.senderName && conv.contactName === conv.phone) {
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

	// Mantener sincronizado selectedRecipient si hay conversaciones
	$effect(() => {
		if (!selectedRecipient && conversations.length > 0) {
			selectedRecipient = conversations[0].phone;
		}
	});

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
		try {
			await fetch('/api/integrations/whatsapp/read', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					businessId: data.activeBusiness.id,
					messageKey: msg.key
				})
			});
			msg.isRead = true;
			messages = [...messages];
		} catch (e) {
			console.error(e);
		}
	}

	async function handleMarkAllAsRead(conv: Conversation) {
		const unread = conv.messages.filter((m) => !m.fromMe && !m.isRead);
		for (const m of unread) {
			await handleMarkAsRead(m);
		}
		toast.success('Leídos', `Mensajes de ${conv.contactName} marcados como vistos.`);
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
												<span class="text-xs font-bold text-foreground truncate">
													{conv.contactName}
												</span>
												<span class="text-[10px] text-muted-foreground shrink-0 font-mono">
													{formatTime(conv.lastMessage.timestamp)}
												</span>
											</div>

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
										<h4 class="text-xs font-bold text-foreground truncate">
											{activeConversation.contactName}
										</h4>
										<span class="font-mono text-[10px] text-muted-foreground">
											+{activeConversation.phone}
										</span>
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
								</div>
							</div>

							<!-- Flujo de Mensajes (Scrollable) -->
							<div class="flex-1 overflow-y-auto p-4 space-y-2.5 bg-muted/15 flex flex-col justify-end">
								{#each activeConversation.messages as msg (msg.id)}
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
</AppShell>
