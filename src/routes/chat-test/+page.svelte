<script lang="ts">
	import type { PageProps } from './$types';
	import AppShell from '#lib/components/layout/app-shell.svelte';
	import { Button } from '#lib/components/ui/button';
	import { Input } from '#lib/components/ui/input';
	import { Card, CardHeader, CardTitle, CardContent } from '#lib/components/ui/card';
	import Bot from '@lucide/svelte/icons/bot';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Send from '@lucide/svelte/icons/send';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Wrench from '@lucide/svelte/icons/wrench';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import Check from '@lucide/svelte/icons/check';
	import Save from '@lucide/svelte/icons/save';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import { toast } from '#lib/components/ui/toast';
	import { DEFAULT_BOT_PROMPT } from '#lib/features/ai/domain/bot-prompt.constants';

	let { data }: PageProps = $props();

	// Estado del prompt
	let promptValue = $state('');
	let isSavingPrompt = $state(false);

	// Estado del chat de prueba
	interface TestMessage {
		id: string;
		role: 'user' | 'assistant';
		content: string;
		durationMs?: number;
		toolExecuted?: string;
		toolArgs?: any;
		toolResult?: any;
		orderCreated?: {
			orderId: string;
			orderNumber: string;
			totalAmount: number;
		};
		showToolDetails?: boolean;
	}

	let messages = $state<TestMessage[]>([
		{
			id: 'welcome',
			role: 'assistant',
			content:
				'👋 ¡Hola! Soy el simulador de Gemma 4. Puedes escribirme como si fueras un cliente para probar cómo atiendo, qué herramientas ejecuto y cómo voy armando el pedido.'
		}
	]);

	let inputText = $state('');
	let isThinking = $state(false);
	let chatContainer = $state<HTMLDivElement | null>(null);

	$effect(() => {
		if (data.initialPrompt) {
			promptValue = data.initialPrompt;
		}
	});

	function scrollToBottom() {
		setTimeout(() => {
			if (chatContainer) {
				chatContainer.scrollTop = chatContainer.scrollHeight;
			}
		}, 30);
	}

	async function handleSendMessage(customText?: string) {
		const text = (customText || inputText).trim();
		if (!text || isThinking) return;

		inputText = '';

		const userMsg: TestMessage = {
			id: `user-${Date.now()}`,
			role: 'user',
			content: text
		};

		messages = [...messages, userMsg];
		scrollToBottom();
		isThinking = true;

		// Formatear historial previo para el bot
		const history = messages
			.filter((m) => m.id !== 'welcome' && m.id !== userMsg.id)
			.map((m) => ({
				role: m.role,
				text: m.content
			}));

		try {
			const res = await fetch('/api/chat-test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					businessId: data.activeBusiness.id,
					messageText: text,
					chatHistory: history,
					customSystemPrompt: promptValue
				})
			});

			const dataRes = await res.json();

			if (dataRes.success && dataRes.output) {
				const botMsg: TestMessage = {
					id: `bot-${Date.now()}`,
					role: 'assistant',
					content: dataRes.output.replyText || '(Sin respuesta de texto)',
					durationMs: dataRes.durationMs,
					toolExecuted: dataRes.output.toolExecuted,
					toolArgs: dataRes.output.toolArgs,
					toolResult: dataRes.output.toolResult,
					orderCreated: dataRes.output.orderCreated,
					showToolDetails: false
				};

				messages = [...messages, botMsg];
				scrollToBottom();
			} else {
				toast.error('Error del modelo', dataRes.error || 'No se pudo generar respuesta.');
			}
		} catch (err: any) {
			toast.error('Error de conexión', err.message || 'Error al conectar con la API local.');
		} finally {
			isThinking = false;
		}
	}

	function handleClearChat() {
		messages = [
			{
				id: 'welcome',
				role: 'assistant',
				content:
					'👋 Chat reiniciado. Puedes comenzar una nueva conversación de prueba con el modelo.'
			}
		];
	}

	async function handleSavePromptToBusiness() {
		isSavingPrompt = true;
		try {
			const res = await fetch('/api/integrations/whatsapp/bot/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					businessId: data.activeBusiness.id,
					enabled: true,
					systemPrompt: promptValue
				})
			});
			const result = await res.json();
			if (result.success) {
				toast.success(
					'¡Prompt guardado!',
					'Este prompt ahora se utilizará en las respuestas reales de WhatsApp.'
				);
			} else {
				toast.error('Error al guardar prompt', result.error);
			}
		} catch (e: any) {
			toast.error('Error de red', e.message);
		} finally {
			isSavingPrompt = false;
		}
	}

	const quickChips = [
		'¡Hola! ¿Qué productos tienen disponibles?',
		'¿Tienen lemon pie y a qué precio?',
		'Quiero encargar 2 lemon pie para retirar mañana a nombre de Laura Pérez',
		'¿Cuáles son los datos para hacer la transferencia bancaria?',
		'comprobante enviado'
	];
</script>

<svelte:head>
	<title>Simulador de IA (Local) — {data.activeBusiness.name}</title>
</svelte:head>

<AppShell
	user={data.user}
	activeBusiness={data.activeBusiness}
	businesses={data.businesses}
	currentSection="messages"
	title="Simulador de IA & Prompt (Local)"
	description="Prueba y depura el comportamiento de Gemma 4 y sus herramientas en tu GPU sin tocar WhatsApp."
>
	<div class="mx-auto max-w-6xl space-y-5">
		<!-- BARRA DE ESTADO DEL SIMULADOR -->
		<div
			class="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border border-border bg-card/60 backdrop-blur-sm shadow-xs"
		>
			<div class="flex items-center gap-3">
				<div
					class="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold"
				>
					<Bot class="size-5" />
				</div>
				<div>
					<div class="flex items-center gap-2">
						<h3 class="text-xs font-bold text-foreground">Ambiente de Pruebas Local</h3>
						<span
							class="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-success/90 font-mono"
						>
							<span class="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
							Ollama (gemma4:e2b en GPU)
						</span>
					</div>
					<p class="text-[11px] text-muted-foreground">
						Conectado a la base de datos de <strong>{data.activeBusiness.name}</strong> con {data.productsCount}
						productos activos en catálogo.
					</p>
				</div>
			</div>

			<div class="flex items-center gap-2">
				<Button
					href="/messages"
					variant="outline"
					size="sm"
					class="h-8 text-xs font-medium"
				>
					Ir a Mensajes
				</Button>
			</div>
		</div>

		<!-- PANEL DIVIDIDO: PROMPT & CHAT PLAYGROUND -->
		<div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
			<!-- COLUMNA IZQUIERDA: CONFIGURADOR DE PROMPT & HERRAMIENTAS (5 cols) -->
			<div class="lg:col-span-5 space-y-4">
				<Card class="border border-border shadow-xs">
					<CardHeader class="p-4 pb-2 border-b border-border">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<Sparkles class="size-4 text-primary" />
								<CardTitle class="text-xs font-bold">Prompt del Sistema</CardTitle>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								class="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
								onclick={() => (promptValue = DEFAULT_BOT_PROMPT)}
							>
								<RotateCcw class="size-3" />
								<span>Por defecto</span>
							</Button>
						</div>
					</CardHeader>
					<CardContent class="p-4 space-y-3">
						<div class="space-y-1">
							<textarea
								bind:value={promptValue}
								rows="13"
								class="w-full rounded-xl border border-input bg-background p-3 text-xs font-mono leading-relaxed placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
								placeholder="Escribe las instrucciones para el modelo..."
							></textarea>
							<p class="text-[10px] text-muted-foreground">
								Edita las instrucciones y escribe en el chat para probar cómo cambia la respuesta inmediatamente.
							</p>
						</div>

						<div class="pt-1 flex items-center justify-between gap-2">
							<span class="text-[10.5px] text-muted-foreground">
								¿Te gustó cómo responde?
							</span>
							<Button
								type="button"
								size="sm"
								class="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5"
								disabled={isSavingPrompt}
								onclick={handleSavePromptToBusiness}
							>
								{#if isSavingPrompt}
									<RefreshCw class="size-3.5 animate-spin" />
									<span>Guardando...</span>
								{:else}
									<Save class="size-3.5" />
									<span>Guardar para WhatsApp</span>
								{/if}
							</Button>
						</div>
					</CardContent>
				</Card>

				<!-- HERRAMIENTAS ACTIVAS -->
				<div class="p-3.5 rounded-2xl border border-border bg-card/60 text-xs space-y-2">
					<div class="flex items-center gap-1.5 font-bold text-foreground">
						<Wrench class="size-3.5 text-primary" />
						<span>Herramientas activas en la GPU:</span>
					</div>
					<ul class="space-y-1 text-[11px] text-muted-foreground">
						<li class="flex items-center gap-1.5">
							<span class="size-1.5 rounded-full bg-emerald-500"></span>
							<code class="font-mono text-foreground font-semibold">get_catalog()</code>: Consulta productos y precios reales.
						</li>
						<li class="flex items-center gap-1.5">
							<span class="size-1.5 rounded-full bg-emerald-500"></span>
							<code class="font-mono text-foreground font-semibold">get_business_info()</code>: Consulta Alias/CBU y horarios.
						</li>
						<li class="flex items-center gap-1.5">
							<span class="size-1.5 rounded-full bg-emerald-500"></span>
							<code class="font-mono text-foreground font-semibold">create_unconfirmed_order()</code>: Registra pedido pendiente.
						</li>
					</ul>
				</div>
			</div>

			<!-- COLUMNA DERECHA: PLAYGROUND DE CHAT (7 cols) -->
			<div class="lg:col-span-7 flex flex-col rounded-2xl border border-border bg-card shadow-sm overflow-hidden h-[620px]">
				<!-- Header del Chat -->
				<div class="p-3.5 border-b border-border bg-muted/20 flex items-center justify-between gap-3 shrink-0">
					<div class="flex items-center gap-2">
						<div
							class="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-success/90 font-bold"
						>
							<Bot class="size-4" />
						</div>
						<div>
							<h4 class="text-xs font-bold text-foreground">Simulador de Conversación</h4>
							<span class="text-[10px] text-muted-foreground">Prueba aislada (sin interacción de WhatsApp)</span>
						</div>
					</div>

					<Button
						type="button"
						variant="ghost"
						size="sm"
						class="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
						onclick={handleClearChat}
						title="Reiniciar chat de prueba"
					>
						<Trash2 class="size-3.5" />
						<span>Reiniciar</span>
					</Button>
				</div>

				<!-- Sugerencias Rápidas (Chips) -->
				<div class="p-2 border-b border-border/60 bg-muted/10 overflow-x-auto flex items-center gap-1.5 shrink-0 scrollbar-none">
					<span class="text-[10px] font-medium text-muted-foreground shrink-0 pl-1">Probar:</span>
					{#each quickChips as chip}
						<button
							type="button"
							class="shrink-0 px-2.5 py-1 rounded-full text-[10.5px] bg-background hover:bg-muted border border-border text-foreground transition-colors cursor-pointer"
							onclick={() => handleSendMessage(chip)}
							disabled={isThinking}
						>
							{chip}
						</button>
					{/each}
				</div>

				<!-- Lista de Mensajes (Scrollable) -->
				<div
					bind:this={chatContainer}
					class="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10"
				>
					{#each messages as msg (msg.id)}
						<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
							<div
								class="relative max-w-[85%] rounded-2xl p-3.5 text-xs shadow-2xs leading-relaxed space-y-2 {msg.role === 'user'
									? 'bg-emerald-600 text-white rounded-tr-xs'
									: 'bg-card border border-border text-foreground rounded-tl-xs'}"
							>
								<!-- Encabezado del Mensaje del Bot con Info de Tool Call -->
								{#if msg.role === 'assistant' && msg.id !== 'welcome'}
									<div class="flex items-center justify-between gap-2 border-b border-border/40 pb-1.5 text-[10px] text-muted-foreground">
										<div class="flex items-center gap-1.5 font-semibold text-foreground">
											<Bot class="size-3 text-primary" />
											<span>Gemma 4</span>
										</div>
										{#if msg.durationMs}
											<span class="font-mono text-emerald-600 dark:text-success/90 font-bold">
												⏱️ {(msg.durationMs / 1000).toFixed(1)}s
											</span>
										{/if}
									</div>

									<!-- Tarjeta de Ejecución de Tool Call -->
									{#if msg.toolExecuted}
										<div class="rounded-lg border border-primary/20 bg-primary/5 p-2 space-y-1.5 text-[11px]">
											<div class="flex items-center justify-between">
												<div class="flex items-center gap-1.5 font-bold text-primary">
													<Wrench class="size-3" />
													<span>Herramienta: <code>{msg.toolExecuted}()</code></span>
												</div>
												<button
													type="button"
													class="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 cursor-pointer"
													onclick={() => (msg.showToolDetails = !msg.showToolDetails)}
												>
													<span>{msg.showToolDetails ? 'Ocultar' : 'Ver datos'}</span>
													{#if msg.showToolDetails}
														<ChevronUp class="size-3" />
													{:else}
														<ChevronDown class="size-3" />
													{/if}
												</button>
											</div>

											{#if msg.showToolDetails}
												<div class="space-y-1 pt-1 border-t border-border/40 font-mono text-[10px] overflow-x-auto">
													{#if msg.toolArgs}
														<div>
															<strong class="text-foreground">Argumentos:</strong>
															<pre class="bg-background/80 p-1.5 rounded text-[9.5px] mt-0.5">{JSON.stringify(msg.toolArgs, null, 2)}</pre>
														</div>
													{/if}
													{#if msg.toolResult}
														<div>
															<strong class="text-foreground">Resultado:</strong>
															<pre class="bg-background/80 p-1.5 rounded text-[9.5px] mt-0.5">{typeof msg.toolResult === 'string' ? msg.toolResult : JSON.stringify(msg.toolResult, null, 2)}</pre>
														</div>
													{/if}
												</div>
											{/if}
										</div>
									{/if}

									<!-- Tarjeta de Orden Creada -->
									{#if msg.orderCreated}
										<div class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 flex items-center justify-between gap-2 text-xs">
											<div class="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
												<ShoppingBag class="size-3.5" />
												<span>
													Pedido creado: <strong>#{msg.orderCreated.orderNumber}</strong> (${msg.orderCreated.totalAmount.toLocaleString('es-AR')})
												</span>
											</div>
											<span class="text-[10px] font-bold text-emerald-700 dark:text-success/90">No confirmado</span>
										</div>
									{/if}
								{/if}

								<!-- Contenido del Mensaje -->
								<p class="whitespace-pre-line leading-relaxed font-normal">
									{msg.content}
								</p>
							</div>
						</div>
					{/each}

					{#if isThinking}
						<div class="flex justify-start">
							<div
								class="rounded-2xl rounded-tl-xs border border-border bg-card p-3.5 text-xs text-muted-foreground flex items-center gap-2.5 shadow-2xs animate-in fade-in"
							>
								<RefreshCw class="size-3.5 animate-spin text-primary" />
								<span>Gemma 4 pensando y evaluando herramientas en tu GPU...</span>
							</div>
						</div>
					{/if}
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
							bind:value={inputText}
							placeholder="Escribe un mensaje para probar el bot..."
							class="h-9.5 text-xs bg-background"
							disabled={isThinking}
						/>
						<Button
							type="submit"
							size="icon"
							disabled={isThinking || !inputText.trim()}
							class="size-9.5 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 rounded-xl"
							title="Enviar"
						>
							{#if isThinking}
								<RefreshCw class="size-4 animate-spin" />
							{:else}
								<Send class="size-4" />
							{/if}
						</Button>
					</form>
				</div>
			</div>
		</div>
	</div>
</AppShell>
