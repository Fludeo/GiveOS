<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import {
		createDefaultWeeklySchedule,
		parseWeeklySchedule,
		type DaySchedule,
		type OperationalCostResource,
		type OperationalCostType
	} from '#lib/features/businesses/domain/business.entity';
	import { v7 as uuidv7 } from 'uuid';
	import Clock from '@lucide/svelte/icons/clock';
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
	import { toast } from '#lib/components/ui/toast/toast.svelte';

	let { data }: PageProps = $props();

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
	description="Administra la identidad, WhatsApp y bloques horarios por día de tu negocio"
>
	<div class="max-w-4xl">
		<Card>
			<CardHeader class="space-y-2 p-6 sm:p-8 sm:pb-4">
				<CardTitle class="text-xl">Datos Generales y Horarios de Atención</CardTitle>
				<CardDescription>
					Actualiza la información pública y los bloques de atención de {data.activeBusiness.name}.
				</CardDescription>
			</CardHeader>

			<CardContent class="p-6 pt-2 sm:p-8 sm:pt-4">
				<form method="POST" action="?/updateBusiness" use:enhance class="space-y-8">
					<input type="hidden" name="businessId" value={data.activeBusiness.id} />
					<input type="hidden" name="openingHours" value={serializedOpeningHours} />
					<input type="hidden" name="settings" value={serializedSettings} />

					<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
						<div class="space-y-2.5">
							<Label for="set-name">Nombre del negocio</Label>
							<Input
								id="set-name"
								name="name"
								value={data.activeBusiness.name}
								class="h-10"
								required
							/>
						</div>

						<div class="space-y-2.5">
							<Label for="set-whatsapp">WhatsApp de contacto</Label>
							<Input
								id="set-whatsapp"
								name="whatsapp"
								value={data.activeBusiness.whatsapp}
								class="h-10"
								required
							/>
						</div>

						<div class="space-y-2.5 sm:col-span-2">
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

					<!-- Recursos y Tarifas Operativas (Mano de Obra y Servicios) -->
					<div class="space-y-4 rounded-xl border border-border bg-card/40 p-4 sm:p-5">
						<div class="flex flex-wrap items-center justify-between gap-3">
							<div class="space-y-0.5">
								<h3 class="text-base font-semibold text-foreground flex items-center gap-2">
									<Clock class="size-4 text-primary" />
									<span>Costos y Tarifas Operativas</span>
								</h3>
								<p class="text-xs text-muted-foreground">
									Define recursos como mano de obra, gas o electricidad para valorizar tiempos de recetas y pedidos automáticamente.
								</p>
							</div>
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
									<div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center rounded-lg border border-border bg-background p-3">
										<div class="sm:col-span-5 space-y-1">
											<Label class="text-xs text-muted-foreground">Nombre del recurso</Label>
											<Input
												bind:value={cost.name}
												placeholder="Ej: Mano de Obra, Gas Horno, Luz"
												class="h-9 text-sm"
												required
											/>
										</div>
										<div class="sm:col-span-3 space-y-1">
											<Label class="text-xs text-muted-foreground">Naturaleza del tiempo</Label>
											<select
												bind:value={cost.type}
												class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
													class="h-9 pl-7 text-sm"
													required
												/>
											</div>
										</div>
										<div class="sm:col-span-1 flex justify-end pt-5 sm:pt-4">
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

					<!-- Bloques Horarios por Día -->
					<div class="space-y-4">
						<div class="flex flex-wrap items-center justify-between gap-3">
							<div>
								<h3 class="text-base font-semibold text-foreground">
									Horarios de atención por bloque y día
								</h3>
								<p class="text-xs text-muted-foreground">
									Configura uno o más bloques horarios para cada día de la semana.
								</p>
							</div>
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
								<div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
									<div class="flex items-center justify-between gap-3 sm:w-44 sm:justify-start sm:pt-1.5">
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

									{#if dayItem.enabled}
										<div class="flex flex-1 flex-col gap-2.5">
											{#each dayItem.blocks as block, blockIdx (blockIdx)}
												<div class="flex flex-wrap items-center gap-2">
													<input
														type="time"
														aria-label="{dayItem.label} bloque {blockIdx + 1} apertura"
														bind:value={block.open}
														class="flex h-9 rounded-md border border-input bg-background px-3 py-1 font-mono text-xs shadow-xs"
													/>
													<span class="text-xs text-muted-foreground">a</span>
													<input
														type="time"
														aria-label="{dayItem.label} bloque {blockIdx + 1} cierre"
														bind:value={block.close}
														class="flex h-9 rounded-md border border-input bg-background px-3 py-1 font-mono text-xs shadow-xs"
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
										<div class="flex flex-1 items-center justify-between pt-1">
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

					<div class="flex justify-end border-t border-border pt-6">
						<Button type="submit">
							<Check class="size-4" />
							<span>Guardar Configuración</span>
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>

		<!-- Acceso al Sistema de Diseño UI -->
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
	</div>
</AppShell>
