<script lang="ts">
	import { Button } from '#lib/components/ui/button';
	import { Badge } from '#lib/components/ui/badge';
	import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '#lib/components/ui/card';
	import QrCode from '@lucide/svelte/icons/qr-code';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import X from '@lucide/svelte/icons/x';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Bot from '@lucide/svelte/icons/bot';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import Check from '@lucide/svelte/icons/check';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import { toast } from '#lib/components/ui/toast';
	import { DEFAULT_BOT_PROMPT } from '#lib/features/ai/domain/bot-prompt.constants';
	import type { WhatsAppSessionStatus } from '../domain/whatsapp.entity';

	interface Props {
		businessId: string;
		initialStatus?: WhatsAppSessionStatus;
		initialPhone?: string | null;
		initialPushName?: string | null;
		initialQr?: string | null;
		initialBotSettings?: {
			enabled: boolean;
			systemPrompt: string;
		};
	}

	let {
		businessId,
		initialStatus = 'disconnected',
		initialPhone = null,
		initialPushName = null,
		initialQr = null,
		initialBotSettings
	}: Props = $props();

	let status = $state<WhatsAppSessionStatus>('disconnected');
	let phone = $state<string | null>(null);
	let pushName = $state<string | null>(null);
	let qrCodeData = $state<string | null>(null);

	let showQrModal = $state(false);
	let showDisconnectModal = $state(false);
	let isConnecting = $state(false);
	let isDisconnecting = $state(false);

	let botEnabled = $state(false);
	let botPrompt = $state(DEFAULT_BOT_PROMPT);
	let isSavingBotSettings = $state(false);

	// Sincronizar props iniciales
	$effect(() => {
		if (initialStatus) status = initialStatus;
		if (initialPhone) phone = initialPhone;
		if (initialPushName) pushName = initialPushName;
		if (initialQr) qrCodeData = initialQr;
		if (initialBotSettings) {
			botEnabled = initialBotSettings.enabled;
			if (initialBotSettings.systemPrompt) {
				botPrompt = initialBotSettings.systemPrompt;
			}
		}
	});

	// Sincronización en tiempo real vía SSE
	$effect(() => {
		if (typeof window === 'undefined') return;

		const es = new EventSource(`/api/realtime?business=${businessId}`);

		es.addEventListener('whatsapp:status', (e) => {
			try {
				const payload = JSON.parse(e.data);
				status = payload.status;
				phone = payload.phone ?? null;
				pushName = payload.pushName ?? null;
				if (payload.status === 'connected') {
					qrCodeData = null;
					showQrModal = false;
					isConnecting = false;
					toast.success('WhatsApp Conectado', `Sesión iniciada con éxito (+${phone || ''}).`);
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

		return () => {
			es.close();
		};
	});

	async function handleStartConnect() {
		isConnecting = true;
		showQrModal = true;
		try {
			const res = await fetch('/api/integrations/whatsapp/connect', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ businessId })
			});
			const result = await res.json();
			if (result.qr) {
				qrCodeData = result.qr;
				status = 'scanning_qr';
			}
		} catch (e) {
			console.error(e);
			toast.error('Error al conectar', 'No se pudo generar la sesión de WhatsApp.');
		} finally {
			isConnecting = false;
		}
	}

	async function handleDisconnect(isLogout = false) {
		isDisconnecting = true;
		try {
			await fetch('/api/integrations/whatsapp/disconnect', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ businessId, isLogout })
			});
			status = 'disconnected';
			phone = null;
			pushName = null;
			qrCodeData = null;
			showQrModal = false;
			showDisconnectModal = false;
			toast.info('Sesión cerrada', isLogout ? 'Se eliminaron las credenciales.' : 'Socket desconectado.');
		} catch (e) {
			console.error(e);
			toast.error('Error al desconectar', 'Hubo un problema al cerrar la sesión.');
		} finally {
			isDisconnecting = false;
		}
	}

	async function handleToggleBot() {
		const newStatus = !botEnabled;
		botEnabled = newStatus;
		isSavingBotSettings = true;
		try {
			const res = await fetch('/api/integrations/whatsapp/bot/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					businessId,
					enabled: newStatus,
					systemPrompt: botPrompt
				})
			});
			const result = await res.json();
			if (result.success) {
				toast.success(
					newStatus ? 'Bot activado' : 'Bot pausado',
					newStatus
						? 'El bot responderá automáticamente los mensajes de los clientes.'
						: 'El bot ha sido pausado. Podrás responder manualmente desde Mensajes.'
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
					businessId,
					enabled: botEnabled,
					systemPrompt: botPrompt
				})
			});
			const result = await res.json();
			if (result.success) {
				toast.success('Prompt guardado', 'Las instrucciones del bot fueron actualizadas con éxito.');
			} else {
				toast.error('Error al guardar prompt', result.error || 'No se pudo guardar.');
			}
		} catch (e: any) {
			toast.error('Error de red', e.message || 'Error al conectar.');
		} finally {
			isSavingBotSettings = false;
		}
	}
</script>

<div class="space-y-6">
	<!-- 1. TARJETA DE CONEXIÓN CON WHATSAPP -->
	<Card class="border border-border shadow-xs">
		<CardHeader class="p-5 sm:p-6 pb-4 border-b border-border">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div class="flex items-center gap-3">
					<div class="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
						<Smartphone class="size-5" />
					</div>
					<div>
						<CardTitle class="text-base sm:text-lg flex items-center gap-2">
							<span>WhatsApp Web & Baileys</span>
							{#if status === 'connected'}
								<Badge variant="outline" class="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs gap-1 py-0.5">
									<span class="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
									Conectado
								</Badge>
							{:else if status === 'scanning_qr'}
								<Badge variant="outline" class="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs gap-1 py-0.5">
									<RefreshCw class="size-3 animate-spin" />
									Escaneando QR
								</Badge>
							{:else}
								<Badge variant="outline" class="border-zinc-500/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 text-xs py-0.5">
									Desconectado
								</Badge>
							{/if}
						</CardTitle>
						<CardDescription class="text-xs mt-0.5">
							Vincula el número de WhatsApp oficial de tu negocio para chatear con clientes y automatizar pedidos.
						</CardDescription>
					</div>
				</div>

				<div class="flex items-center gap-2">
					{#if status === 'connected'}
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="text-xs h-8 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20 gap-1.5"
							onclick={() => (showDisconnectModal = true)}
						>
							<LogOut class="size-3.5" />
							<span>Desconectar</span>
						</Button>
						<Button
							type="button"
							size="sm"
							href="/messages"
							class="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold"
						>
							<MessageSquare class="size-3.5" />
							<span>Ir a Mensajes</span>
						</Button>
					{:else}
						<Button
							type="button"
							size="sm"
							class="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold"
							disabled={isConnecting}
							onclick={handleStartConnect}
						>
							{#if isConnecting}
								<RefreshCw class="size-3.5 animate-spin" />
								<span>Generando QR...</span>
							{:else}
								<QrCode class="size-3.5" />
								<span>Conectar WhatsApp</span>
							{/if}
						</Button>
					{/if}
				</div>
			</div>
		</CardHeader>

		<CardContent class="p-5 sm:p-6 space-y-4">
			{#if status === 'connected'}
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div class="p-4 rounded-xl border border-border bg-muted/30 space-y-1">
						<span class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Número Vinculado</span>
						<p class="text-base font-bold text-foreground font-mono">
							+{phone || 'Registrado'}
						</p>
						{#if pushName}
							<p class="text-xs text-muted-foreground">
								Nombre público en WhatsApp: <strong class="text-foreground">{pushName}</strong>
							</p>
						{/if}
					</div>

					<div class="p-4 rounded-xl border border-border bg-muted/30 space-y-1">
						<span class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Estado del Canal</span>
						<p class="text-xs text-foreground flex items-center gap-1.5 pt-0.5">
							<ShieldCheck class="size-4 text-emerald-600" />
							<span>Recepción y envío en tiempo real activo.</span>
						</p>
						<p class="text-[11px] text-muted-foreground">
							Los mensajes enviados o recibidos se sincronizan con GiveOS al instante.
						</p>
					</div>
				</div>
			{:else}
				<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-muted/30">
					<div class="space-y-1">
						<p class="text-xs font-semibold text-foreground">¿Cómo funciona la conexión?</p>
						<p class="text-xs text-muted-foreground max-w-xl">
							GiveOS utiliza Baileys para crear una sesión idéntica a WhatsApp Web. Solo debes pulsar en
							<strong>"Conectar WhatsApp"</strong>, abrir WhatsApp en tu celular, ir a <em>Dispositivos vinculados</em> y escanear el código QR.
						</p>
					</div>
					<Button
						type="button"
						size="sm"
						variant="outline"
						class="text-xs h-8 gap-1.5 shrink-0"
						onclick={handleStartConnect}
					>
						<QrCode class="size-3.5" />
						<span>Escanear Código QR</span>
					</Button>
				</div>
			{/if}
		</CardContent>
	</Card>

	<!-- 2. TARJETA DE CONFIGURACIÓN DEL BOT CON IA -->
	<Card class="border border-border shadow-xs">
		<CardHeader class="p-5 sm:p-6 pb-4 border-b border-border">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div class="flex items-center gap-3">
					<div class="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
						<Bot class="size-5" />
					</div>
					<div>
						<CardTitle class="text-base sm:text-lg flex items-center gap-2">
							<span>Bot de Ventas con IA (Gemma 4 local)</span>
							{#if botEnabled}
								<Badge variant="outline" class="border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 text-xs gap-1 py-0.5">
									<span class="size-1.5 rounded-full bg-purple-500 animate-pulse"></span>
									Bot Activo
								</Badge>
							{:else}
								<Badge variant="outline" class="border-zinc-500/30 bg-zinc-500/10 text-zinc-500 text-xs py-0.5">
									Pausado
								</Badge>
							{/if}
						</CardTitle>
						<CardDescription class="text-xs mt-0.5">
							Atiende consultas, presenta el catálogo con precios reales y registra pedidos paso a paso.
						</CardDescription>
					</div>
				</div>

				<div class="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						href="/chat-test"
						class="text-xs h-8 gap-1.5 border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10"
					>
						<Sparkles class="size-3.5" />
						<span>Probar en Simulador</span>
						<ExternalLink class="size-3 opacity-60" />
					</Button>

					<Button
						type="button"
						size="sm"
						class="text-xs h-8 font-semibold {botEnabled ? 'bg-zinc-800 text-white hover:bg-zinc-900 dark:bg-zinc-700' : 'bg-purple-600 hover:bg-purple-700 text-white'}"
						disabled={isSavingBotSettings}
						onclick={handleToggleBot}
					>
						{#if isSavingBotSettings}
							<RefreshCw class="size-3.5 animate-spin" />
						{:else}
							<span>{botEnabled ? 'Pausar Bot' : 'Activar Bot'}</span>
						{/if}
					</Button>
				</div>
			</div>
		</CardHeader>

		<CardContent class="p-5 sm:p-6 space-y-4">
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<label for="bot-prompt-input" class="text-xs font-bold text-foreground flex items-center gap-1.5">
						<Sparkles class="size-3.5 text-purple-600" />
						<span>Instrucciones del Sistema (System Prompt)</span>
					</label>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						class="h-6 text-[11px] text-muted-foreground hover:text-foreground gap-1"
						onclick={() => (botPrompt = DEFAULT_BOT_PROMPT)}
					>
						<RotateCcw class="size-3" />
						<span>Restablecer instrucciones</span>
					</Button>
				</div>

				<textarea
					id="bot-prompt-input"
					bind:value={botPrompt}
					rows="9"
					class="w-full rounded-xl border border-input bg-background p-3 text-xs font-mono leading-relaxed placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
					placeholder="Instrucciones para el comportamiento y tono del bot..."
				></textarea>
				<p class="text-[11px] text-muted-foreground">
					El bot cuenta con retardo humano (7-10s) para que el cliente termine de escribir y herramientas automáticas para consultar el catálogo y registrar pedidos.
				</p>
			</div>

			<div class="flex items-center justify-end gap-2 pt-1 border-t border-border">
				<Button
					type="button"
					size="sm"
					class="text-xs h-8 bg-purple-600 hover:bg-purple-700 text-white font-semibold gap-1.5"
					disabled={isSavingBotSettings}
					onclick={handleSavePrompt}
				>
					{#if isSavingBotSettings}
						<RefreshCw class="size-3.5 animate-spin" />
						<span>Guardando...</span>
					{:else}
						<Check class="size-3.5" />
						<span>Guardar Instrucciones</span>
					{/if}
				</Button>
			</div>
		</CardContent>
	</Card>
</div>

<!-- MODAL CÓDIGO QR -->
{#if showQrModal && status !== 'connected'}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
		<div class="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
			<div class="flex items-center justify-between border-b border-border pb-3">
				<div class="flex items-center gap-2">
					<Smartphone class="size-5 text-emerald-600" />
					<h3 class="font-bold text-sm">Vincular WhatsApp</h3>
				</div>
				<button
					type="button"
					class="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
					onclick={() => (showQrModal = false)}
				>
					<X class="size-4" />
				</button>
			</div>

			<div class="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-border min-h-[220px]">
				{#if qrCodeData}
					<img src={qrCodeData} alt="Código QR de WhatsApp" class="size-52 rounded-lg" />
				{:else}
					<div class="flex flex-col items-center justify-center gap-3 text-muted-foreground py-8">
						<RefreshCw class="size-8 animate-spin text-emerald-600" />
						<p class="text-xs font-medium text-foreground">Generando código QR seguro...</p>
					</div>
				{/if}
			</div>

			<div class="space-y-1.5 text-xs text-muted-foreground">
				<p class="font-semibold text-foreground">Pasos para vincular:</p>
				<ol class="list-decimal pl-4 space-y-1 text-[11px]">
					<li>Abre WhatsApp en tu teléfono.</li>
					<li>Toca <strong>Ajustes</strong> o <strong>Menú (⋮)</strong> &gt; <strong>Dispositivos vinculados</strong>.</li>
					<li>Toca en <strong>Vincular un dispositivo</strong> y apunta tu cámara al código QR.</li>
				</ol>
			</div>
		</div>
	</div>
{/if}

<!-- MODAL CONFIRMAR DESCONEXIÓN -->
{#if showDisconnectModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
		<div class="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
			<div class="flex items-center gap-3 text-destructive">
				<LogOut class="size-5" />
				<h3 class="font-bold text-sm text-foreground">¿Desconectar WhatsApp?</h3>
			</div>

			<p class="text-xs text-muted-foreground leading-relaxed">
				Al desconectar la sesión, el bot y la recepción de mensajes se pausarán hasta que vuelvas a vincular el dispositivo.
			</p>

			<div class="flex items-center justify-end gap-2 pt-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					class="text-xs h-8"
					disabled={isDisconnecting}
					onclick={() => (showDisconnectModal = false)}
				>
					Cancelar
				</Button>
				<Button
					type="button"
					variant="destructive"
					size="sm"
					class="text-xs h-8 font-semibold"
					disabled={isDisconnecting}
					onclick={() => handleDisconnect(true)}
				>
					{#if isDisconnecting}
						<RefreshCw class="size-3.5 animate-spin" />
						<span>Cerrando...</span>
					{:else}
						<span>Sí, cerrar sesión</span>
					{/if}
				</Button>
			</div>
		</div>
	</div>
{/if}
