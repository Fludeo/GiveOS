<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import {
		createDefaultWeeklySchedule,
		formatWeeklyScheduleSummary,
		validateWeeklySchedule,
		type DaySchedule
	} from '#lib/features/businesses/domain/business.entity';
	import { Button } from '#lib/components/ui/button';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import { Badge } from '#lib/components/ui/badge';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card';
	import ScanFace from '@lucide/svelte/icons/scan-face';
	import Check from '@lucide/svelte/icons/check';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Copy from '@lucide/svelte/icons/copy';

	let { data, form }: PageProps = $props();

	let currentStep = $state<1 | 2 | 3>(1);
	let loading = $state(false);
	let stepError = $state<string | null>(null);

	let name = $state('');
	let description = $state('');
	let whatsapp = $state('');
	let weeklySchedule = $state<DaySchedule[]>(createDefaultWeeklySchedule());

	const serializedOpeningHours = $derived(JSON.stringify(weeklySchedule));
	const schedulePreview = $derived(formatWeeklyScheduleSummary(serializedOpeningHours));

	const TOTAL_STEPS = 3;

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
	}

	function nextStep() {
		stepError = null;
		if (currentStep === 1) {
			if (!name.trim()) {
				stepError = 'Por favor ingresa el nombre de tu negocio.';
				return;
			}
			if (!description.trim()) {
				stepError = 'Por favor escribe una breve descripción de tu negocio.';
				return;
			}
			currentStep = 2;
		} else if (currentStep === 2) {
			if (!whatsapp.trim()) {
				stepError = 'Por favor ingresa un número de WhatsApp de contacto.';
				return;
			}
			currentStep = 3;
		}
	}

	function prevStep() {
		stepError = null;
		if (currentStep === 3) currentStep = 2;
		else if (currentStep === 2) currentStep = 1;
	}
</script>

<svelte:head>
	<title>Configurar Negocio — GiveOS</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-muted/20 px-6 py-12">
	<div class="w-full max-w-2xl space-y-8">
		<!-- Encabezado de bienvenida -->
		<div class="flex flex-col items-center space-y-3 text-center">
			<div class="flex size-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground shadow-sm">
				<ScanFace class="size-6" />
			</div>
			<div class="space-y-1.5">
				<Badge variant="secondary" class="px-3 py-0.5 text-xs">
					Paso {currentStep} de {TOTAL_STEPS}
				</Badge>
				<h1 class="text-2xl font-bold tracking-tight">
					¡Bienvenido/a, {data.user.name}!
				</h1>
				<p class="text-sm text-muted-foreground">
					Configura los datos principales de tu negocio para asociar tus insumos, recetas y costos.
				</p>
			</div>
		</div>

		<!-- Indicador de progreso paso a paso -->
		<div class="grid grid-cols-3 gap-3">
			{#each [
				{ step: 1, title: '1. Identidad' },
				{ step: 2, title: '2. WhatsApp' },
				{ step: 3, title: '3. Horarios' }
			] as item (item.step)}
				<button
					type="button"
					onclick={() => {
						if (item.step < currentStep) {
							stepError = null;
							currentStep = item.step as 1 | 2 | 3;
						}
					}}
					class="flex flex-col gap-2 rounded-xl border p-3.5 text-left transition-all {currentStep ===
					item.step
						? 'border-primary bg-primary/5 ring-1 ring-primary'
						: item.step < currentStep
							? 'cursor-pointer border-border bg-card hover:bg-muted/40'
							: 'cursor-default border-border/60 bg-muted/20 opacity-60'}"
				>
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold text-foreground">{item.title}</span>
						{#if item.step < currentStep}
							<span class="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
								<Check class="size-2.5" />
							</span>
						{/if}
					</div>
					<div
						class="h-1.5 w-full rounded-full {item.step <= currentStep
							? 'bg-primary'
							: 'bg-muted'}"
					></div>
				</button>
			{/each}
		</div>

		<!-- Tarjeta del Wizard -->
		<Card>
			<CardHeader class="space-y-2 p-6 sm:p-8 sm:pb-4">
				{#if currentStep === 1}
					<CardTitle class="text-xl">Nombre y descripción del negocio</CardTitle>
					<CardDescription>
						Cuéntanos cómo se llama tu pastelería o taller y qué tipo de productos elaboras.
					</CardDescription>
				{:else if currentStep === 2}
					<CardTitle class="text-xl">Contacto por WhatsApp</CardTitle>
					<CardDescription>
						Indica el número de WhatsApp principal de atención o toma de pedidos de este negocio.
					</CardDescription>
				{:else}
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div class="space-y-1.5">
							<CardTitle class="text-xl">Horarios de atención por día y bloque</CardTitle>
							<CardDescription>
								Habilita los días de atención y agrega uno o más bloques horarios por día (ej. turno mañana y tarde).
							</CardDescription>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={copyMondayToWeekdays}
							title="Copiar los bloques del Lunes de Martes a Viernes"
						>
							<Copy class="size-3.5" />
							<span>Copiar Lunes a Lun–Vie</span>
						</Button>
					</div>
				{/if}
			</CardHeader>

			<CardContent class="p-6 pt-2 sm:p-8 sm:pt-4">
				{#if stepError || form?.error}
					<div class="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3.5 text-sm text-destructive">
						{stepError ?? form?.error}
					</div>
				{/if}

				<form
					method="POST"
					use:enhance={({ cancel }) => {
						const validationErr = validateWeeklySchedule(weeklySchedule);
						if (validationErr) {
							stepError = validationErr;
							cancel();
							return;
						}
						loading = true;
						return async ({ update }) => {
							await update();
							loading = false;
						};
					}}
					class="space-y-6"
				>
					<!-- Inputs ocultos para que todos los pasos viajen en el submit final -->
					<input type="hidden" name="name" value={name} />
					<input type="hidden" name="description" value={description} />
					<input type="hidden" name="whatsapp" value={whatsapp} />
					<input type="hidden" name="openingHours" value={serializedOpeningHours} />

					{#if currentStep === 1}
						<div class="space-y-5">
							<div class="space-y-2.5">
								<Label for="step-name">Nombre del negocio o sucursal</Label>
								<Input
									id="step-name"
									type="text"
									placeholder="Ej. Atelier Dulce — Sucursal Centro"
									bind:value={name}
									class="h-10"
									autofocus
								/>
							</div>

							<div class="space-y-2.5">
								<Label for="step-description">Descripción</Label>
								<textarea
									id="step-description"
									rows={4}
									placeholder="Ej. Pastelería artesanal especializada en tortas de eventos, mesas dulces y laminados."
									bind:value={description}
									class="flex w-full rounded-md border border-input bg-transparent px-3 py-2.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
								></textarea>
							</div>
						</div>
					{:else if currentStep === 2}
						<div class="space-y-5">
							<div class="space-y-2.5">
								<Label for="step-whatsapp">Número de WhatsApp</Label>
								<Input
									id="step-whatsapp"
									type="tel"
									placeholder="Ej. +54 9 11 2345-6789"
									bind:value={whatsapp}
									class="h-10"
									autofocus
								/>
								<p class="text-xs text-muted-foreground">
									Incluye el código de país y área para identificar fácilmente la sucursal.
								</p>
							</div>

							<div class="rounded-xl border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
								<strong class="font-semibold text-foreground">Negocio:</strong> {name}
								<p class="mt-1">{description}</p>
							</div>
						</div>
					{:else}
						<div class="space-y-4">
							<!-- Configurador por día y por bloques -->
							<div class="divide-y divide-border rounded-xl border border-border bg-background">
								{#each weeklySchedule as dayItem, dayIdx (dayItem.day)}
									<div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
										<!-- Día + Switch Abierto/Cerrado -->
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
											{#if !dayItem.enabled}
												<Badge variant="outline" class="ml-auto text-[11px] text-muted-foreground sm:hidden">
													Cerrado
												</Badge>
											{/if}
										</div>

										<!-- Bloques horarios del día -->
										{#if dayItem.enabled}
											<div class="flex flex-1 flex-col gap-2.5">
												{#each dayItem.blocks as block, blockIdx (blockIdx)}
													<div class="flex flex-wrap items-center gap-2">
														<input
															type="time"
															aria-label="{dayItem.label} bloque {blockIdx + 1} apertura"
															bind:value={block.open}
															class="flex h-9 rounded-md border border-input bg-background px-3 py-1 font-mono text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
														/>
														<span class="text-xs text-muted-foreground">a</span>
														<input
															type="time"
															aria-label="{dayItem.label} bloque {blockIdx + 1} cierre"
															bind:value={block.close}
															class="flex h-9 rounded-md border border-input bg-background px-3 py-1 font-mono text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
														/>

														<Button
															type="button"
															variant="ghost"
															size="icon"
															class="size-8 text-muted-foreground hover:text-destructive"
															title={dayItem.blocks.length > 1
																? 'Eliminar este bloque horario'
																: 'Marcar día como cerrado'}
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
											<div class="hidden flex-1 items-center justify-between pt-1 sm:flex">
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

							<!-- Resumen final antes de guardar -->
							<div class="space-y-1.5 rounded-xl border border-border bg-muted/20 p-4 text-xs">
								<p class="font-semibold text-foreground">Resumen del negocio a crear:</p>
								<p class="text-muted-foreground">
									<strong class="text-foreground">Nombre:</strong> {name}
								</p>
								<p class="text-muted-foreground">
									<strong class="text-foreground">WhatsApp:</strong> {whatsapp}
								</p>
								<p class="text-muted-foreground">
									<strong class="text-foreground">Horarios:</strong> {schedulePreview}
								</p>
							</div>
						</div>
					{/if}

					<!-- Botones de navegación del Wizard -->
					<div class="flex items-center justify-between border-t border-border pt-6">
						{#if currentStep > 1}
							<Button type="button" variant="outline" onclick={prevStep}>
								<ArrowLeft class="size-4" />
								<span>Anterior</span>
							</Button>
						{:else}
							<div></div>
						{/if}

						{#if currentStep < 3}
							<Button type="button" onclick={nextStep}>
								<span>Siguiente paso</span>
								<ArrowRight class="size-4" />
							</Button>
						{:else}
							<Button type="submit" disabled={loading}>
								<Check class="size-4" />
								<span>{loading ? 'Guardando negocio...' : 'Finalizar y abrir el sistema'}</span>
							</Button>
						{/if}
					</div>
				</form>
			</CardContent>
		</Card>
	</div>
</div>
