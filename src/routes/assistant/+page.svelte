<script lang="ts">
	import type { PageProps } from './$types';
	import AppShell from '#lib/components/layout/app-shell.svelte';
	import { Button } from '#lib/components/ui/button';
	import { Input } from '#lib/components/ui/input';
	import { Badge } from '#lib/components/ui/badge';
	import { Card, CardHeader, CardTitle, CardContent } from '#lib/components/ui/card';
	import { toast } from '#lib/components/ui/toast';
	import {
		DRAFT_ACTION_LABELS,
		DRAFT_ENTITY_LABELS,
		type DraftSummaryStatus
	} from '#lib/features/drafts/domain/draft.entity';
	import Bot from '@lucide/svelte/icons/bot';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Send from '@lucide/svelte/icons/send';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Wrench from '@lucide/svelte/icons/wrench';
	import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import FileJson from '@lucide/svelte/icons/file-json';
	import Layers from '@lucide/svelte/icons/layers';
	import Terminal from '@lucide/svelte/icons/terminal';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';

	let { data }: PageProps = $props();

	interface ChatMessage {
		id: string;
		role: 'user' | 'assistant';
		content: string;
		durationMs?: number;
		toolsExecuted?: Array<{ name: string; args: Record<string, any>; result: any }>;
		showTools?: boolean;
	}

	let localDraftOverride = $state<DraftSummaryStatus | null>(null);
	const draftSummary = $derived<DraftSummaryStatus>(localDraftOverride ?? data.initialDraftSummary);
	let messages = $state<ChatMessage[]>([
		{
			id: 'welcome',
			role: 'assistant',
			content:
				'¡Hola! Soy el Asistente Copiloto conectado al **MCP de GiveOS** y al **Motor de Borradores (JSONB + Zod)**. Contame qué insumos, recetas, productos o pedidos querés ir armando: los voy a anotar en el borrador y te voy a ir preguntando ordenadamente los datos que falten antes de confirmarlos.'
		}
	]);

	let inputText = $state('');
	let isThinking = $state(false);
	let isMutatingDraft = $state(false);
	let showMcpInfo = $state(false);
	let showRawJson = $state(false);
	let chatContainer = $state<HTMLDivElement | null>(null);

	$effect(() => {
		if (data.initialDraftSummary) {
			localDraftOverride = null;
		}
	});

	function scrollToBottom() {
		setTimeout(() => {
			if (chatContainer) {
				chatContainer.scrollTop = chatContainer.scrollHeight;
			}
		}, 30);
	}

	async function refreshDraft() {
		isMutatingDraft = true;
		try {
			const res = await fetch(`/api/assistant/draft?businessId=${data.activeBusiness.id}`);
			const json = await res.json();
			if (res.ok && json.summary) {
				localDraftOverride = json.summary;
			}
		} catch (e: any) {
			toast.error(e.message || 'Error al sincronizar el borrador');
		} finally {
			isMutatingDraft = false;
		}
	}

	async function handleSendMessage(customText?: string) {
		const text = (customText || inputText).trim();
		if (!text || isThinking) return;

		inputText = '';

		const userMsg: ChatMessage = {
			id: `user-${Date.now()}`,
			role: 'user',
			content: text
		};

		const historyForApi = messages
			.filter((m) => m.id !== 'welcome')
			.map((m) => ({
				role: m.role,
				text: m.content
			}));

		messages = [...messages, userMsg];
		isThinking = true;
		scrollToBottom();

		try {
			const res = await fetch('/api/assistant/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					businessId: data.activeBusiness.id,
					messageText: text,
					chatHistory: historyForApi
				})
			});

			const result = await res.json();
			if (!res.ok) {
				throw new Error(result.error || 'Error al consultar al asistente');
			}

			if (result.output?.draftSummary) {
				localDraftOverride = result.output.draftSummary;
			}

			const botMsg: ChatMessage = {
				id: `bot-${Date.now()}`,
				role: 'assistant',
				content: result.output.replyText,
				durationMs: result.durationMs,
				toolsExecuted: result.output.toolsExecuted || [],
				showTools: false
			};

			messages = [...messages, botMsg];
		} catch (err: any) {
			toast.error(err.message || 'Error comunicándose con el proveedor de IA');
			messages = [
				...messages,
				{
					id: `err-${Date.now()}`,
					role: 'assistant',
					content: `⚠️ No pude completar la consulta con el modelo de IA (${err.message}). Aun así, puedes usar los botones rápidos del borrador o conectar cualquier agente externo por MCP en \`/api/mcp\`.`
				}
			];
		} finally {
			isThinking = false;
			scrollToBottom();
		}
	}

	async function handleSeedInitialPastryDraft() {
		isMutatingDraft = true;
		try {
			const res = await fetch('/api/assistant/draft', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					businessId: data.activeBusiness.id,
					action: 'upsert_batch',
					entries: [
						{
							entryId: 'item:harina',
							entityType: 'item',
							action: 'create',
							data: { name: 'Harina 0000', type: 'raw_material', baseUnit: 'kg' }
						},
						{
							entryId: 'item:azucar',
							entityType: 'item',
							action: 'create',
							data: { name: 'Azúcar', type: 'raw_material', baseUnit: 'kg' }
						},
						{
							entryId: 'item:huevos',
							entityType: 'item',
							action: 'create',
							data: { name: 'Huevos', type: 'raw_material', baseUnit: 'unit' }
						},
						{
							entryId: 'item:esencia-de-vainilla',
							entityType: 'item',
							action: 'create',
							data: { name: 'Esencia de Vainilla', type: 'raw_material', baseUnit: 'ml' }
						}
					]
				})
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.error);
			localDraftOverride = json.summary;
			toast.success('4 insumos de pastelería pre-cargados en el borrador. Revisa los campos pendientes.');
		} catch (e: any) {
			toast.error(e.message || 'Error al cargar en el borrador');
		} finally {
			isMutatingDraft = false;
		}
	}

	async function handleRemoveEntry(entryId: string) {
		isMutatingDraft = true;
		try {
			const res = await fetch('/api/assistant/draft', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					businessId: data.activeBusiness.id,
					action: 'remove_entry',
					entryId
				})
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.error);
			localDraftOverride = json.summary;
			toast.success(`Entrada "${entryId}" eliminada del borrador`);
		} catch (e: any) {
			toast.error(e.message || 'Error al eliminar la entrada');
		} finally {
			isMutatingDraft = false;
		}
	}

	async function handleClearDraft() {
		isMutatingDraft = true;
		try {
			const res = await fetch('/api/assistant/draft', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					businessId: data.activeBusiness.id,
					action: 'clear'
				})
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.error);
			localDraftOverride = json.summary;
			toast.success('Borrador vaciado');
		} catch (e: any) {
			toast.error(e.message || 'Error al vaciar el borrador');
		} finally {
			isMutatingDraft = false;
		}
	}

	async function handleCommitDraft() {
		isMutatingDraft = true;
		try {
			const res = await fetch('/api/assistant/draft', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					businessId: data.activeBusiness.id,
					action: 'commit'
				})
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.error);
			localDraftOverride = json.summary;
			const c = json.commitResult;
			toast.success(
				`¡Borrador confirmado! Creados: ${c.createdItems.length} ítems, ${c.createdRecipeLinesCount} líneas de receta, ${c.createdSalesProducts.length} productos, ${c.createdOrders.length} pedidos.`
			);
		} catch (e: any) {
			toast.error(e.message || 'No se pudo confirmar el borrador');
		} finally {
			isMutatingDraft = false;
		}
	}
</script>

<AppShell
	user={data.user}
	activeBusiness={data.activeBusiness}
	businesses={data.businesses}
	currentSection="assistant"
	title="Asistente IA & Borrador MCP"
	description="Conversa con el asistente o conecta cualquier agente externo vía MCP usando el Borrador Dinámico (JSONB + Zod)."
>
	{#snippet headerActions()}
		<div class="flex items-center gap-2">
			<Button
				variant="outline"
				size="sm"
				onclick={() => (showMcpInfo = !showMcpInfo)}
				class="gap-1.5"
			>
				<Terminal class="size-4" />
				<span>Conexión MCP ({data.mcpTools.length} tools)</span>
			</Button>
			<Button
				variant="outline"
				size="sm"
				onclick={refreshDraft}
				disabled={isMutatingDraft}
				class="gap-1.5"
			>
				<RefreshCw class="size-4 {isMutatingDraft ? 'animate-spin' : ''}" />
				<span>Sincronizar</span>
			</Button>
		</div>
	{/snippet}

	<div class="flex flex-col gap-4 p-4 lg:p-6">
		{#if showMcpInfo}
			<Card class="border-secondary/40 bg-secondary/5">
				<CardHeader class="pb-2">
					<CardTitle class="flex items-center gap-2 text-sm font-semibold">
						<Terminal class="size-4 text-secondary" />
						Servidor MCP de GiveOS activo en <code>/api/mcp</code>
					</CardTitle>
				</CardHeader>
				<CardContent class="space-y-2 text-xs text-muted-foreground">
					<p>
						Puedes conectar cualquier agente externo (Antigravity, Claude Code, Cursor, etc.) a este
						mismo borrador usando el endpoint JSON-RPC HTTP:
					</p>
					<pre
						class="overflow-x-auto rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground">{JSON.stringify(
							{
								mcpServers: {
									giveos: {
										url: `http://localhost:5173/api/mcp?businessId=${data.activeBusiness.id}`
									}
								}
							},
							null,
							2
						)}</pre>
					<div class="flex flex-wrap gap-1.5 pt-1">
						{#each data.mcpTools as tool (tool.name)}
							<Badge variant="outline" class="font-mono text-[11px]">{tool.name}</Badge>
						{/each}
					</div>
				</CardContent>
			</Card>
		{/if}

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
			<!-- Columna Izquierda: Chat con el Asistente -->
			<div class="flex flex-col lg:col-span-7">
				<Card class="flex h-[calc(100vh-13rem)] flex-col overflow-hidden">
					<CardHeader class="shrink-0 border-b border-border bg-muted/30 py-3">
						<div class="flex items-center justify-between gap-2">
							<div class="flex items-center gap-2.5">
								<div
									class="flex size-8 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"
								>
									<Sparkles class="size-4" />
								</div>
								<div>
									<CardTitle class="text-sm font-semibold">Chat Copiloto GiveOS</CardTitle>
									<p class="text-xs text-muted-foreground">
										Inferencia guiada por Schemas de Zod con <code>.describe()</code>
									</p>
								</div>
							</div>
							<Button
								variant="outline"
								size="sm"
								onclick={handleSeedInitialPastryDraft}
								disabled={isMutatingDraft}
								class="text-xs"
							>
								+ Pre-cargar 4 insumos pastelería
							</Button>
						</div>
					</CardHeader>

					<!-- Mensajes -->
					<div
						bind:this={chatContainer}
						class="flex-1 space-y-4 overflow-y-auto p-4"
					>
						{#each messages as msg (msg.id)}
							<div
								class="flex flex-col {msg.role === 'user' ? 'items-end' : 'items-start'}"
							>
								<div
									class="max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-2xs {msg.role === 'user'
										? 'bg-primary text-primary-foreground'
										: 'border border-border bg-card text-card-foreground'}"
								>
									<div class="whitespace-pre-wrap leading-relaxed">{msg.content}</div>

									{#if msg.toolsExecuted && msg.toolsExecuted.length > 0}
										<div class="mt-2.5 border-t border-border/60 pt-2">
											<button
												type="button"
												onclick={() => (msg.showTools = !msg.showTools)}
												class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
											>
												<Wrench class="size-3.5" />
												<span>
													{msg.toolsExecuted.length} tool(s) MCP ejecutadas ({msg.toolsExecuted
														.map((t) => t.name)
														.join(', ')})
												</span>
												{#if msg.showTools}
													<ChevronUp class="size-3.5" />
												{:else}
													<ChevronDown class="size-3.5" />
												{/if}
											</button>

											{#if msg.showTools}
												<div class="mt-2 space-y-2">
													{#each msg.toolsExecuted as t, idx (idx)}
														<pre
															class="max-h-40 overflow-auto rounded-lg bg-muted p-2 font-mono text-[11px] text-foreground">{JSON.stringify(
																{ tool: t.name, args: t.args },
																null,
																2
															)}</pre>
													{/each}
												</div>
											{/if}
										</div>
									{/if}
								</div>
							</div>
						{/each}

						{#if isThinking}
							<div class="flex items-center gap-2 text-xs text-muted-foreground">
								<RefreshCw class="size-3.5 animate-spin" />
								<span>Analizando schemas de Zod y actualizando el borrador...</span>
							</div>
						{/if}
					</div>

					<!-- Sugerencias rápidas y barra de envío -->
					<div class="shrink-0 border-t border-border bg-background p-3">
						<div class="mb-2 flex flex-wrap gap-1.5">
							<button
								type="button"
								onclick={() =>
									handleSendMessage(
										'Quiero empezar con pastelería: agregá al borrador harina, azúcar, huevos y esencia de vainilla'
									)}
								class="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
							>
								🥐 Cargar harina, azúcar, huevos y vainilla
							</button>
							<button
								type="button"
								onclick={() =>
									handleSendMessage('¿Qué datos faltan completar en el borrador actual?')}
								class="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
							>
								❓ ¿Qué falta completar?
							</button>
							<button
								type="button"
								onclick={() =>
									handleSendMessage(
										'Agregá la elaboración Bizcochuelo de Vainilla que lleva 250g de harina, 200g de azúcar, 4 huevos y 10ml de esencia de vainilla'
									)}
								class="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
							>
								🎂 Agregar receta Bizcochuelo
							</button>
						</div>

						<form
							onsubmit={(e) => {
								e.preventDefault();
								handleSendMessage();
							}}
							class="flex items-center gap-2"
						>
							<Input
								bind:value={inputText}
								placeholder="Escribe insumos, costos, recetas o pedidos para armar en el borrador..."
								disabled={isThinking}
								class="flex-1"
							/>
							<Button type="submit" disabled={isThinking || !inputText.trim()} class="gap-1.5">
								<Send class="size-4" />
								<span>Enviar</span>
							</Button>
						</form>
					</div>
				</Card>
			</div>

			<!-- Columna Derecha: Vista en Vivo del Borrador (JSONB) -->
			<div class="flex flex-col lg:col-span-5">
				<Card class="flex h-[calc(100vh-13rem)] flex-col overflow-hidden">
					<CardHeader class="shrink-0 border-b border-border bg-muted/30 py-3">
						<div class="flex items-center justify-between gap-2">
							<div class="flex items-center gap-2">
								<Layers class="size-4 text-primary" />
								<div>
									<CardTitle class="text-sm font-semibold">
										Borrador Activo ({draftSummary.totalEntries})
									</CardTitle>
									<p class="text-xs text-muted-foreground">
										{draftSummary.validEntriesCount} completas • {draftSummary.invalidEntriesCount} con
										campos pendientes
									</p>
								</div>
							</div>

							<div class="flex items-center gap-1.5">
								<Button
									variant="ghost"
									size="sm"
									onclick={() => (showRawJson = !showRawJson)}
									class="h-8 gap-1 px-2 text-xs"
								>
									<FileJson class="size-3.5" />
									<span>{showRawJson ? 'Tarjetas' : 'JSONB'}</span>
								</Button>
								{#if draftSummary.totalEntries > 0}
									<Button
										variant="ghost"
										size="sm"
										onclick={handleClearDraft}
										disabled={isMutatingDraft}
										class="h-8 px-2 text-xs text-destructive hover:text-destructive"
									>
										<Trash2 class="size-3.5" />
									</Button>
								{/if}
							</div>
						</div>
					</CardHeader>

					<!-- Contenido del Borrador -->
					<div class="flex-1 space-y-3 overflow-y-auto p-4">
						{#if draftSummary.totalEntries === 0}
							<div
								class="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground"
							>
								<Bot class="mb-2 size-8 opacity-40" />
								<p class="text-sm font-medium text-foreground">El borrador está vacío</p>
								<p class="mt-1 text-xs">
									Pídele al asistente por chat (o desde un agente MCP externo) que agregue insumos,
									recetas o pedidos.
								</p>
							</div>
						{:else if showRawJson}
							<pre
								class="overflow-auto rounded-xl border border-border bg-muted/50 p-3 font-mono text-xs text-foreground">{JSON.stringify(
									draftSummary.draft.payload,
									null,
									2
								)}</pre>
						{:else}
							{#each draftSummary.draft.payload.entries as entry (entry.entryId)}
								<div
									class="rounded-xl border p-3 transition {entry.isValid
										? 'border-emerald-500/40 bg-emerald-500/5'
										: 'border-amber-500/50 bg-amber-500/5'}"
								>
									<div class="flex items-start justify-between gap-2">
										<div class="space-y-1">
											<div class="flex flex-wrap items-center gap-1.5">
												{#if entry.isValid}
													<CheckCircle2 class="size-4 text-emerald-600 dark:text-emerald-400" />
												{:else}
													<AlertCircle class="size-4 text-amber-600 dark:text-amber-400" />
												{/if}
												<span class="text-sm font-semibold text-foreground">
													{entry.data?.name || entry.data?.customerName || entry.entryId}
												</span>
												<Badge variant="outline" class="text-[10px]">
													{DRAFT_ACTION_LABELS[entry.action]} • {DRAFT_ENTITY_LABELS[
														entry.entityType
													]}
												</Badge>
											</div>
											<p class="font-mono text-[11px] text-muted-foreground">
												ID en borrador: {entry.entryId}
											</p>
										</div>

										<button
											type="button"
											onclick={() => handleRemoveEntry(entry.entryId)}
											class="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
											title="Quitar del borrador"
										>
											<Trash2 class="size-3.5" />
										</button>
									</div>

									<!-- Datos cargados hasta el momento -->
									<div class="mt-2 flex flex-wrap gap-1.5">
										{#each Object.entries(entry.data || {}) as [k, v] (k)}
											{#if v !== undefined && v !== null && v !== ''}
												<span
													class="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[11px]"
												>
													<strong class="text-muted-foreground">{k}:</strong>
													{typeof v === 'object' ? JSON.stringify(v) : String(v)}
												</span>
											{/if}
										{/each}
									</div>

									<!-- Campos faltantes inferidos desde el Schema de Zod -->
									{#if !entry.isValid && entry.missingOrInvalidFields.length > 0}
										<div
											class="mt-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs"
										>
											<p class="font-semibold text-amber-800 dark:text-amber-300">
												Falta definir (según schema de Zod):
											</p>
											<ul class="mt-1 list-inside list-disc space-y-0.5 text-[11px]">
												{#each entry.missingOrInvalidFields as issue (issue.field)}
													<li>
														<code class="font-bold">{issue.field}</code>: {issue.message}
														{#if issue.description}
															<span class="text-muted-foreground">
																— {issue.description}
															</span>
														{/if}
													</li>
												{/each}
											</ul>
										</div>
									{/if}
								</div>
							{/each}
						{/if}
					</div>

					<!-- Pie del Borrador: Botón de Confirmación -->
					<div class="shrink-0 border-t border-border bg-background p-3">
						<Button
							onclick={handleCommitDraft}
							disabled={!draftSummary.readyToCommit || isMutatingDraft}
							class="w-full gap-2"
						>
							<CheckCircle2 class="size-4" />
							<span>
								{draftSummary.readyToCommit
									? `Confirmar e Impactar Borrador (${draftSummary.totalEntries})`
									: draftSummary.totalEntries === 0
										? 'Agrega datos al borrador para confirmar'
										: `Completa los ${draftSummary.invalidEntriesCount} ítem(s) pendientes para confirmar`}
							</span>
						</Button>
					</div>
				</Card>
			</div>
		</div>
	</div>
</AppShell>
