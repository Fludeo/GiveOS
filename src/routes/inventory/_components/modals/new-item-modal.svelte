<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import type { SuperValidated, Infer } from 'sveltekit-superforms';
	import type { CreateItemSchema } from '#lib/schemas/item.schema';
	import {
		generateNextItemCode,
		UNITS_OF_MEASURE,
		UNIT_LABELS,
		type ItemType,
		type UnitOfMeasure
	} from '#lib/features/items/domain/item.entity';
	import { Button } from '#lib/components/ui/button';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import X from '@lucide/svelte/icons/x';
	import Wheat from '@lucide/svelte/icons/wheat';
	import GraphHub from '@lucide/svelte/icons/graph-hub';
	import Clock from '@lucide/svelte/icons/clock';
	import ChefHat from '@lucide/svelte/icons/chef-hat';
	import Flame from '@lucide/svelte/icons/flame';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import Check from '@lucide/svelte/icons/check';

	interface Props {
		open: boolean;
		formData: SuperValidated<Infer<CreateItemSchema>>;
		businessId: string;
		existingCodes: string[];
		initialType?: ItemType;
		onClose: () => void;
		onSuccess?: (createdId?: string) => void;
	}

	let {
		open = $bindable(),
		formData,
		businessId,
		existingCodes,
		initialType = 'raw_material',
		onClose,
		onSuccess
	}: Props = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, message, reset } = superForm(formData, {
		resetForm: true,
		onResult: ({ result }) => {
			if (result.type === 'success') {
				const createdId = (result.data as any)?.created?.id;
				handleClose();
				if (onSuccess) {
					onSuccess(createdId);
				}
			}
		}
	});

	let newItemStep = $state<1 | 2 | 3>(1);
	let newItemInitialType = $state<ItemType>('raw_material');

	$effect(() => {
		if (open) {
			newItemInitialType = initialType;
			$form.businessId = businessId;
			$form.type = initialType;
			$form.name = '';
			$form.baseUnit = initialType === 'raw_material' ? 'g' : 'unit';
			$form.minStock = 0;
			$form.prepTimeMinutes = 0;
			$form.passiveTimeMinutes = 0;
			$form.notes = '';
			newItemStep = initialType === 'prepared' ? 2 : 1;
		}
	});

	function handleClose() {
		open = false;
		reset();
		onClose();
	}

	const nextAutoCode = $derived(generateNextItemCode($form.type as ItemType, existingCodes));
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 p-0 sm:p-4 backdrop-blur-[1px]"
		role="dialog"
		aria-modal="true"
		aria-labelledby="new-item-modal-title"
	>
		<div class="flex max-h-[92vh] sm:max-h-[90vh] w-full max-w-full sm:max-w-lg flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border-t sm:border border-border bg-card shadow-xl">
			<!-- Header -->
			<div class="flex items-start justify-between gap-4 border-b border-border p-5 pb-4">
				<div class="space-y-1">
					<div class="flex items-center gap-2">
						<span class="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold">
							Paso {newItemStep} de 3
						</span>
						<span class="text-xs text-muted-foreground font-mono">
							Código: {nextAutoCode}
						</span>
					</div>
					<h2 id="new-item-modal-title" class="text-lg font-bold text-foreground">
						{#if newItemStep === 1}
							¿Qué deseas registrar?
						{:else if newItemStep === 2}
							Nombre y Unidad Base
						{:else}
							Parámetros y Alertas
						{/if}
					</h2>
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

			<!-- Formulario -->
			<form
				method="POST"
				action="?/createItem"
				use:enhance
				class="flex flex-1 flex-col overflow-hidden"
			>
				<input type="hidden" name="businessId" bind:value={$form.businessId} />
				<input type="hidden" name="type" bind:value={$form.type} />
				<input type="hidden" name="baseUnit" bind:value={$form.baseUnit} />

				{#if $message}
					<div class="m-5 mb-0 flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-destructive">
						<AlertTriangle class="size-4 shrink-0" />
						<p class="text-xs font-semibold">{$message}</p>
					</div>
				{/if}

				<div class="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
					{#if newItemStep === 1}
						<!-- PASO 1: Elegir Tipo -->
						<div class="grid grid-cols-1 gap-3">
							<button
								type="button"
								onclick={() => {
									$form.type = 'raw_material';
									$form.baseUnit = 'g';
									newItemStep = 2;
								}}
								class="flex items-start gap-3.5 rounded-xl border-2 p-4 text-left transition-all hover:bg-muted/30 {$form.type === 'raw_material' ? 'border-primary bg-primary/5 shadow-xs' : 'border-border'}"
							>
								<div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
									<Wheat class="size-5" />
								</div>
								<div class="space-y-0.5">
									<p class="text-sm font-bold text-foreground">Materia Prima / Ingrediente</p>
									<p class="text-xs text-muted-foreground leading-relaxed">
										Insumo que compras a proveedores para tus recetas (harina, huevos, manteca, etc.).
									</p>
								</div>
							</button>

							<button
								type="button"
								onclick={() => {
									$form.type = 'prepared';
									$form.baseUnit = 'unit';
									newItemStep = 2;
								}}
								class="flex items-start gap-3.5 rounded-xl border-2 p-4 text-left transition-all hover:bg-muted/30 {$form.type === 'prepared' ? 'border-secondary bg-secondary/5 shadow-xs' : 'border-border'}"
							>
								<div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
									<GraphHub class="size-5" />
								</div>
								<div class="space-y-0.5">
									<p class="text-sm font-bold text-foreground">Elaboración / Receta</p>
									<p class="text-xs text-muted-foreground leading-relaxed">
										Sub-ensamble o producto final que cocinas a partir de otros ingredientes o recetas.
									</p>
								</div>
							</button>
						</div>
					{:else if newItemStep === 2}
						<!-- PASO 2: Nombre y Unidad Base -->
						<div class="space-y-4">
							<div class="space-y-1.5">
								<Label for="inv-step-name" class="font-semibold text-foreground">
									Nombre de {$form.type === 'prepared' ? 'la Elaboración' : 'la Materia Prima'}
								</Label>
								<Input
									id="inv-step-name"
									name="name"
									bind:value={$form.name}
									placeholder={$form.type === 'prepared' ? 'Ej. Bizcochuelo de Vainilla 20cm' : 'Ej. Harina 0000'}
									class="h-11 text-base font-medium"
									autofocus
									required
								/>
								{#if $errors.name}
									<p class="text-xs text-destructive">{$errors.name}</p>
								{/if}
							</div>

							<div class="space-y-1.5">
								<Label class="font-semibold text-foreground">Unidad de Almacenamiento Principal</Label>
								<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
									{#each UNITS_OF_MEASURE as u}
										<button
											type="button"
											onclick={() => ($form.baseUnit = u)}
											class="flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all hover:bg-muted/30 {$form.baseUnit === u ? 'border-primary bg-primary/10 font-bold text-primary shadow-xs' : 'border-border text-foreground'}"
										>
											<span class="text-base font-mono font-bold uppercase">{u === 'unit' ? 'un' : u}</span>
											<span class="text-[11px] text-muted-foreground">{UNIT_LABELS[u]}</span>
										</button>
									{/each}
								</div>
							</div>
						</div>
					{:else}
						<!-- PASO 3: Parámetros del Ítem -->
						<div class="space-y-4">
							<div class="space-y-1.5">
								<Label for="inv-step-min" class="flex items-center gap-1.5 font-semibold text-foreground">
									<AlertTriangle class="size-3.5 text-destructive" />
									<span>Aviso de Stock Mínimo (opcional)</span>
								</Label>
								<Input
									id="inv-step-min"
									name="minStock"
									type="number"
									step="any"
									min="0"
									bind:value={$form.minStock}
									class="h-11 font-mono text-base"
									placeholder="0 (alerta al bajar de esta cantidad)"
								/>
								{#if $errors.minStock}
									<p class="text-xs text-destructive">{$errors.minStock}</p>
								{/if}
								<p class="text-[11px] text-muted-foreground">
									{#if $form.type === 'raw_material'}
										Recibirás una alerta cuando las existencias desciendan por debajo de este valor. Podrás cargar stock y su costo en cualquier momento con el botón "Cargar Stock".
									{:else}
										El stock de esta elaboración aumentará automáticamente al cocinar lotes de su receta.
									{/if}
								</p>
							</div>

							<div class="space-y-1.5">
								<Label for="inv-step-notes">Notas (opcional)</Label>
								<Input
									id="inv-step-notes"
									name="notes"
									bind:value={$form.notes}
									placeholder="Proveedor, marca o detalle"
									class="h-9 text-xs"
								/>
							</div>
						</div>
					{/if}
				</div>

				<!-- Footer del Wizard -->
				<div class="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-4">
					{#if newItemStep === 1}
						<Button type="button" variant="outline" onclick={handleClose}>
							Cancelar
						</Button>
						<Button type="button" onclick={() => (newItemStep = 2)}>
							Siguiente →
						</Button>
					{:else if newItemStep === 2}
						<Button
							type="button"
							variant="outline"
							onclick={() => {
								if (newItemInitialType === 'prepared') {
									handleClose();
								} else {
									newItemStep = 1;
								}
							}}
						>
							{newItemInitialType === 'prepared' ? 'Cancelar' : '← Atrás'}
						</Button>
						<Button
							type="button"
							disabled={!$form.name?.trim()}
							onclick={() => (newItemStep = 3)}
							variant={$form.type === 'prepared' ? 'secondary' : 'default'}
						>
							Siguiente →
						</Button>
					{:else}
						<Button type="button" variant="outline" onclick={() => (newItemStep = 2)}>
							← Atrás
						</Button>
						<Button
							type="submit"
							disabled={$delayed}
							variant={$form.type === 'prepared' ? 'secondary' : 'default'}
						>
							<Check class="size-4" />
							<span>{$delayed ? 'Guardando...' : ($form.type === 'prepared' ? 'Guardar Elaboración' : 'Guardar Ítem')}</span>
						</Button>
					{/if}
				</div>
			</form>
		</div>
	</div>
{/if}
