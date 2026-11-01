<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import type { SuperValidated, Infer } from 'sveltekit-superforms';
	import type { SaveRecipeOperationalCostsSchema } from '$lib/schemas/recipe-operational-costs.schema';
	import type { Item, RecipeOperationalCost } from '#lib/features/items/domain/item.entity';
	import type { BusinessSettings, OperationalCostResource } from '#lib/features/businesses/domain/business.entity';
	import { Button } from '#lib/components/ui/button';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import X from '@lucide/svelte/icons/x';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import ChefHat from '@lucide/svelte/icons/chef-hat';
	import Flame from '@lucide/svelte/icons/flame';
	import Coins from '@lucide/svelte/icons/coins';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Settings from '@lucide/svelte/icons/settings';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';

	interface Props {
		open: boolean;
		formData: SuperValidated<Infer<SaveRecipeOperationalCostsSchema>>;
		item: Item | null;
		businessSettings?: BusinessSettings | null;
		businessId: string;
		onClose: () => void;
	}

	let {
		open = $bindable(),
		formData,
		item,
		businessSettings,
		businessId,
		onClose
	}: Props = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, message, reset } = superForm(formData, {
		dataType: 'json',
		resetForm: false,
		onResult: ({ result }) => {
			if (result.type === 'success') {
				handleClose();
			}
		}
	});

	const availableBusinessResources = $derived<OperationalCostResource[]>(
		businessSettings?.operationalCosts ?? []
	);

	$effect(() => {
		if (open && item) {
			$form.businessId = businessId;
			$form.itemId = item.id;
			const existing = item.recipeConfig?.operationalCosts;
			if (existing && existing.length > 0) {
				// Sincronizar nombres y tarifas por hora directamente desde businessSettings si coinciden por resourceId o name
				$form.costs = existing.map((c) => {
					const matched = availableBusinessResources.find(
						(r) => (c.resourceId && r.id === c.resourceId) || r.name.toLowerCase() === c.name.toLowerCase()
					);
					return {
						id: c.id,
						resourceId: matched?.id ?? c.resourceId,
						name: matched?.name ?? c.name,
						type: matched?.type ?? c.type,
						durationMinutes: c.durationMinutes,
						ratePerHour: matched ? matched.ratePerHour : c.ratePerHour,
						isScalable: Boolean(c.isScalable),
						notes: c.notes ?? null
					};
				});
			} else {
				$form.costs = [];
			}
		}
	});

	function addFromCatalog(resource: OperationalCostResource) {
		$form.costs = [
			...$form.costs,
			{
				id: crypto.randomUUID(),
				resourceId: resource.id,
				name: resource.name,
				type: resource.type,
				durationMinutes: resource.type === 'active' ? 15 : 30,
				ratePerHour: resource.ratePerHour,
				isScalable: false,
				notes: null
			}
		];
	}

	function removeCost(index: number) {
		$form.costs = $form.costs.filter((_, i) => i !== index);
	}

	function handleClose() {
		open = false;
		reset();
		onClose();
	}

	// Cálculos en vivo
	const totalActiveMinutes = $derived(
		($form.costs || []).filter((c) => c.type === 'active').reduce((acc, c) => acc + (Number(c.durationMinutes) || 0), 0)
	);

	const totalPassiveMinutes = $derived(
		($form.costs || []).filter((c) => c.type === 'passive').reduce((acc, c) => acc + (Number(c.durationMinutes) || 0), 0)
	);

	const totalBatchCost = $derived.by(() => {
		if (!item) return 0;
		const yieldQty = item.yieldQuantity > 0 ? item.yieldQuantity : 1;
		return ($form.costs || []).reduce((acc, c) => {
			const dur = Number(c.durationMinutes) || 0;
			const rate = Number(c.ratePerHour) || 0;
			const batchMin = c.isScalable ? dur * yieldQty : dur;
			return acc + (batchMin / 60) * rate;
		}, 0);
	});
</script>

{#if open && item}
	<div
		class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 p-0 sm:p-4 backdrop-blur-[1px]"
		role="dialog"
		aria-modal="true"
	>
		<div class="flex max-h-[92vh] sm:max-h-[90vh] w-full max-w-full sm:max-w-2xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border-t sm:border border-border bg-card shadow-2xl">
			<!-- Header -->
			<div class="flex items-start justify-between gap-4 border-b border-border p-5 sm:p-6 pb-4">
				<div class="space-y-1">
					<div class="flex items-center gap-2">
						<span class="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold bg-muted text-muted-foreground">
							{item.code}
						</span>
						<span class="text-xs font-semibold text-secondary">Tiempos y Costos Operativos</span>
					</div>
					<h2 class="text-lg sm:text-xl font-bold text-foreground">
						{item.name}
					</h2>
					<p class="text-xs text-muted-foreground">
						Asigna los recursos y tarifas definidos en los Ajustes del Negocio para costear la mano de obra y maquinaria.
					</p>
				</div>
				<Button
					type="button"
					size="icon"
					variant="ghost"
					class="size-8 text-muted-foreground hover:text-foreground"
					onclick={handleClose}
				>
					<X class="size-4" />
				</Button>
			</div>

			<!-- Resumen superior en tiempo real -->
			<div class="grid grid-cols-3 gap-2 border-b border-border bg-muted/30 p-4 text-center">
				<div class="rounded-xl border border-border/60 bg-card p-2.5">
					<span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
						Tiempo Activo
					</span>
					<div class="flex items-center justify-center gap-1.5 text-secondary font-mono font-bold text-base mt-0.5">
						<ChefHat class="size-4" />
						<span>{totalActiveMinutes} min</span>
					</div>
				</div>

				<div class="rounded-xl border border-border/60 bg-card p-2.5">
					<span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
						Tiempo Pasivo
					</span>
					<div class="flex items-center justify-center gap-1.5 text-amber-600 dark:text-amber-400 font-mono font-bold text-base mt-0.5">
						<Flame class="size-4" />
						<span>{totalPassiveMinutes} min</span>
					</div>
				</div>

				<div class="rounded-xl border border-border/60 bg-card p-2.5">
					<span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
						Costo Operativo/Lote
					</span>
					<div class="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-base mt-0.5">
						<Coins class="size-4" />
						<span>${totalBatchCost.toFixed(2)}</span>
					</div>
				</div>
			</div>

			<!-- Mensaje de error / feedback -->
			{#if $message}
				<div class="m-5 mb-0 flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-destructive">
					<AlertTriangle class="size-4 shrink-0" />
					<p class="text-xs font-semibold">{$message}</p>
				</div>
			{/if}

			<!-- Contenido con Scroll -->
			<div class="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
				<!-- Catálogo de recursos disponibles para agregar -->
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
							<Sparkles class="size-3.5 text-secondary" />
							<span>Añadir Recursos Disponibles</span>
						</div>
						<a
							href="/settings"
							class="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
						>
							<Settings class="size-3" />
							<span>Configurar Tarifas</span>
						</a>
					</div>

					{#if availableBusinessResources.length === 0}
						<div class="rounded-xl border border-dashed border-border p-4 text-center">
							<p class="text-xs text-muted-foreground">
								No hay recursos operativos configurados en Ajustes.
							</p>
							<a
								href="/settings"
								class="text-xs font-semibold text-secondary hover:underline mt-1 inline-block"
							>
								Crear recursos en Configuración →
							</a>
						</div>
					{:else}
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
							{#each availableBusinessResources as res (res.id)}
								<button
									type="button"
									onclick={() => addFromCatalog(res)}
									class="flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:border-secondary/50 hover:bg-muted/40 transition-all text-left cursor-pointer group shadow-xs"
								>
									<div class="space-y-0.5">
										<div class="flex items-center gap-1.5">
											{#if res.type === 'active'}
												<ChefHat class="size-3.5 text-secondary" />
											{:else}
												<Flame class="size-3.5 text-amber-500" />
											{/if}
											<span class="text-xs font-bold text-foreground group-hover:text-secondary transition-colors">
												{res.name}
											</span>
										</div>
										<p class="text-[11px] text-muted-foreground font-mono">
											${res.ratePerHour}/hora • {res.type === 'active' ? 'Mano de Obra' : 'Equipo/Horno'}
										</p>
									</div>
									<div class="size-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-secondary group-hover:text-secondary-foreground transition-colors">
										<Plus class="size-3.5" />
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Lista de Costos Asignados a la Receta -->
				<div class="space-y-3">
					<h3 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
						Costos Asignados a este Lote ({$form.costs.length})
					</h3>

					{#if $form.costs.length === 0}
						<div class="rounded-xl border border-dashed border-border/80 p-8 text-center bg-muted/10">
							<Coins class="size-8 text-muted-foreground/40 mx-auto mb-2" />
							<p class="text-xs font-semibold text-foreground">
								Esta receta no tiene costos operativos cargados
							</p>
							<p class="text-[11px] text-muted-foreground max-w-xs mx-auto mt-1">
								Haz clic en los recursos de arriba para sumar el tiempo de trabajo, horno o batido.
							</p>
						</div>
					{:else}
						<div class="space-y-3">
							{#each $form.costs as cost, idx (cost.id || idx)}
								<div class="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
									<div class="flex items-start justify-between gap-3">
										<div class="flex items-center gap-2">
											<div class="size-7 rounded-lg flex items-center justify-center {cost.type === 'active' ? 'bg-secondary/15 text-secondary' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'}">
												{#if cost.type === 'active'}
													<ChefHat class="size-4" />
												{:else}
													<Flame class="size-4" />
												{/if}
											</div>
											<div>
												<span class="text-sm font-bold text-foreground block leading-tight">
													{cost.name}
												</span>
												<div class="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
													<span class="font-semibold uppercase text-[10px] {cost.type === 'active' ? 'text-secondary' : 'text-amber-600 dark:text-amber-400'}">
														{cost.type === 'active' ? 'Activo (Mano de Obra)' : 'Pasivo (Horno/Espera)'}
													</span>
													<span>•</span>
													<span class="font-mono font-semibold text-foreground">
														Tarifa central: ${cost.ratePerHour}/h
													</span>
												</div>
											</div>
										</div>

										<Button
											type="button"
											variant="ghost"
											size="icon"
											class="size-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
											onclick={() => removeCost(idx)}
											title="Quitar costo de la receta"
										>
											<Trash2 class="size-4" />
										</Button>
									</div>

									<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/40 text-xs">
										<div>
											<Label class="text-[11px] font-semibold text-foreground mb-1.5 block">
												Duración en minutos
											</Label>
											<Input
												type="number"
												min="0"
												step="1"
												bind:value={cost.durationMinutes}
												class="h-9 text-xs font-mono font-semibold"
												placeholder="Ej. 30"
											/>
										</div>

										<div>
											<Label class="text-[11px] font-semibold text-foreground mb-1.5 block">
												Ámbito de aplicación
											</Label>
											<select
												bind:value={cost.isScalable}
												class="h-9 w-full rounded-lg border border-border bg-card px-2.5 text-xs text-foreground font-medium focus:outline-none"
											>
												<option value={false}>Por Lote completo de la tanda</option>
												<option value={true}>Por Unidad producida</option>
											</select>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<!-- Footer Form -->
			<form
				method="POST"
				action="?/saveRecipeOperationalCosts"
				class="border-t border-border p-4 bg-muted/20 flex items-center justify-between gap-3"
				use:enhance
			>
				<Button type="button" variant="outline" size="sm" onclick={handleClose}>
					Cancelar
				</Button>

				<Button type="submit" variant="default" size="sm" disabled={$delayed} class="gap-1.5 font-semibold">
					<span>Guardar Costos y Tiempos</span>
				</Button>
			</form>
		</div>
	</div>
{/if}
