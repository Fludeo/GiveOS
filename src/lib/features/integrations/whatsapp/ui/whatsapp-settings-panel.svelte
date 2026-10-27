<script lang="ts">
	import { Button } from '#lib/components/ui/button';
	import { Badge } from '#lib/components/ui/badge';
	import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '#lib/components/ui/card';
	import { Switch } from '#lib/components/ui/switch';
	import { Input } from '#lib/components/ui/input';
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
	import Building2 from '@lucide/svelte/icons/building-2';
	import Clock from '@lucide/svelte/icons/clock';
	import CreditCard from '@lucide/svelte/icons/credit-card';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import Copy from '@lucide/svelte/icons/copy';
	import { toast } from '#lib/components/ui/toast';
	import type { WhatsAppSessionStatus } from '../domain/whatsapp.entity';
	import {
		type BotSettingsConfig,
		type BotTone,
		BOT_TONES,
		DEFAULT_BOT_CONFIG,
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

	// Configuración estructurada del bot
	let botEnabled = $state(false);
	let botTone = $state<BotTone>('amigable');
	let useEmojis = $state(true);
	let bankTransferInfo = $state(DEFAULT_BOT_CONFIG.bankTransferInfo);
	let depositRequired = $state(true);
	let depositNotes = $state(DEFAULT_BOT_CONFIG.depositNotes || '');
	let specialRules = $state('');
	let isSavingBotSettings = $state(false);
	let showCompiledPrompt = $state(false);

	const toneValues: BotTone[] = ['robot', 'frio', 'formal', 'amigable', 'informal'];
	const toneIndex = $derived(toneValues.indexOf(botTone) !== -1 ? toneValues.indexOf(botTone) : 3);

	function setToneByIndex(idx: number) {
		const clamped = Math.max(0, Math.min(toneValues.length - 1, idx));
		botTone = toneValues[clamped];
	}

	// Sincronizar props iniciales
	$effect(() => {
		if (initialStatus) status = initialStatus;
		if (initialPhone) phone = initialPhone;
		if (initialPushName) pushName = initialPushName;
		if (initialQr) qrCodeData = initialQr;
		if (initialBotSettings) {
			if (typeof initialBotSettings.enabled === 'boolean') botEnabled = initialBotSettings.enabled;
			if (initialBotSettings.tone) botTone = initialBotSettings.tone;
			if (typeof initialBotSettings.useEmojis === 'boolean') useEmojis = initialBotSettings.useEmojis;
			if (initialBotSettings.bankTransferInfo !== undefined) bankTransferInfo = initialBotSettings.bankTransferInfo;
			if (typeof initialBotSettings.depositRequired === 'boolean') depositRequired = initialBotSettings.depositRequired;
			if (initialBotSettings.depositNotes !== undefined) depositNotes = initialBotSettings.depositNotes;
			if (initialBotSettings.specialRules !== undefined) specialRules = initialBotSettings.specialRules;
		}
	});

	// Prompt compilado reactivo
	const compiledPrompt = $derived(
		buildBotSystemPrompt(
			{
				name: business?.name || 'la pastelería',
				description: business?.description,
				openingHours: business?.openingHours,
				currencySymbol: business?.currencySymbol || '$'
			},
			{
				tone: botTone,
				useEmojis,
				bankTransferInfo,
				depositRequired,
				depositNotes,
				specialRules
			}
		)
	);

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
					tone: botTone,
					useEmojis,
					bankTransferInfo,
					depositRequired,
					depositNotes,
					specialRules,
					systemPrompt: compiledPrompt
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
					tone: botTone,
					useEmojis,
					bankTransferInfo,
					depositRequired,
					depositNotes,
					specialRules,
					systemPrompt: compiledPrompt
				})
			});
			const result = await res.json();
			if (result.success) {
				toast.success('Configuración guardada', 'Las opciones del bot con IA fueron actualizadas con éxito.');
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
		botTone = DEFAULT_BOT_CONFIG.tone;
		useEmojis = DEFAULT_BOT_CONFIG.useEmojis;
		bankTransferInfo = DEFAULT_BOT_CONFIG.bankTransferInfo;
		depositRequired = DEFAULT_BOT_CONFIG.depositRequired;
		depositNotes = DEFAULT_BOT_CONFIG.depositNotes || '';
		specialRules = '';
		toast.info('Valores restablecidos', 'Se aplicó la configuración por defecto recomendada.');
	}

	async function copyCompiledPrompt() {
		try {
			await navigator.clipboard.writeText(compiledPrompt);
			toast.success('Copiado', 'Prompt compilado copiado al portapapeles.');
		} catch (_) {
			toast.error('Error', 'No se pudo copiar el texto.');
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
							class="text-xs h-8 text-destructive hover:bg-destructive/10 border-destructive/30"
							onclick={() => (showDisconnectModal = true)}
						>
							<LogOut class="size-3.5" />
							<span>Desconectar</span>
						</Button>
					{:else}
						<Button
							type="button"
							size="sm"
							class="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
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
				<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
					<div class="flex items-center gap-3">
						<div class="flex size-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
							<ShieldCheck class="size-5" />
						</div>
						<div>
							<p class="text-xs font-semibold text-foreground">
								Número Vinculado: <span class="font-mono text-emerald-700 dark:text-emerald-400 font-bold">+{phone || ''}</span>
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

	<!-- 2. TARJETA DE CONFIGURACIÓN DEL BOT CON IA (TEMA PRIMARIO) -->
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
							Configura el comportamiento del bot de manera visual: tono, emojis, seña y datos de pago.
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
							aria-label="Activar o pausar bot de WhatsApp"
						/>
					</div>
				</div>
			</div>
		</CardHeader>

		<CardContent class="p-5 sm:p-6 space-y-6">
			<!-- A. INFORMACIÓN INYECTADA DEL NEGOCIO (ESTÁTICA/AUTOMÁTICA) -->
			<div class="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<Building2 class="size-4 text-primary" />
						<span class="text-xs font-bold text-foreground">Datos del Negocio Inyectados Automáticamente</span>
					</div>
					<Badge variant="outline" class="text-[10px] text-muted-foreground border-border bg-background">
						Auto-sincronizado
					</Badge>
				</div>
				<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
					<div class="rounded-lg bg-background p-2.5 border border-border space-y-1">
						<span class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Nombre</span>
						<p class="font-medium text-foreground truncate">{business?.name || 'la pastelería'}</p>
					</div>
					<div class="rounded-lg bg-background p-2.5 border border-border space-y-1">
						<span class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Horarios</span>
						<p class="font-medium text-foreground truncate">{business?.openingHours || 'Lunes a Sábado 09:00 a 19:00 hs'}</p>
					</div>
					<div class="rounded-lg bg-background p-2.5 border border-border space-y-1">
						<span class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Descripción</span>
						<p class="font-medium text-foreground truncate">{business?.description || 'Repostería y pastelería artesanal'}</p>
					</div>
				</div>
				<p class="text-[11px] text-muted-foreground">
					Estos datos se integran dinámicamente en las respuestas del bot. Puedes editarlos en la pestaña <em>General</em> y <em>Horarios</em>.
				</p>
			</div>

			<!-- B. TONO DEL BOT (SLIDER DE 5 NIVELES) -->
			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<div>
						<label for="bot-tone-slider" class="text-xs font-bold text-foreground flex items-center gap-1.5">
							<span>Tono de Respuesta del Bot</span>
						</label>
						<p class="text-[11px] text-muted-foreground">
							Define la personalidad con la que el bot se comunica con tus clientes.
						</p>
					</div>
					<Badge variant="outline" class="border-primary/30 bg-primary/10 text-primary text-xs font-semibold capitalize">
						{BOT_TONES[toneIndex]?.label}: {BOT_TONES[toneIndex]?.badge}
					</Badge>
				</div>

				<!-- Slider de 5 pasos -->
				<div class="space-y-2 pt-1">
					<input
						id="bot-tone-slider"
						type="range"
						min="0"
						max="4"
						step="1"
						value={toneIndex}
						oninput={(e) => setToneByIndex(Number((e.target as HTMLInputElement).value))}
						class="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
					/>

					<!-- Etiquetas y botones clicables para los 5 niveles -->
					<div class="grid grid-cols-5 gap-1.5 pt-1">
						{#each BOT_TONES as t, i}
							<button
								type="button"
								class="flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer {toneIndex === i
									? 'border-primary bg-primary/10 text-primary shadow-xs font-semibold'
									: 'border-border bg-background hover:bg-muted/50 text-muted-foreground hover:text-foreground'}"
								onclick={() => setToneByIndex(i)}
							>
								<span class="text-xs">{t.label}</span>
								<span class="text-[9px] opacity-75 hidden sm:inline leading-tight mt-0.5 truncate max-w-full">
									{t.badge}
								</span>
							</button>
						{/each}
					</div>

					<p class="text-[11px] text-foreground font-medium bg-muted/30 p-2 rounded-lg border border-border">
						💡 <strong>Comportamiento:</strong> {BOT_TONES[toneIndex]?.shortDesc}
					</p>
				</div>
			</div>

			<!-- C. TOGGLE DE EMOJIS & SEÑA OBLIGATORIA -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<!-- Toggle Emojis -->
				<div class="rounded-xl border border-border p-4 bg-background flex items-center justify-between gap-4">
					<div class="space-y-0.5">
						<label for="use-emojis-switch" class="text-xs font-bold text-foreground cursor-pointer">
							Uso de Emojis ({useEmojis ? 'Permitidos 🍰' : 'Desactivados'})
						</label>
						<p class="text-[11px] text-muted-foreground leading-relaxed">
							{useEmojis
								? 'El bot utiliza emojis simpáticos para hacer la atención amena.'
								: 'El bot responderá de forma sobria, sin utilizar emoticones.'}
						</p>
					</div>
					<Switch
						id="use-emojis-switch"
						checked={useEmojis}
						onCheckedChange={(val: boolean) => (useEmojis = val)}
					/>
				</div>

				<!-- Toggle Seña Obligatoria -->
				<div class="rounded-xl border border-border p-4 bg-background flex items-center justify-between gap-4">
					<div class="space-y-0.5">
						<label for="deposit-required-switch" class="text-xs font-bold text-foreground cursor-pointer">
							Seña Obligatoria ({depositRequired ? 'Exigida' : 'Sin seña'})
						</label>
						<p class="text-[11px] text-muted-foreground leading-relaxed">
							{depositRequired
								? 'Exige comprobante de transferencia para confirmar el pedido.'
								: 'Registra pedidos sin exigir pago previo por adelantado.'}
						</p>
					</div>
					<Switch
						id="deposit-required-switch"
						checked={depositRequired}
						onCheckedChange={(val: boolean) => (depositRequired = val)}
					/>
				</div>
			</div>

			<!-- D. NOTAS DE SEÑA (SI ESTÁ ACTIVA) -->
			{#if depositRequired}
				<div class="space-y-1.5 p-3 rounded-xl border border-border bg-muted/10">
					<label for="deposit-notes-input" class="text-xs font-bold text-foreground">
						Regla de la seña (porcentaje o aclaración)
					</label>
					<Input
						id="deposit-notes-input"
						bind:value={depositNotes}
						placeholder="Ej: Seña previa del 50% requerida para comenzar la elaboración."
						class="text-xs h-8 bg-background"
					/>
					<p class="text-[10px] text-muted-foreground">
						Esta nota se le comunicará al cliente al momento de informarle el total a transferir.
					</p>
				</div>
			{/if}

			<!-- E. INFORMACIÓN DE TRANSFERENCIA (ALIAS / CBU) -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<label for="bank-transfer-info-input" class="text-xs font-bold text-foreground flex items-center gap-1.5">
						<CreditCard class="size-3.5 text-primary" />
						<span>Información para Transferencia Bancaria (Alias / CBU)</span>
					</label>
				</div>
				<textarea
					id="bank-transfer-info-input"
					bind:value={bankTransferInfo}
					rows="3"
					class="w-full rounded-xl border border-input bg-background p-3 text-xs font-mono leading-relaxed placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
					placeholder="Alias: PASTELERIA.SWEET.CAKES&#10;CBU: 0720123488000012345678&#10;Titular: Pastelería Dulce&#10;Banco: Santander"
				></textarea>
				<p class="text-[11px] text-muted-foreground">
					Estos son los datos exactos que el bot le enviará al cliente cuando termine de armar su orden.
				</p>
			</div>

			<!-- F. HEURÍSTICA Y REGLAS ESPECIALES -->
			<div class="space-y-2">
				<label for="special-rules-input" class="text-xs font-bold text-foreground flex items-center gap-1.5">
					<Sparkles class="size-3.5 text-primary" />
					<span>Heurística Especial y Reglas de Negocio</span>
				</label>
				<textarea
					id="special-rules-input"
					bind:value={specialRules}
					rows="3"
					class="w-full rounded-xl border border-input bg-background p-3 text-xs leading-relaxed placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
					placeholder="Ej: Los pedidos con menos de 48hs de anticipación tienen un recargo del 10%. No tomamos pedidos para entrega los domingos después de las 13:00 hs."
				></textarea>
				<p class="text-[11px] text-muted-foreground">
					Cualquier política o consideración específica que quieras que el bot respete al atender.
				</p>
			</div>

			<!-- G. PREVISUALIZACIÓN DESPLEGABLE DEL PROMPT COMPILADO -->
			<div class="rounded-xl border border-border bg-muted/10 overflow-hidden">
				<button
					type="button"
					class="w-full flex items-center justify-between p-3 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer hover:bg-muted/30 transition-colors"
					onclick={() => (showCompiledPrompt = !showCompiledPrompt)}
				>
					<span class="flex items-center gap-1.5">
						<Sparkles class="size-3.5 text-primary" />
						<span>Previsualizar Prompt compilado resultante</span>
					</span>
					{#if showCompiledPrompt}
						<ChevronUp class="size-4" />
					{:else}
						<ChevronDown class="size-4" />
					{/if}
				</button>

				{#if showCompiledPrompt}
					<div class="p-3 border-t border-border bg-background space-y-2">
						<div class="flex items-center justify-between">
							<span class="text-[10px] text-muted-foreground">Generado automáticamente según los controles seleccionados:</span>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								class="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
								onclick={copyCompiledPrompt}
							>
								<Copy class="size-3" />
								<span>Copiar</span>
							</Button>
						</div>
						<pre class="w-full max-h-60 overflow-y-auto p-3 rounded-lg bg-muted/40 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground border border-border">{compiledPrompt}</pre>
					</div>
				{/if}
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
					<span>Restablecer recomendados</span>
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
							<span>Guardar Configuración del Bot</span>
						{/if}
					</Button>
				</div>
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
