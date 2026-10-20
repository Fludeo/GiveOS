<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import {
		createDefaultWeeklySchedule,
		parseWeeklySchedule,
		type DaySchedule
	} from '#lib/features/businesses/domain/business.entity';
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
	import { toast } from '#lib/components/ui/toast/toast.svelte';

	let { data }: PageProps = $props();

	let weeklySchedule = $state<DaySchedule[]>(createDefaultWeeklySchedule());

	// Sincronizar horario cuando cambia el negocio activo
	$effect(() => {
		const parsed = parseWeeklySchedule(data.activeBusiness.openingHours);
		weeklySchedule = parsed ?? createDefaultWeeklySchedule();
	});

	const serializedOpeningHours = $derived(JSON.stringify(weeklySchedule));

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
	</div>
</AppShell>
