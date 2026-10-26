<script lang="ts">
	import { enhance } from '$app/forms';
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

	interface Props {
		open: boolean;
		item: Item | null;
		businessSettings?: BusinessSettings | null;
		businessId: string;
		onClose: () => void;
	}

	let { open = $bindable(), item, businessSettings, businessId, onClose }: Props = $props();

	let costs = $state<RecipeOperationalCost[]>([]);
	let isSubmitting = $state(false);

	const availableBusinessResources = $derived<OperationalCostResource[]>(
		businessSettings?.operationalCosts ?? []
	);

	$effect(() => {
		if (open && item) {
			const existing = item.recipeConfig?.operationalCosts;
			if (existing && existing.length > 0) {
				// Sincronizar nombres y tarifas por hora directamente desde businessSettings si coinciden por resourceId o name
				costs = existing.map((c) => {
					const matched = availableBusinessResources.find(
						(r) => (c.resourceId && r.id === c.resourceId) || r.name.toLowerCase() === c.name.toLowerCase()
					);
					return {
						...c,
						resourceId: matched?.id ?? c.resourceId,
						name: matched?.name ?? c.name,
						type: matched?.type ?? c.type,
						ratePerHour: matched ? matched.ratePerHour : c.ratePerHour
					};
				});
			} else {
				costs = [];
			}
		}
	});

	function addFromCatalog(resource: OperationalCostResource) {
		costs = [
			...costs,
			{
				id: crypto.randomUUID(),
				resourceId: resource.id,
				name: resource.name,
				type: resource.type,
				durationMinutes: resource.type === 'active' ? 15 : 30,
				ratePerHour: resource.ratePerHour,
				isScalable: false
			}
		];
	}

	function removeCost(index: number) {
		costs = costs.filter((_, i) => i !== index);
	}

	function handleClose() {
		open = false;
		onClose();
	}

	// Cálculos en vivo
	const totalActiveMinutes = $derived(
		costs.filter((c) => c.type === 'active').reduce((acc, c) => acc + (Number(c.durationMinutes) || 0), 0)
	);

	const totalPassiveMinutes = $derived(
		costs.filter((c) => c.type === 'passive').reduce((acc, c) => acc + (Number(c.durationMinutes) || 0), 0)
	);

	const totalBatchCost = $derived.by(() => {
		if (!item) return 0;
		const yieldQty = item.yieldQuantity > 0 ? item.yieldQuantity : 1;
		return costs.reduce((acc, c) => {
			const dur = Number(c.durationMinutes) || 0;
			const rate = Number(c.ratePerHour) || 0;
			const batchMin = c.isScalable ? dur * yieldQty : dur;
			return acc + (batchMin / 60) * rate;
		}, 0);
	});

	const costsJson = $derived(JSON.stringify(costs));
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
						Costo Operativo Lote
					</span>
					<div class="flex items-center justify-center gap-1.5 text-primary font-mono font-bold text-base mt-0.5">
						<Coins class="size-4" />
						<span>${totalBatchCost.toFixed(2)}</span>
					</div>
				</div>
			</div>

			<!-- Contenido con scroll -->
			<div class="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
				<!-- Selector de Recursos desde Ajustes del Negocio -->
				<div class="space-y-2 rounded-2xl border border-border bg-muted/20 p-4">
					<div class="flex items-center justify-between gap-2">
						<div class="flex items-center gap-2">
							<Sparkles class="size-4 text-primary" />
							<span class="text-xs font-bold text-foreground">Tarifas del Negocio disponibles</span>
						</div>
						<a
							href="/settings"
							target="_blank"
							class="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors"
						>
							<Settings class="size-3" />
							<span>Gestionar tarifas</span>
						</a>
					</div>

					{#if availableBusinessResources.length > 0}
						<div class="flex flex-wrap gap-2 pt-1">
							{#each availableBusinessResources as res}
								<button
									type="button"
									onclick={() => addFromCatalog(res)}
									class="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary hover:bg-primary/5 transition-all cursor-pointer shadow-2xs"
								>
									{#if res.type === 'active'}
										<ChefHat class="size-3.5 text-secondary" />
									{:else}
										<Flame class="size-3.5 text-amber-500" />
									{/if}
									<span>{res.name}</span>
									<span class="font-mono text-[11px] font-bold text-primary">
										${res.ratePerHour}/h
									</span>
									<span class="rounded bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground uppercase font-semibold">
										{res.type === 'active' ? 'Activo' : 'Pasivo'}
									</span>
									<Plus class="size-3 text-muted-foreground ml-0.5" />
								</button>
							{/each}
						</div>
					{:else}
						<div class="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
							No tienes tarifas operativas registradas en la empresa.
							<a href="/settings" class="text-primary underline font-medium ml-1">Configúralas en Ajustes</a> para agregarlas aquí.
						</div>
					{/if}
				</div>

				<!-- Lista de Costos Asignados a la Receta -->
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
							Costos Asignados a esta Receta ({costs.length})
						</span>
					</div>

					{#if costs.length === 0}
						<div class="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
							No has agregado costos operativos a esta receta. Selecciona una de las tarifas disponibles arriba para asignar el tiempo.
						</div>
					{:else}
						<div class="space-y-2.5">
							{#each costs as cost, idx}
								<div class="rounded-2xl border border-border bg-card p-3.5 shadow-2xs space-y-3">
									<div class="flex items-center justify-between gap-3">
										<div class="flex items-center gap-2">
											{#if cost.type === 'active'}
												<div class="flex size-7 items-center justify-center rounded-lg bg-secondary/15 text-secondary">
													<ChefHat class="size-4" />
												</div>
											{:else}
												<div class="flex size-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
													<Flame class="size-4" />
												</div>
											{/if}
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
				use:enhance={() => {
					isSubmitting = true;
					return async ({ result, update }) => {
						await update();
						isSubmitting = false;
						if (result.type === 'success') {
							handleClose();
						}
					};
				}}
			>
				<input type="hidden" name="businessId" value={businessId} />
				<input type="hidden" name="itemId" value={item.id} />
				<input type="hidden" name="costs" value={costsJson} />

				<Button type="button" variant="outline" size="sm" onclick={handleClose}>
					Cancelar
				</Button>

				<Button type="submit" variant="default" size="sm" disabled={isSubmitting} class="gap-1.5 font-semibold">
					<span>Guardar Costos y Tiempos</span>
				</Button>
			</form>
		</div>
	</div>
{/if}
