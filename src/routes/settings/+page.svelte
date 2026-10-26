<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import {
		createDefaultWeeklySchedule,
		parseWeeklySchedule,
		type DaySchedule,
		type OperationalCostResource
	} from '#lib/features/businesses/domain/business.entity';
	import { v7 as uuidv7 } from 'uuid';
	import Clock from '@lucide/svelte/icons/clock';
	import Store from '@lucide/svelte/icons/store';
	import Coins from '@lucide/svelte/icons/coins';
	import AppShell from '#lib/components/layout/app-shell.svelte';
	import { Button } from '#lib/components/ui/button';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card';
	import Check from '@lucide/svelte/icons/check';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Copy from '@lucide/svelte/icons/copy';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import Download from '@lucide/svelte/icons/download';
	import Share from '@lucide/svelte/icons/share';
	import X from '@lucide/svelte/icons/x';
	import { pwaStore } from '#lib/pwa.svelte';
	import { toast } from '#lib/components/ui/toast/toast.svelte';

	let { data }: PageProps = $props();

	let currentTab = $state<'general' | 'costs' | 'schedule'>('general');
	let weeklySchedule = $state<DaySchedule[]>(createDefaultWeeklySchedule());

	// Sincronizar horario cuando cambia el negocio activo
	$effect(() => {
		const parsed = parseWeeklySchedule(data.activeBusiness.openingHours);
		weeklySchedule = parsed ?? createDefaultWeeklySchedule();
	});

	const serializedOpeningHours = $derived(JSON.stringify(weeklySchedule));
	let operationalCosts = $state<OperationalCostResource[]>([]);

	$effect(() => {
		const saved = data.activeBusiness.settings?.operationalCosts;
		if (Array.isArray(saved) && saved.length > 0) {
			operationalCosts = JSON.parse(JSON.stringify(saved));
		} else {
			operationalCosts = [
				{ id: 'labor_default', name: 'Mano de Obra (Pastelería)', type: 'active', ratePerHour: 50 },
				{ id: 'gas_default', name: 'Gas / Horno Principal', type: 'passive', ratePerHour: 15 }
			];
		}
	});

	function addOperationalCost() {
		operationalCosts.push({
			id: uuidv7(),
			name: '',
			type: 'active',
			ratePerHour: 0
		});
	}

	function removeOperationalCost(index: number) {
		operationalCosts = operationalCosts.filter((_, i) => i !== index);
	}

	const serializedSettings = $derived(
		JSON.stringify({
			...data.activeBusiness.settings,
			operationalCosts
		})
	);

	function toggleDay(dayIndex: number) {
		const target = weeklySchedule[dayIndex];
		target.enabled = !target.enabled;
		if (target.enabled && target.blocks.length === 0) {
			target.blocks = [{ open: '09:00', close: '18:00' }];
		}
	}

	function addBlock(dayIndex: number) {
		const target = weeklySchedule[dayIndex];
		const lastBlock = target.blocks[target.blocks.length - 1];
		const defaultOpen = lastBlock ? '16:00' : '09:00';
		const defaultClose = lastBlock ? '20:00' : '13:00';
		target.blocks.push({ open: defaultOpen, close: defaultClose });
	}

	function removeBlock(dayIndex: number, blockIndex: number) {
		const target = weeklySchedule[dayIndex];
		if (target.blocks.length <= 1) {
			target.enabled = false;
			return;
		}
		target.blocks.splice(blockIndex, 1);
	}

	function copyMondayToWeekdays() {
		const monday = weeklySchedule[0];
		for (let i = 1; i <= 4; i++) {
			weeklySchedule[i].enabled = monday.enabled;
			weeklySchedule[i].blocks = monday.blocks.map((b) => ({
				open: b.open,
				close: b.close
			}));
		}
		toast.info(
			'Horarios replicados',
			'Se copiaron los bloques del Lunes a Martes, Miércoles, Jueves y Viernes. Recuerda guardar la configuración.'
		);
	}
</script>

<svelte:head>
	<title>Configuración — {data.activeBusiness.name}</title>
</svelte:head>

<AppShell
	user={data.user}
	activeBusiness={data.activeBusiness}
	businesses={data.businesses}
	currentSection="settings"
	title="Configuración del Negocio"
	description="Administra la identidad, costos operativos y bloques horarios por día de tu negocio"
>
	<div class="max-w-4xl space-y-6">
		<!-- Barra de Pestañas Unificada de Configuración (Segmented Control 3 columnas en mobile) -->
		<div class="sticky top-2 z-20 grid grid-cols-3 gap-1 rounded-2xl border border-border bg-card/95 p-1.5 shadow-xs backdrop-blur-md sm:inline-flex sm:w-auto sm:gap-1.5">
			<button
				type="button"
				onclick={() => (currentTab = 'general')}
				class="inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs sm:px-3.5 sm:text-sm font-medium transition-colors cursor-pointer {currentTab ===
				'general'
					? 'bg-primary text-primary-foreground shadow-xs font-semibold'
					: 'text-muted-foreground hover:text-foreground'}"
			>
				<Store class="size-3.5 sm:size-4 shrink-0" />
				<span class="truncate sm:hidden">General</span>
				<span class="hidden sm:inline">Datos Generales</span>
			</button>

			<button
				type="button"
				onclick={() => (currentTab = 'costs')}
				class="inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs sm:px-3.5 sm:text-sm font-medium transition-colors cursor-pointer {currentTab ===
				'costs'
					? 'bg-primary text-primary-foreground shadow-xs font-semibold'
					: 'text-muted-foreground hover:text-foreground'}"
			>
				<Coins class="size-3.5 sm:size-4 shrink-0" />
				<span class="truncate sm:hidden">Costos</span>
				<span class="hidden sm:inline">Costos Operativos</span>
			</button>

			<button
				type="button"
				onclick={() => (currentTab = 'schedule')}
				class="inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs sm:px-3.5 sm:text-sm font-medium transition-colors cursor-pointer {currentTab ===
				'schedule'
					? 'bg-primary text-primary-foreground shadow-xs font-semibold'
					: 'text-muted-foreground hover:text-foreground'}"
			>
				<Clock class="size-3.5 sm:size-4 shrink-0" />
				<span class="truncate sm:hidden">Horarios</span>
				<span class="hidden sm:inline">Horarios de Atención</span>
			</button>
		</div>

		<Card>
			<CardHeader class="space-y-1.5 p-5 sm:p-8 sm:pb-4">
				<CardTitle class="text-lg sm:text-xl">
					{#if currentTab === 'general'}
						Datos Generales del Negocio
					{:else if currentTab === 'costs'}
						Costos y Tarifas Operativas
					{:else}
						Horarios de Atención por Día
					{/if}
				</CardTitle>
				<CardDescription>
					{#if currentTab === 'general'}
						Actualiza la información pública, WhatsApp y descripción de {data.activeBusiness.name}.
					{:else if currentTab === 'costs'}
						Define recursos como mano de obra, gas o electricidad para valorizar tiempos de recetas automáticamente.
					{:else}
						Configura uno o más bloques horarios de apertura y cierre para cada día de la semana.
					{/if}
				</CardDescription>
			</CardHeader>

			<CardContent class="p-5 pt-2 sm:p-8 sm:pt-4">
				<form method="POST" action="?/updateBusiness" use:enhance class="space-y-6">
					<input type="hidden" name="businessId" value={data.activeBusiness.id} />
					<input type="hidden" name="openingHours" value={serializedOpeningHours} />
					<input type="hidden" name="settings" value={serializedSettings} />

					<!-- PESTAÑA 1: DATOS GENERALES -->
					<div class={currentTab === 'general' ? 'grid grid-cols-1 gap-5 sm:grid-cols-2' : 'hidden'}>
						<div class="space-y-2">
							<Label for="set-name">Nombre del negocio</Label>
							<Input
								id="set-name"
								name="name"
								value={data.activeBusiness.name}
								class="h-10"
								required
							/>
						</div>

						<div class="space-y-2">
							<Label for="set-whatsapp">WhatsApp de contacto</Label>
							<Input
								id="set-whatsapp"
								name="whatsapp"
								value={data.activeBusiness.whatsapp}
								class="h-10"
								required
							/>
						</div>

						<div class="space-y-2 sm:col-span-2">
							<Label for="set-description">Descripción</Label>
							<textarea
								id="set-description"
								name="description"
								rows={3}
								required
								class="flex w-full rounded-md border border-input bg-transparent px-3 py-2.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
							>{data.activeBusiness.description}</textarea>
						</div>
					</div>

					<!-- PESTAÑA 2: COSTOS Y TARIFAS OPERATIVAS -->
					<div class={currentTab === 'costs' ? 'space-y-4' : 'hidden'}>
						<div class="flex flex-wrap items-center justify-between gap-3">
							<p class="text-xs text-muted-foreground">
								Recursos activos (mano de obra) y pasivos (horno/máquina) utilizados en tus elaboraciones.
							</p>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onclick={addOperationalCost}
								class="gap-1.5"
							>
								<Plus class="size-3.5" />
								<span>Agregar Recurso</span>
							</Button>
						</div>

						{#if operationalCosts.length === 0}
							<div class="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
								No hay recursos ni tarifas configuradas. Agrega tarifas de mano de obra o gas para costear tiempos de producción.
							</div>
						{:else}
							<div class="space-y-2.5">
								{#each operationalCosts as cost, idx (cost.id || idx)}
									<div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center rounded-xl border border-border bg-muted/20 p-3">
										<div class="sm:col-span-5 space-y-1">
											<Label class="text-xs text-muted-foreground">Nombre del recurso</Label>
											<Input
												bind:value={cost.name}
												placeholder="Ej: Mano de Obra, Gas Horno, Luz"
												class="h-9 text-sm bg-background"
												required
											/>
										</div>
										<div class="sm:col-span-3 space-y-1">
											<Label class="text-xs text-muted-foreground">Naturaleza del tiempo</Label>
											<select
												bind:value={cost.type}
												class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
											>
												<option value="active">Activo (Mano de obra)</option>
												<option value="passive">Pasivo (Horno / Máquina)</option>
											</select>
										</div>
										<div class="sm:col-span-3 space-y-1">
											<Label class="text-xs text-muted-foreground">Tarifa ($ por hora)</Label>
											<div class="relative">
												<span class="absolute left-3 top-2 text-xs text-muted-foreground">$</span>
												<Input
													type="number"
													step="0.01"
													min="0"
													bind:value={cost.ratePerHour}
													class="h-9 pl-7 text-sm bg-background"
													required
												/>
											</div>
										</div>
										<div class="sm:col-span-1 flex justify-end pt-2 sm:pt-4">
											<Button
												type="button"
												variant="ghost"
												size="icon"
												class="text-destructive hover:bg-destructive/10"
												onclick={() => removeOperationalCost(idx)}
												aria-label="Eliminar tarifa"
											>
												<Trash2 class="size-4" />
											</Button>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<!-- PESTAÑA 3: BLOQUES HORARIOS POR DÍA -->
					<div class={currentTab === 'schedule' ? 'space-y-4' : 'hidden'}>
						<div class="flex flex-wrap items-center justify-between gap-3">
							<p class="text-xs text-muted-foreground">
								Habilita los días de atención y define tus turnos de apertura y cierre.
							</p>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onclick={copyMondayToWeekdays}
							>
								<Copy class="size-3.5" />
								<span>Copiar Lunes a Lun–Vie</span>
							</Button>
						</div>

						<div class="divide-y divide-border rounded-xl border border-border bg-background">
							{#each weeklySchedule as dayItem, dayIdx (dayItem.day)}
								<div class="flex flex-col gap-3 p-3.5 sm:p-4 sm:flex-row sm:items-start sm:justify-between">
									<div class="flex items-center justify-between gap-3 sm:w-44 sm:justify-start sm:pt-1.5">
										<div class="flex items-center gap-2.5">
											<button
												type="button"
												role="switch"
												aria-label="Alternar atención el día {dayItem.label}"
												aria-checked={dayItem.enabled}
												onclick={() => toggleDay(dayIdx)}
												class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors {dayItem.enabled
													? 'bg-primary'
													: 'bg-muted-foreground/30'}"
											>
												<span
													class="inline-block size-3.5 transform rounded-full bg-background transition-transform {dayItem.enabled
														? 'translate-x-4'
														: 'translate-x-1'}"
												></span>
											</button>
											<span class="text-sm font-medium {dayItem.enabled ? 'text-foreground' : 'text-muted-foreground'}">
												{dayItem.label}
											</span>
										</div>

										{#if !dayItem.enabled}
											<span class="text-xs italic text-muted-foreground sm:hidden">Cerrado</span>
										{/if}
									</div>

									{#if dayItem.enabled}
										<div class="flex flex-1 flex-col gap-2.5">
											{#each dayItem.blocks as block, blockIdx (blockIdx)}
												<div class="flex flex-wrap items-center gap-2">
													<input
														type="time"
														aria-label="{dayItem.label} bloque {blockIdx + 1} apertura"
														bind:value={block.open}
														class="flex h-9 rounded-md border border-input bg-background px-2.5 py-1 font-mono text-xs shadow-xs"
													/>
													<span class="text-xs text-muted-foreground">a</span>
													<input
														type="time"
														aria-label="{dayItem.label} bloque {blockIdx + 1} cierre"
														bind:value={block.close}
														class="flex h-9 rounded-md border border-input bg-background px-2.5 py-1 font-mono text-xs shadow-xs"
													/>

													<Button
														type="button"
														variant="ghost"
														size="icon"
														class="size-8 text-muted-foreground hover:text-destructive"
														onclick={() => removeBlock(dayIdx, blockIdx)}
													>
														<Trash2 class="size-3.5" />
													</Button>

													{#if blockIdx === dayItem.blocks.length - 1}
														<Button
															type="button"
															variant="outline"
															size="sm"
															class="h-8 px-2.5 text-xs"
															onclick={() => addBlock(dayIdx)}
														>
															<Plus class="size-3.5" />
															<span>Bloque</span>
														</Button>
													{/if}
												</div>
											{/each}
										</div>
									{:else}
										<div class="hidden sm:flex flex-1 items-center justify-between pt-1">
											<span class="text-xs italic text-muted-foreground">Cerrado</span>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												class="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
												onclick={() => toggleDay(dayIdx)}
											>
												<Plus class="size-3" />
												<span>Habilitar día</span>
											</Button>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>

					<div class="flex justify-end border-t border-border pt-5">
						<Button type="submit" class="w-full sm:w-auto">
							<Check class="size-4" />
							<span>Guardar Configuración</span>
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>

		<!-- Instalación de Aplicación Móvil (PWA) y Acceso al Sistema de Diseño UI -->
		{#if currentTab === 'general'}
			<div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-2xs">
				<div class="flex items-start gap-3">
					<div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
						<Smartphone class="size-5" />
					</div>
					<div class="space-y-0.5">
						<div class="flex items-center gap-2">
							<h4 class="text-sm font-bold text-foreground">Aplicación Móvil y Escritorio (PWA)</h4>
							{#if pwaStore.isStandalone}
								<span class="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
									Instalada
								</span>
							{/if}
						</div>
						<p class="text-xs text-muted-foreground">
							{#if pwaStore.isStandalone}
								Estás ejecutando GiveOS como aplicación nativa a pantalla completa.
							{:else}
								Instala GiveOS en tu celular, tablet o PC para abrirla desde tu inicio a pantalla completa.
							{/if}
						</p>
					</div>
				</div>
				{#if !pwaStore.isStandalone}
					<Button
						type="button"
						variant="default"
						size="sm"
						onclick={() => pwaStore.triggerInstall()}
						class="gap-1.5 shadow-2xs w-full sm:w-auto"
					>
						<Download class="size-3.5" />
						<span>Instalar GiveOS</span>
					</Button>
				{/if}
			</div>

			<div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-border bg-card/60 p-5">
				<div class="space-y-0.5">
					<h4 class="text-sm font-bold text-foreground">Catálogo del Sistema de Diseño UI</h4>
					<p class="text-xs text-muted-foreground">
						Vista centralizada con todos los componentes disponibles, tokens de color, tablas y estados interactivos.
					</p>
				</div>
				<Button variant="outline" size="sm" href="/ui-design" class="gap-1.5 shadow-2xs">
					<span>Explorar /ui-design</span>
					<ExternalLink class="size-3.5" />
				</Button>
			</div>
		{/if}
	</div>

	{#if pwaStore.showManualInstructionsModal}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
			role="dialog"
			aria-modal="true"
			aria-labelledby="pwa-modal-title"
		>
			<div class="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
				<div class="flex items-start justify-between gap-4 border-b border-border p-5">
					<div class="flex items-center gap-3">
						<div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
							<Smartphone class="size-5" />
						</div>
						<div>
							<h2 id="pwa-modal-title" class="text-base font-bold text-foreground">
								Instalar GiveOS en tu dispositivo
							</h2>
							<p class="text-xs text-muted-foreground">
								Tu navegador requiere confirmar desde su menú nativo
							</p>
						</div>
					</div>
					<Button
						type="button"
						size="icon"
						variant="ghost"
						class="size-8 text-muted-foreground hover:text-foreground"
						onclick={() => (pwaStore.showManualInstructionsModal = false)}
					>
						<X class="size-4" />
					</Button>
				</div>

				<div class="space-y-3 p-5 text-xs text-foreground">
					{#if pwaStore.isIos}
						<div class="rounded-xl border border-border bg-muted/30 p-3.5 space-y-2">
							<p class="font-bold text-sm flex items-center gap-2">
								<Share class="size-4 text-primary" />
								<span>En iPhone / iPad (Safari):</span>
							</p>
							<ol class="list-decimal pl-5 space-y-1.5 text-muted-foreground">
								<li>Toca el botón <strong class="text-foreground">Compartir</strong> en la barra de Safari.</li>
								<li>Selecciona <strong class="text-foreground">"Agregar a Inicio"</strong>.</li>
								<li>Toca <strong class="text-foreground">"Agregar"</strong> arriba a la derecha.</li>
							</ol>
						</div>
					{:else}
						<div class="rounded-xl border border-border bg-muted/30 p-3.5 space-y-2">
							<p class="font-bold text-sm flex items-center gap-2">
								<Download class="size-4 text-primary" />
								<span>En Chrome / Edge / Android:</span>
							</p>
							<ol class="list-decimal pl-5 space-y-1.5 text-muted-foreground">
								<li>Si ya está instalada, búscala en tu escritorio o cajón de apps como <strong class="text-foreground">GiveOS</strong>.</li>
								<li>O haz clic en el ícono de <strong class="text-foreground">Instalar</strong> en el extremo derecho de la barra de direcciones (o en el menú <strong class="text-foreground">⋮ → Instalar GiveOS</strong>).</li>
							</ol>
						</div>
					{/if}
				</div>

				<div class="flex justify-end border-t border-border bg-muted/20 px-5 py-3">
					<Button
						type="button"
						size="sm"
						onclick={() => (pwaStore.showManualInstructionsModal = false)}
					>
						Entendido
					</Button>
				</div>
			</div>
		</div>
	{/if}
</AppShell>
