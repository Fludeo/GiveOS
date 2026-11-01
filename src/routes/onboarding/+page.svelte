<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
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

	let { data, form: actionForm }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, message } = superForm(data.form, {
		onSubmit: ({ cancel }) => {
			const validationErr = validateWeeklySchedule(weeklySchedule);
			if (validationErr) {
				stepError = validationErr;
				cancel();
				return;
			}
			$form.openingHours = serializedOpeningHours;
		}
	});

	let currentStep = $state<1 | 2 | 3>(1);
	let stepError = $state<string | null>(null);

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
			if (!$form.name.trim()) {
				stepError = 'Por favor ingresa un nombre para el negocio.';
				return;
			}
			currentStep = 2;
			return;
		}

		if (currentStep === 2) {
			currentStep = 3;
			return;
		}
	}

	function prevStep() {
		stepError = null;
		if (currentStep > 1) {
			currentStep = (currentStep - 1) as 1 | 2;
		}
	}

	const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
</script>

<svelte:head>
	<title>Configuración Inicial — GiveOS</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-muted/20 px-6 py-12">
	<div class="w-full max-w-2xl space-y-8">
		<!-- Encabezado con Pasos -->
		<div class="flex flex-col items-center space-y-4 text-center">
			<div class="flex size-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground shadow-sm">
				<ScanFace class="size-6" />
			</div>
			<div class="space-y-1">
				<h1 class="text-2xl font-bold tracking-tight">Bienvenido a GiveOS</h1>
				<p class="text-sm text-muted-foreground">
					Configura tu primer negocio en 3 sencillos pasos
				</p>
			</div>

			<!-- Indicador de Progreso del Asistente -->
			<div class="flex w-full max-w-md items-center justify-between pt-2">
				{#each Array(TOTAL_STEPS) as _, idx}
					{@const stepNum = idx + 1}
					<div class="flex flex-1 items-center">
						<div class="flex flex-col items-center gap-1.5 flex-1">
							<div
								class="flex size-8 items-center justify-center rounded-full text-xs font-bold transition-colors {currentStep === stepNum
									? 'bg-secondary text-secondary-foreground shadow-xs'
									: currentStep > stepNum
										? 'bg-primary text-primary-foreground'
										: 'bg-muted text-muted-foreground'}"
							>
								{#if currentStep > stepNum}
									<Check class="size-4" />
								{:else}
									{stepNum}
								{/if}
							</div>
							<span class="text-[11px] font-medium {currentStep === stepNum ? 'text-foreground font-semibold' : 'text-muted-foreground'}">
								{#if stepNum === 1}
									Identidad
								{:else if stepNum === 2}
									Contacto
								{:else}
									Horarios
								{/if}
							</span>
						</div>
						{#if idx < TOTAL_STEPS - 1}
							<div class="h-0.5 flex-1 bg-border -mt-4 transition-colors {currentStep > stepNum ? 'bg-primary' : ''}"></div>
						{/if}
					</div>
				{/each}
			</div>
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
				{#if stepError || $message || (actionForm && typeof actionForm === 'object' && 'error' in actionForm ? (actionForm as any).error : null)}
					<div class="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3.5 text-sm text-destructive">
						{stepError ?? $message ?? (actionForm && typeof actionForm === 'object' && 'error' in actionForm ? (actionForm as any).error : null)}
					</div>
				{/if}

				<form
					method="POST"
					use:enhance
					class="space-y-6"
				>
					<input type="hidden" name="openingHours" value={serializedOpeningHours} />

					{#if currentStep === 1}
						<div class="space-y-5">
							<div class="space-y-2.5">
								<Label for="step-name">Nombre del negocio o sucursal</Label>
								<Input
									id="step-name"
									name="name"
									type="text"
									placeholder="Ej. Atelier Dulce — Sucursal Centro"
									bind:value={$form.name}
									class="h-10"
									autofocus
								/>
								{#if $errors.name}
									<p class="text-xs text-destructive">{$errors.name}</p>
								{/if}
							</div>

							<div class="space-y-2.5">
								<Label for="step-desc">Descripción o especialidad (opcional)</Label>
								<Input
									id="step-desc"
									name="description"
									type="text"
									placeholder="Ej. Tartas de autor, pastelería fina y catering para eventos"
									bind:value={$form.description}
									class="h-10"
								/>
							</div>
						</div>
					{:else if currentStep === 2}
						<div class="space-y-5">
							<div class="space-y-2.5">
								<Label for="step-wa">Número de WhatsApp (con código de país)</Label>
								<Input
									id="step-wa"
									name="whatsapp"
									type="tel"
									placeholder="+54 9 11 1234-5678"
									bind:value={$form.whatsapp}
									class="h-10"
									autofocus
								/>
								<p class="text-xs text-muted-foreground">
									Se utilizará para vincular el bot de respuestas automáticas y mensajes a clientes.
								</p>
							</div>
						</div>
					{:else}
						<div class="space-y-5">
							<div class="divide-y divide-border rounded-xl border border-border bg-card">
								{#each weeklySchedule as dayItem, dayIdx}
									<div class="flex flex-col gap-3 p-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between {dayItem.enabled ? 'bg-background/50' : 'opacity-60'}">
										<div class="flex items-center gap-3">
											<input
												type="checkbox"
												checked={dayItem.enabled}
												onchange={() => toggleDay(dayIdx)}
												class="size-4 rounded border-input text-secondary focus:ring-secondary cursor-pointer"
												id="chk-day-{dayIdx}"
											/>
											<Label for="chk-day-{dayIdx}" class="text-sm font-semibold cursor-pointer w-24">
												{DAY_LABELS[dayIdx]}
											</Label>
										</div>

										{#if dayItem.enabled}
											<div class="flex flex-1 flex-col gap-2 sm:items-end">
												{#each dayItem.blocks as block, blockIdx}
													<div class="flex flex-wrap items-center gap-2">
														<Input
															type="time"
															bind:value={block.open}
															class="h-8 w-28 text-xs font-mono"
														/>
														<span class="text-xs text-muted-foreground">a</span>
														<Input
															type="time"
															bind:value={block.close}
															class="h-8 w-28 text-xs font-mono"
														/>

														{#if dayItem.blocks.length > 1}
															<Button
																type="button"
																variant="ghost"
																size="icon"
																class="size-8 text-muted-foreground hover:text-destructive"
																onclick={() => removeBlock(dayIdx, blockIdx)}
															>
																<Trash2 class="size-3.5" />
															</Button>
														{/if}

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
									<strong class="text-foreground">Nombre:</strong> {$form.name}
								</p>
								<p class="text-muted-foreground">
									<strong class="text-foreground">WhatsApp:</strong> {$form.whatsapp || 'No especificado'}
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
							<Button type="submit" disabled={$delayed}>
								<Check class="size-4" />
								<span>{$delayed ? 'Guardando negocio...' : 'Finalizar y abrir el sistema'}</span>
							</Button>
						{/if}
					</div>
				</form>
			</CardContent>
		</Card>
	</div>
</div>
