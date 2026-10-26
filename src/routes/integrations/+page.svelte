<script lang="ts">
	import type { PageProps } from './$types';
	import AppShell from '#lib/components/layout/app-shell.svelte';
	import { Button } from '#lib/components/ui/button';
	import { Badge } from '#lib/components/ui/badge';
	import { Input } from '#lib/components/ui/input';
	import { Card, CardHeader, CardTitle, CardContent } from '#lib/components/ui/card';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
	import QrCode from '@lucide/svelte/icons/qr-code';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Zap from '@lucide/svelte/icons/zap';
	import Printer from '@lucide/svelte/icons/printer';
	import CreditCard from '@lucide/svelte/icons/credit-card';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import X from '@lucide/svelte/icons/x';
	import Send from '@lucide/svelte/icons/send';
	import Check from '@lucide/svelte/icons/check';
	import CheckCheck from '@lucide/svelte/icons/check-check';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Eye from '@lucide/svelte/icons/eye';
	import { toast } from '#lib/components/ui/toast';
	import type {
		WhatsAppMessage,
		WhatsAppSessionStatus
	} from '#lib/features/integrations/whatsapp/domain/whatsapp.entity';

	let { data }: PageProps = $props();

	let showWhatsAppModal = $state(false);
	let activeTab = $state<'overview' | 'qr-flow' | 'architecture'>('overview');

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

	// Sincronizar estado inicial
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

	async function handleStartConnect() {
		isConnecting = true;
		activeTab = 'qr-flow';
		showWhatsAppModal = true;
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
			toast.info('Sesión cerrada', isLogout ? 'Se eliminaron las credenciales.' : 'Socket desconectado.');
		} catch (e) {
			console.error(e);
		}
	}

	async function handleSendMessage() {
		if (!replyText.trim() || !selectedRecipient.trim()) return;
		isSending = true;
		try {
			const res = await fetch('/api/integrations/whatsapp/send', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					businessId: data.activeBusiness.id,
					to: selectedRecipient.trim(),
					text: replyText.trim()
				})
			});
			const result = await res.json();
			if (result.success) {
				replyText = '';
				toast.success('Mensaje enviado', 'Entregado a los servidores de WhatsApp.');
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
			toast.success('Leído', 'Mensaje marcado como visto.');
		} catch (e) {
			console.error(e);
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
	description="Conecta GiveOS con tus canales de mensajería, pasarelas de pago y servicios externos."
>
	<div class="mx-auto max-w-6xl space-y-8">
		<!-- Banner Informativo -->
		<div
			class="relative overflow-hidden rounded-2xl border border-primary/20 bg-linear-to-r from-primary/10 via-primary/5 to-transparent p-5 sm:p-6"
		>
			<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
				<div class="space-y-1.5">
					<div class="flex items-center gap-2">
						<span
							class="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary"
						>
							<Sparkles class="size-3.5" />
							Canales Automatizados
						</span>
						<span
							class="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground font-mono"
						>
							v1.0 • Baileys E2E
						</span>
					</div>
					<h2 class="text-lg sm:text-xl font-bold tracking-tight text-foreground">
						Centraliza tus ventas y mensajes en tiempo real
					</h2>
					<p class="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
						Vincula tu línea de WhatsApp mediante código QR para recibir consultas y mensajes de clientes directamente en la pantalla de GiveOS, responder en el acto y marcar mensajes como leídos sin costos por conversación.
					</p>
				</div>
				<Button
					type="button"
					onclick={() => {
						activeTab = 'architecture';
						showWhatsAppModal = true;
					}}
					variant="outline"
					size="sm"
					class="gap-1.5 shrink-0"
				>
					<ShieldCheck class="size-4 text-emerald-600" />
					<span>Ver Arquitectura</span>
				</Button>
			</div>
		</div>

		<!-- Grid de Integraciones Principales -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
			<!-- TARJETA DESTACADA: WHATSAPP (BAILEYS) -->
			<Card
				class="relative flex flex-col justify-between overflow-hidden border-2 {status ===
				'connected'
					? 'border-emerald-500/60 shadow-emerald-500/10'
					: 'border-emerald-500/30'} hover:border-emerald-500/70 shadow-md transition-all duration-200"
			>
				<div
					class="absolute -right-10 -top-10 size-32 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none"
				></div>

				<CardHeader class="pb-3">
					<div class="flex items-start justify-between gap-3">
						<div class="flex items-center gap-3">
							<!-- Logo oficial de WhatsApp -->
							<div
								class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
							>
								<svg class="size-7 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
									<path
										d="M12.004 2C6.48 2 2 6.48 2 12c0 1.83.498 3.55 1.364 5.035L2 22l5.12-1.33A9.957 9.957 0 0012.004 22c5.523 0 10.004-4.48 10.004-10S17.527 2 12.004 2zm5.827 14.185c-.244.686-1.42 1.309-1.96 1.353-.51.042-1.157.062-3.738-.974-3.13-1.258-5.114-4.444-5.27-4.65-.157-.207-1.264-1.684-1.264-3.212 0-1.528.8-2.28 1.083-2.589.284-.31.623-.387.83-.387.208 0 .416.002.599.012.193.01.45.074.704.64.265.592.906 2.215.986 2.378.08.163.133.354.026.568-.106.213-.16.347-.318.533-.16.186-.337.416-.48.558-.16.158-.328.33-.14.653.187.324.832 1.371 1.786 2.222 1.228 1.094 2.263 1.433 2.586 1.593.324.16.513.134.704-.085.191-.22.822-.958 1.042-1.286.22-.328.44-.274.743-.162.304.112 1.93.91 2.261 1.074.33.164.55.244.63.382.08.138.08.802-.164 1.488z"
									/>
								</svg>
							</div>
							<div>
								<div class="flex items-center gap-2">
									<CardTitle class="text-base font-bold text-foreground">WhatsApp</CardTitle>
									<span
										class="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 font-mono"
									>
										Multi-Device
									</span>
								</div>
								<p class="text-xs text-muted-foreground">Motor Baileys E2E</p>
							</div>
						</div>

						{#if status === 'connected'}
							<span
								class="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
							>
								<span class="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
								Conectado
							</span>
						{:else if status === 'scanning_qr'}
							<span
								class="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400"
							>
								<span class="size-2 rounded-full bg-amber-500 animate-ping"></span>
								Esperando QR
							</span>
						{:else if status === 'connecting'}
							<span
								class="inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:text-sky-400"
							>
								<RefreshCw class="size-3 animate-spin" />
								Conectando...
							</span>
						{:else}
							<span
								class="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-semibold text-muted-foreground"
							>
								<span class="size-2 rounded-full bg-muted-foreground"></span>
								Desconectado
							</span>
						{/if}
					</div>
				</CardHeader>

				<CardContent class="space-y-4 text-xs text-muted-foreground">
					{#if status === 'connected'}
						<div class="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 space-y-1">
							<p class="font-bold text-foreground flex items-center justify-between">
								<span>{pushName || 'Línea de WhatsApp'}</span>
								<span class="font-mono text-emerald-600 dark:text-emerald-400">+{phone}</span>
							</p>
							<p class="text-[11px] text-muted-foreground">
								Canal SSE en tiempo real activo. Recibiendo mensajes instantáneamente.
							</p>
						</div>
					{:else}
						<p class="leading-relaxed">
							Vincula tu WhatsApp escaneando el código QR para recibir consultas y mensajes de clientes directamente en la pantalla de GiveOS.
						</p>
					{/if}

					<div class="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
						<div class="flex items-center gap-2 text-foreground font-medium">
							<CheckCircle2 class="size-3.5 text-emerald-600 shrink-0" />
							<span>Cero costo de API de Meta (Conexión Multi-Device)</span>
						</div>
						<div class="flex items-center gap-2 text-foreground font-medium">
							<CheckCircle2 class="size-3.5 text-emerald-600 shrink-0" />
							<span>Recepción en vivo mediante canal unificado SSE</span>
						</div>
						<div class="flex items-center gap-2 text-foreground font-medium">
							<CheckCircle2 class="size-3.5 text-emerald-600 shrink-0" />
							<span>Marcar mensajes como vistos (`readMessages`)</span>
						</div>
					</div>
				</CardContent>

				<div class="pt-0 flex items-center justify-between gap-2 border-t border-border/60 bg-muted/10 p-4">
					{#if status === 'connected'}
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={() => handleDisconnect(true)}
							class="text-xs text-destructive hover:bg-destructive/10"
						>
							<LogOut class="size-3.5 mr-1" />
							Desvincular
						</Button>

						<Button
							type="button"
							size="sm"
							onclick={() => {
								activeTab = 'qr-flow';
								showWhatsAppModal = true;
							}}
							variant="secondary"
							class="gap-1.5"
						>
							<MessageSquare class="size-4" />
							<span>Bandeja ({messages.length})</span>
						</Button>
					{:else}
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={() => {
								activeTab = 'architecture';
								showWhatsAppModal = true;
							}}
							class="text-xs text-muted-foreground hover:text-foreground"
						>
							Detalles
						</Button>

						<Button
							type="button"
							size="sm"
							onclick={handleStartConnect}
							disabled={isConnecting}
							class="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
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
			</Card>

			<!-- INTEGRACIÓN 2: MERCADO PAGO (PRÓXIMAMENTE) -->
			<Card class="flex flex-col justify-between opacity-80 hover:opacity-100 transition-opacity">
				<CardHeader class="pb-3">
					<div class="flex items-start justify-between gap-3">
						<div class="flex items-center gap-3">
							<div class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-sm">
								<CreditCard class="size-6" />
							</div>
							<div>
								<div class="flex items-center gap-2">
									<CardTitle class="text-base font-bold text-foreground">Mercado Pago</CardTitle>
									<span class="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-400">
										Pasarela
									</span>
								</div>
								<p class="text-xs text-muted-foreground">Cobro QR e Interoperable</p>
							</div>
						</div>
						<Badge variant="outline" class="text-[10px]">Próximamente</Badge>
					</div>
				</CardHeader>
				<CardContent class="text-xs text-muted-foreground space-y-3">
					<p class="leading-relaxed">
						Genera links de pago y códigos QR automáticos al crear órdenes para acreditar el saldo en GiveOS al instante.
					</p>
					<ul class="space-y-1.5 text-[11px]">
						<li class="flex items-center gap-1.5">
							<CheckCircle2 class="size-3 text-muted-foreground" />
							<span>Notificación instantánea de cobro (Webhook)</span>
						</li>
						<li class="flex items-center gap-1.5">
							<CheckCircle2 class="size-3 text-muted-foreground" />
							<span>Actualización automática a "Pagado"</span>
						</li>
					</ul>
				</CardContent>
				<div class="pt-0 border-t border-border/60 bg-muted/10 p-4">
					<Button variant="outline" size="sm" class="w-full text-xs" disabled>
						Pronto disponible
					</Button>
				</div>
			</Card>

			<!-- INTEGRACIÓN 3: IMPRESORAS TÉRMICAS / COMANDAS -->
			<Card class="flex flex-col justify-between opacity-80 hover:opacity-100 transition-opacity">
				<CardHeader class="pb-3">
					<div class="flex items-start justify-between gap-3">
						<div class="flex items-center gap-3">
							<div class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
								<Printer class="size-6" />
							</div>
							<div>
								<div class="flex items-center gap-2">
									<CardTitle class="text-base font-bold text-foreground">Impresora de Comandas</CardTitle>
								</div>
								<p class="text-xs text-muted-foreground">ESC/POS • Térmica 58/80mm</p>
							</div>
						</div>
						<Badge variant="outline" class="text-[10px]">Próximamente</Badge>
					</div>
				</CardHeader>
				<CardContent class="text-xs text-muted-foreground space-y-3">
					<p class="leading-relaxed">
						Imprime automáticamente tickets de cocina y remitos de entrega por Bluetooth, USB o red local al confirmar una venta.
					</p>
					<ul class="space-y-1.5 text-[11px]">
						<li class="flex items-center gap-1.5">
							<CheckCircle2 class="size-3 text-muted-foreground" />
							<span>Tickets estándar de 58mm y 80mm</span>
						</li>
						<li class="flex items-center gap-1.5">
							<CheckCircle2 class="size-3 text-muted-foreground" />
							<span>Desglose para cocina / despacho</span>
						</li>
					</ul>
				</CardContent>
				<div class="pt-0 border-t border-border/60 bg-muted/10 p-4">
					<Button variant="outline" size="sm" class="w-full text-xs" disabled>
						Pronto disponible
					</Button>
				</div>
			</Card>
		</div>

		<!-- SECCIÓN: BANDEJA DE MENSAJES EN TIEMPO REAL -->
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<div class="space-y-0.5">
					<h3 class="text-base font-bold text-foreground flex items-center gap-2">
						<MessageSquare class="size-4.5 text-emerald-600" />
						<span>Mensajes Recientes de WhatsApp</span>
					</h3>
					<p class="text-xs text-muted-foreground">
						Recepción continua vía SSE. Haz clic en un mensaje para responder o marcar como visto.
					</p>
				</div>
				<span class="rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs font-semibold text-muted-foreground">
					{messages.length} mensajes en memoria
				</span>
			</div>

			{#if messages.length === 0}
				<div class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-10 text-center space-y-3">
					<div class="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
						<MessageSquare class="size-6" />
					</div>
					<div class="space-y-1 max-w-sm">
						<p class="font-bold text-sm text-foreground">Sin mensajes recibidos aún</p>
						<p class="text-xs text-muted-foreground">
							{status === 'connected'
								? 'Cuando un cliente te escriba a tu número de WhatsApp, aparecerá aquí inmediatamente en tiempo real.'
								: 'Vincula tu WhatsApp arriba con el código QR para comenzar a recibir mensajes en este panel.'}
						</p>
					</div>
					{#if status !== 'connected'}
						<Button type="button" size="sm" onclick={handleStartConnect} class="gap-1.5 bg-emerald-600 text-white">
							<QrCode class="size-4" />
							<span>Vincular WhatsApp</span>
						</Button>
					{/if}
				</div>
			{:else}
				<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
					<!-- Lista de Mensajes Recibidos -->
					<div class="lg:col-span-2 space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
						{#each messages as msg (msg.id)}
							<div
								class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors {msg.fromMe
									? 'border-border/60 bg-muted/20'
									: msg.isRead
										? 'border-border bg-card'
										: 'border-emerald-500/40 bg-emerald-500/5'}"
							>
								<div class="space-y-1 min-w-0">
									<div class="flex items-center gap-2">
										<span class="font-bold text-xs text-foreground truncate">
											{msg.senderName}
										</span>
										<span class="font-mono text-[11px] text-muted-foreground">
											+{msg.from}
										</span>
										<span class="text-[10px] text-muted-foreground">
											{formatTime(msg.timestamp)}
										</span>
										{#if msg.fromMe}
											<span class="inline-flex items-center text-sky-500" title="Enviado">
												<CheckCheck class="size-3.5" />
											</span>
										{:else if !msg.isRead}
											<span class="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700 dark:text-emerald-400">
												Nuevo
											</span>
										{/if}
									</div>
									<p class="text-xs text-foreground leading-relaxed break-words font-medium">
										{msg.text}
									</p>
								</div>

								<div class="flex items-center gap-1.5 shrink-0">
									{#if !msg.fromMe && !msg.isRead}
										<Button
											type="button"
											variant="ghost"
											size="sm"
											class="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
											onclick={() => handleMarkAsRead(msg)}
											title="Marcar como visto (doble check azul)"
										>
											<Eye class="size-3.5 mr-1 text-sky-600" />
											<span>Visto</span>
										</Button>
									{/if}

									<Button
										type="button"
										variant="outline"
										size="sm"
										class="h-7 px-2.5 text-xs"
										onclick={() => {
											selectedRecipient = msg.from;
										}}
									>
										Responder
									</Button>
								</div>
							</div>
						{/each}
					</div>

					<!-- Panel de Respuesta Rápida (HTTP POST) -->
					<div class="rounded-2xl border border-border bg-card p-4 space-y-4 flex flex-col justify-between">
						<div class="space-y-3">
							<div class="flex items-center gap-2 border-b border-border pb-2.5">
								<Send class="size-4 text-emerald-600" />
								<h4 class="font-bold text-xs text-foreground uppercase tracking-wide">
									Tomar Control y Responder
								</h4>
							</div>

							<div class="space-y-1.5">
								<label for="recipient-phone" class="text-xs font-semibold text-muted-foreground">
									Destinatario (Número con código de país):
								</label>
								<Input
									id="recipient-phone"
									bind:value={selectedRecipient}
									placeholder="Ej: 5493412110779"
									class="h-9 font-mono text-xs"
								/>
							</div>

							<div class="space-y-1.5">
								<label for="reply-text" class="text-xs font-semibold text-muted-foreground">
									Mensaje a enviar:
								</label>
								<textarea
									id="reply-text"
									bind:value={replyText}
									rows="4"
									placeholder="Escribe tu respuesta aquí..."
									class="w-full rounded-xl border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
								></textarea>
							</div>
						</div>

						<Button
							type="button"
							onclick={handleSendMessage}
							disabled={isSending || !replyText.trim() || !selectedRecipient.trim() || status !== 'connected'}
							class="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
						>
							{#if isSending}
								<RefreshCw class="size-4 animate-spin" />
								<span>Enviando...</span>
							{:else}
								<Send class="size-4" />
								<span>Enviar Mensaje</span>
							{/if}
						</Button>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- MODAL: CÓDIGO QR / ESTRATEGIA BAILEYS -->
	{#if showWhatsAppModal}
		<div
			class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 p-0 sm:p-4 backdrop-blur-[1px]"
			role="dialog"
			aria-modal="true"
		>
			<div
				class="w-full max-w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border-t sm:border border-border bg-card shadow-2xl"
			>
				<!-- Header Modal -->
				<div
					class="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 backdrop-blur-sm p-5 sm:p-6"
				>
					<div class="flex items-center gap-3">
						<div
							class="flex size-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-xs"
						>
							<svg class="size-6 fill-current" viewBox="0 0 24 24">
								<path
									d="M12.004 2C6.48 2 2 6.48 2 12c0 1.83.498 3.55 1.364 5.035L2 22l5.12-1.33A9.957 9.957 0 0012.004 22c5.523 0 10.004-4.48 10.004-10S17.527 2 12.004 2zm5.827 14.185c-.244.686-1.42 1.309-1.96 1.353-.51.042-1.157.062-3.738-.974-3.13-1.258-5.114-4.444-5.27-4.65-.157-.207-1.264-1.684-1.264-3.212 0-1.528.8-2.28 1.083-2.589.284-.31.623-.387.83-.387.208 0 .416.002.599.012.193.01.45.074.704.64.265.592.906 2.215.986 2.378.08.163.133.354.026.568-.106.213-.16.347-.318.533-.16.186-.337.416-.48.558-.16.158-.328.33-.14.653.187.324.832 1.371 1.786 2.222 1.228 1.094 2.263 1.433 2.586 1.593.324.16.513.134.704-.085.191-.22.822-.958 1.042-1.286.22-.328.44-.274.743-.162.304.112 1.93.91 2.261 1.074.33.164.55.244.63.382.08.138.08.802-.164 1.488z"
								/>
							</svg>
						</div>
						<div>
							<h3 class="text-base sm:text-lg font-bold text-foreground">
								Integración WhatsApp con Baileys
							</h3>
							<p class="text-xs text-muted-foreground">
								{data.activeBusiness.name} • Identificador: GiveOS Terminal
							</p>
						</div>
					</div>

					<Button
						type="button"
						size="icon"
						variant="ghost"
						class="size-8"
						onclick={() => (showWhatsAppModal = false)}
					>
						<X class="size-4" />
					</Button>
				</div>

				<!-- Selector de Pestañas en el Modal -->
				<div class="flex border-b border-border bg-muted/20 px-6 pt-2">
					<button
						type="button"
						onclick={() => (activeTab = 'qr-flow')}
						class="border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors {activeTab ===
						'qr-flow'
							? 'border-primary text-primary'
							: 'border-transparent text-muted-foreground hover:text-foreground'}"
					>
						1. Vinculación con QR
					</button>
					<button
						type="button"
						onclick={() => (activeTab = 'architecture')}
						class="border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors {activeTab ===
						'architecture'
							? 'border-primary text-primary'
							: 'border-transparent text-muted-foreground hover:text-foreground'}"
					>
						2. Estrategia & Arquitectura
					</button>
				</div>

				<!-- Contenido del Modal -->
				<div class="p-6 space-y-6">
					{#if activeTab === 'qr-flow'}
						<!-- Pestaña 1: Flujo de Vinculación QR -->
						<div class="space-y-6">
							{#if status === 'connected'}
								<div
									class="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6 text-center space-y-3"
								>
									<div
										class="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md"
									>
										<Check class="size-6 stroke-[3]" />
									</div>
									<div class="space-y-1">
										<h4 class="text-base font-bold text-foreground">
											¡Dispositivo Vinculado con Éxito!
										</h4>
										<p class="text-xs text-muted-foreground">
											Línea conectada: <strong>+{phone}</strong> ({pushName || 'WhatsApp'})
										</p>
									</div>
									<Button
										type="button"
										size="sm"
										variant="outline"
										onclick={() => (showWhatsAppModal = false)}
									>
										Ir a la Bandeja de Mensajes
									</Button>
								</div>
							{:else}
								<div
									class="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-3"
								>
									<QrCode class="size-5 shrink-0 text-emerald-600 mt-0.5" />
									<div class="space-y-1">
										<p class="font-bold text-sm">Escanea el código QR desde tu teléfono</p>
										<p class="text-[11px] leading-relaxed">
											Abre WhatsApp en tu teléfono celular, ve a <strong>Ajustes / Menú → Dispositivos vinculados</strong> y toca <strong>Vincular un dispositivo</strong>.
										</p>
									</div>
								</div>

								<!-- Contenedor del QR en tiempo real -->
								<div
									class="flex flex-col sm:flex-row items-center justify-center gap-6 rounded-2xl border border-border bg-muted/20 p-6"
								>
									<div
										class="relative flex size-52 items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card p-3 shadow-inner"
									>
										{#if qrCodeData}
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

									<div class="space-y-3 max-w-xs text-xs text-foreground">
										<div class="flex items-start gap-2.5">
											<span
												class="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary"
												>1</span
											>
											<p>Abre <strong>WhatsApp</strong> en tu teléfono celular.</p>
										</div>
										<div class="flex items-start gap-2.5">
											<span
												class="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary"
												>2</span
											>
											<p>Toca <strong>Dispositivos vinculados</strong> en Ajustes o Menú (⋮).</p>
										</div>
										<div class="flex items-start gap-2.5">
											<span
												class="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary"
												>3</span
											>
											<p>Selecciona <strong>Vincular un dispositivo</strong> y apunta la cámara.</p>
										</div>
									</div>
								</div>

								<div
									class="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border"
								>
									<span class="flex items-center gap-2">
										<ShieldCheck class="size-4 text-emerald-600 shrink-0" />
										<span>Cifrado de extremo a extremo garantizado (Protocolo Signal/Noise).</span>
									</span>
									<Badge variant="outline" class="font-mono text-[10px]">Multi-Device</Badge>
								</div>
							{/if}
						</div>
					{:else}
						<!-- Pestaña 2: Arquitectura y Hoja de Ruta -->
						<div class="space-y-5 text-xs text-foreground">
							<div class="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
								<h4 class="font-bold text-sm text-foreground flex items-center gap-2">
									<Zap class="size-4 text-amber-500" />
									<span>Arquitectura Técnica de la Integración</span>
								</h4>
								<p class="text-muted-foreground leading-relaxed text-[11px]">
									Baileys (<code>@whiskeysockets/baileys</code>) conecta directamente con los servidores de WhatsApp emulando un cliente web multi-dispositivo sin costos por mensaje de Meta.
								</p>
							</div>

							<div class="space-y-3">
								<h5 class="font-bold text-xs uppercase tracking-wider text-muted-foreground">
									Pilares del Sistema:
								</h5>

								<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
									<div class="rounded-xl border border-border bg-card p-3.5 space-y-1.5">
										<span
											class="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary font-mono"
											>SSE BUS</span
										>
										<p class="font-bold text-xs">Canal Unificado</p>
										<p class="text-[11px] text-muted-foreground">
											Endpoint <code>/api/realtime</code> que emite el QR y los mensajes entrantes sin WebSockets complejos en el cliente.
										</p>
									</div>

									<div class="rounded-xl border border-border bg-card p-3.5 space-y-1.5">
										<span
											class="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 font-mono"
											>CONTROL</span
										>
										<p class="font-bold text-xs">Respuestas y Visto</p>
										<p class="text-[11px] text-muted-foreground">
											Endpoints HTTP POST para responder mensajes (<code>sendMessage</code>) y marcar leído (<code>readMessages</code> con doble check).
										</p>
									</div>

									<div class="rounded-xl border border-border bg-card p-3.5 space-y-1.5">
										<span
											class="rounded bg-secondary/15 px-1.5 py-0.5 text-[10px] font-bold text-secondary font-mono"
											>MULTI-TENANT</span
										>
										<p class="font-bold text-xs">Aislamiento por Negocio</p>
										<p class="text-[11px] text-muted-foreground">
											Credenciales almacenadas en <code>./storage/whatsapp_sessions/&lbrace;businessId&rbrace;</code> sin requerir tablas extra.
										</p>
									</div>
								</div>
							</div>
						</div>
					{/if}
				</div>

				<!-- Footer Modal -->
				<div class="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-4">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onclick={() => (showWhatsAppModal = false)}
					>
						Cerrar
					</Button>

					{#if activeTab === 'qr-flow'}
						<Button
							type="button"
							size="sm"
							onclick={() => (activeTab = 'architecture')}
							class="gap-1.5"
						>
							<span>Ver Arquitectura</span>
							<ArrowRight class="size-3.5" />
						</Button>
					{:else}
						<Button
							type="button"
							size="sm"
							onclick={() => (activeTab = 'qr-flow')}
							class="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
						>
							<QrCode class="size-3.5" />
							<span>Ver Código QR</span>
						</Button>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</AppShell>
