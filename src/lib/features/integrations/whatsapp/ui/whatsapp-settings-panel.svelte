<script lang="ts">
	import { Button } from '#lib/components/ui/button';
	import { Badge } from '#lib/components/ui/badge';
	import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '#lib/components/ui/card';
	import { Switch } from '#lib/components/ui/switch';
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
	import type { WhatsAppSessionStatus } from '../domain/whatsapp.entity';
	import {
		type BotSettingsConfig,
		buildBotSystemPrompt
	} from '#lib/features/ai/domain/bot-config.entity';

	interface Props {
		businessId: string;
		business?: {
			name?: string | null;
			description?: string | null;
			openingHours?: string | null;
			currencySymbol?: string | null;
		};
		initialStatus?: WhatsAppSessionStatus;
		initialPhone?: string | null;
		initialPushName?: string | null;
		initialQr?: string | null;
		initialBotSettings?: Partial<BotSettingsConfig>;
	}

	let {
		businessId,
		business,
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

	// Configuración simplificada del bot: únicamente enabled + systemPrompt
	const defaultSystemPrompt = $derived(
		buildBotSystemPrompt({
			name: business?.name || 'mi negocio',
			description: business?.description,
			openingHours: business?.openingHours,
			currencySymbol: business?.currencySymbol || '$'
		})
	);

	let botEnabled = $state(false);
	let systemPrompt = $state('');
	let isSavingBotSettings = $state(false);

	// Sincronizar props iniciales
	$effect(() => {
		if (initialStatus) status = initialStatus;
		if (initialPhone) phone = initialPhone;
		if (initialPushName) pushName = initialPushName;
		if (initialQr) qrCodeData = initialQr;
		if (initialBotSettings) {
			if (typeof initialBotSettings.enabled === 'boolean') botEnabled = initialBotSettings.enabled;
			systemPrompt = initialBotSettings.systemPrompt?.trim() || defaultSystemPrompt;
		} else if (!systemPrompt) {
			systemPrompt = defaultSystemPrompt;
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

	async function handleStartConnect(forceNew = false) {
		isConnecting = true;
		qrCodeData = null;
		showQrModal = true;
		try {
			const res = await fetch('/api/integrations/whatsapp/connect', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ businessId, forceNew })
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

	async function handleToggleBot(newVal: boolean) {
		botEnabled = newVal;
		isSavingBotSettings = true;
		try {
			const res = await fetch('/api/integrations/whatsapp/bot/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					businessId,
					enabled: newVal,
					systemPrompt
				})
			});
			const result = await res.json();
			if (result.success) {
				toast.success(
					newVal ? 'Bot activado' : 'Bot pausado',
					newVal
						? 'El bot responderá automáticamente los mensajes de los clientes.'
						: 'El bot ha sido pausado. Podrás responder manualmente desde Mensajes.'
				);
			} else {
				botEnabled = !newVal;
				toast.error('Error al actualizar bot', result.error || 'No se pudo guardar la configuración.');
			}
		} catch (e: any) {
			botEnabled = !newVal;
			toast.error('Error de red', e.message || 'No se pudo conectar con el servidor.');
		} finally {
			isSavingBotSettings = false;
		}
	}

	async function handleSaveBotSettings() {
		isSavingBotSettings = true;
		try {
			const res = await fetch('/api/integrations/whatsapp/bot/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					businessId,
					enabled: botEnabled,
					systemPrompt
				})
			});
			const result = await res.json();
			if (result.success) {
				toast.success('System Prompt guardado', 'Las instrucciones del bot fueron actualizadas con éxito.');
			} else {
				toast.error('Error al guardar', result.error || 'No se pudo guardar.');
			}
		} catch (e: any) {
			toast.error('Error de red', e.message || 'Error al conectar.');
		} finally {
			isSavingBotSettings = false;
		}
	}

	function resetToDefaults() {
		systemPrompt = defaultSystemPrompt;
		toast.info('Prompt restablecido', 'Se cargó la plantilla recomendada de System Prompt.');
	}
</script>

<div class="space-y-6">
	<!-- 1. TARJETA DE CONEXIÓN CON WHATSAPP -->
	<Card class="border border-border shadow-xs">
		<CardHeader class="p-5 sm:p-6 pb-4 border-b border-border">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div class="flex items-center gap-3">
					<div class="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-[#25D366]">
						<Smartphone class="size-5 text-[#25D366]" />
					</div>
					<div>
						<CardTitle class="text-base sm:text-lg flex items-center gap-2">
							<span>WhatsApp Web & Baileys</span>
							{#if status === 'connected'}
								<Badge variant="outline" class="border-emerald-500/30 bg-emerald-500/10 text-[#25D366] text-xs gap-1 py-0.5">
									<span class="size-1.5 rounded-full bg-[#25D366] animate-pulse"></span>
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
					<Button
						type="button"
						variant="outline"
						size="sm"
						href="/messages"
						class="text-xs h-8 gap-1.5"
					>
						<MessageSquare class="size-3.5" />
						<span>Ir al Chat</span>
						<ExternalLink class="size-3 opacity-60" />
					</Button>

					{#if status === 'connected'}
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="text-xs h-8 text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5"
							onclick={() => (showDisconnectModal = true)}
						>
							<LogOut class="size-3.5" />
							<span>Desvincular</span>
						</Button>
					{:else}
						<Button
							type="button"
							size="sm"
							class="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-xs"
							disabled={isConnecting}
							onclick={() => handleStartConnect(false)}
						>
							{#if isConnecting}
								<RefreshCw class="size-3.5 animate-spin" />
								<span>Generando QR...</span>
							{:else}
								<QrCode class="size-3.5" />
								<span>{status === 'scanning_qr' ? 'Ver Código QR' : 'Conectar WhatsApp'}</span>
							{/if}
						</Button>
					{/if}
				</div>
			</div>
		</CardHeader>

		<CardContent class="p-5 sm:p-6 space-y-4">
			{#if status === 'connected'}
				<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
					<div class="flex items-center gap-3">
						<div class="flex size-10 items-center justify-center rounded-full bg-emerald-500/20 text-[#25D366]">
							<ShieldCheck class="size-5" />
						</div>
						<div>
							<p class="text-xs font-semibold text-foreground">
								Número Vinculado: <span class="font-mono text-emerald-700 dark:text-success/90 font-bold">+{phone || ''}</span>
							</p>
							<p class="text-xs text-muted-foreground">
								Nombre en WhatsApp: <span class="text-foreground">{pushName || 'Sin nombre registrado'}</span>
							</p>
						</div>
					</div>

					<div class="flex items-center gap-2">
						<Button
							type="button"
							size="sm"
							variant="outline"
							class="text-xs h-8 gap-1.5"
							onclick={() => handleDisconnect(false)}
							disabled={isDisconnecting}
						>
							<RefreshCw class="size-3.5 {isDisconnecting ? 'animate-spin' : ''}" />
							<span>Reiniciar Socket</span>
						</Button>
					</div>
				</div>
			{:else}
				<div class="p-4 rounded-xl border border-border bg-muted/30">
					<div class="space-y-1">
						<p class="text-xs font-semibold text-foreground">¿Cómo funciona la conexión?</p>
						<p class="text-xs text-muted-foreground leading-relaxed">
							GiveOS utiliza Baileys para crear una sesión idéntica a WhatsApp Web. Solo debes pulsar en el botón superior
							<strong>"Conectar WhatsApp"</strong>, abrir WhatsApp en tu celular, ir a <em>Dispositivos vinculados</em> y escanear el código QR.
						</p>
					</div>
				</div>
			{/if}
		</CardContent>
	</Card>

	<!-- 2. TARJETA DE SYSTEM PROMPT DEL BOT CON IA -->
	<Card class="border border-border shadow-xs">
		<CardHeader class="p-5 sm:p-6 pb-4 border-b border-border">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div class="flex items-center gap-3">
					<div class="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<Bot class="size-5" />
					</div>
					<div>
						<CardTitle class="text-base sm:text-lg flex items-center gap-2">
							<span>Bot de Ventas con IA</span>
							{#if botEnabled}
								<Badge variant="outline" class="border-primary/30 bg-primary/10 text-primary text-xs gap-1 py-0.5">
									<span class="size-1.5 rounded-full bg-primary animate-pulse"></span>
									Bot Activo
								</Badge>
							{:else}
								<Badge variant="outline" class="border-zinc-500/30 bg-zinc-500/10 text-zinc-500 text-xs py-0.5">
									Pausado
								</Badge>
							{/if}
						</CardTitle>
						<CardDescription class="text-xs mt-0.5">
							Define las instrucciones completas del asistente mediante un único System Prompt.
						</CardDescription>
					</div>
				</div>

				<div class="flex items-center gap-3">
					<Button
						type="button"
						variant="outline"
						size="sm"
						href="/chat-test"
						class="text-xs h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
					>
						<Sparkles class="size-3.5" />
						<span>Simulador de Chat</span>
						<ExternalLink class="size-3 opacity-60" />
					</Button>

					<div class="flex items-center gap-2 bg-muted/40 px-3 py-1 rounded-full border border-border">
						<span class="text-xs font-semibold {botEnabled ? 'text-primary' : 'text-muted-foreground'}">
							{botEnabled ? 'Encendido' : 'Apagado'}
						</span>
						<Switch
							checked={botEnabled}
							disabled={isSavingBotSettings}
							onCheckedChange={handleToggleBot}
							aria-label="Activar o pausar bot de IA"
						/>
					</div>
				</div>
			</div>
		</CardHeader>

		<CardContent class="p-5 sm:p-6 space-y-4">
			<div class="space-y-2">
				<label for="bot-system-prompt-input" class="text-xs font-bold text-foreground flex items-center gap-1.5">
					<Sparkles class="size-3.5 text-primary" />
					<span>System Prompt del Bot</span>
				</label>
				<textarea
					id="bot-system-prompt-input"
					bind:value={systemPrompt}
					rows="14"
					class="w-full rounded-xl border border-input bg-background p-3.5 text-xs font-mono leading-relaxed placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
					placeholder="Escribe aquí las instrucciones del sistema para el bot..."
				></textarea>
				<p class="text-[11px] text-muted-foreground">
					Aquí puedes detallar el tono, las reglas de negocio, datos de transferencia (Alias/CBU), políticas de seña y flujo de atención. El bot tiene acceso automático a las herramientas <code class="font-mono text-foreground">get_catalog()</code>, <code class="font-mono text-foreground">get_business_info()</code> y <code class="font-mono text-foreground">create_unconfirmed_order()</code>.
				</p>
			</div>

			<!-- BOTONES DE ACCIÓN -->
			<div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					class="text-xs text-muted-foreground hover:text-foreground gap-1.5 order-2 sm:order-1"
					onclick={resetToDefaults}
				>
					<RotateCcw class="size-3.5" />
					<span>Restablecer prompt por defecto</span>
				</Button>

				<div class="flex items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
					<Button
						type="button"
						size="sm"
						class="w-full sm:w-auto text-xs h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5 shadow-xs cursor-pointer"
						disabled={isSavingBotSettings}
						onclick={handleSaveBotSettings}
					>
						{#if isSavingBotSettings}
							<RefreshCw class="size-3.5 animate-spin" />
							<span>Guardando...</span>
						{:else}
							<Check class="size-3.5" />
							<span>Guardar System Prompt</span>
						{/if}
					</Button>
				</div>
			</div>
		</CardContent>
	</Card>
</div>

<!-- MODAL CÓDIGO QR -->
{#if showQrModal && status !== 'connected'}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
		<div class="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-3">
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

			<div class="pt-2 border-t border-border flex flex-col items-center gap-1.5">
				<button
					type="button"
					class="text-[11px] text-destructive hover:underline text-center cursor-pointer flex items-center justify-center gap-1 w-full py-1"
					onclick={() => {
						showQrModal = false;
						showDisconnectModal = true;
					}}
				>
					<LogOut class="size-3" />
					<span>¿No carga el QR? Desvincular sesión anterior y empezar de cero</span>
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- MODAL CONFIRMAR DESCONEXIÓN -->
{#if showDisconnectModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
		<div class="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-3">
			<div class="flex items-center gap-3 text-destructive">
				<LogOut class="size-5" />
				<h3 class="font-bold text-sm text-foreground">¿Desvincular WhatsApp?</h3>
			</div>

			<p class="text-xs text-muted-foreground leading-relaxed">
				Esta acción cerrará la sesión y <strong>eliminará por completo todas las credenciales y llaves de Baileys</strong> de la base de datos, permitiéndote vincular un dispositivo nuevo desde cero.
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
						<span>Borrando sesión...</span>
					{:else}
						<span>Sí, borrar todo y desvincular</span>
					{/if}
				</Button>
			</div>
		</div>
	</div>
{/if}
