<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import type { PageProps } from './$types';
	import {
		generateNextSalesProductCode,
		type PriceTier,
		type SalesProductComponentInput
	} from '#lib/features/orders/domain/order.entity';
	import { getDirectUnitCost, ITEM_TYPE_LABELS } from '#lib/features/items/domain/item.entity';
	import ItemTypeBadge from '#lib/features/items/ui/item-type-badge.svelte';
	import AppShell from '#lib/components/layout/app-shell.svelte';
	import { Button } from '#lib/components/ui/button';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import { Badge } from '#lib/components/ui/badge';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Check from '@lucide/svelte/icons/check';
	import Star from '@lucide/svelte/icons/star';
	import Percent from '@lucide/svelte/icons/percent';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import { formatQuantity } from '../../_components/utils';

	let { data, form }: PageProps = $props();

	// @ts-ignore
	const { form: superFormData, errors, enhance, delayed, message } = superForm(() => data.form, {
		dataType: 'json',
		taintedMessage: null,
	});

	// Bind form values to superforms
	$effect(() => {
		$superFormData.name = name;
		$superFormData.code = code;
		$superFormData.description = description;
		$superFormData.salePrice = salePrice;
		$superFormData.isShortcut = isShortcut;
		$superFormData.components = components;
		$superFormData.pricingTiers = pricingTiers;
	});

	// Permitir vincular cualquier ítem del inventario (materia prima, sub-ensamble o producto final)
	const linkableItems = $derived(data.items);

	// svelte-ignore state_referenced_locally
	let code = $state(generateNextSalesProductCode(data.existingCodes));
	let name = $state('');
	let description = $state('');
	let salePrice = $state(0);
	let isShortcut = $state(false);
	// isSubmitting handled by superforms

	// Componentes asociados
	let components = $state<SalesProductComponentInput[]>([]);

	$effect(() => {
		if (components.length === 0 && linkableItems.length > 0) {
			components = [{ itemId: linkableItems[0].id, quantity: 1 }];
		}
	});

	// Escalas de Descuento por Cantidad predefinidas para este producto
	let pricingTiers = $state<PriceTier[]>([]);

	function addComponentLine() {
		const nextCandidate =
			linkableItems.find((cand) => !components.some((c) => c.itemId === cand.id)) ??
			linkableItems[0];
		if (!nextCandidate) return;
		components = [...components, { itemId: nextCandidate.id, quantity: 1 }];
	}

	function removeComponentLine(index: number) {
		if (components.length <= 1) return;
		components = components.filter((_, idx) => idx !== index);
	}

	function addTier(minQty = 6, type: 'percentage' | 'fixed_price' = 'percentage', val = 10) {
		pricingTiers = [
			...pricingTiers,
			{
				minQuantity: minQty,
				type,
				value: val
			}
		].sort((a, b) => a.minQuantity - b.minQuantity);
	}

	function removeTier(index: number) {
		pricingTiers = pricingTiers.filter((_, idx) => idx !== index);
	}

	// Costo estimado total de las recetas de los componentes
	const estimatedRecipeCost = $derived.by(() => {
		let sum = 0;
		for (const comp of components) {
			const item = data.items.find((i) => i.id === comp.itemId);
			if (!item) continue;
			const unitCost =
				data.recipeSummaries[item.id]?.estimatedUnitCost ?? getDirectUnitCost(item);
			sum += unitCost * (comp.quantity > 0 ? comp.quantity : 1);
		}
		return sum;
	});

	const marginAmount = $derived(salePrice - estimatedRecipeCost);
	const marginPercentage = $derived(
		salePrice > 0 ? Math.round((marginAmount / salePrice) * 100) : 0
	);

	function formatCurrency(val: number): string {
		return `$ ${new Intl.NumberFormat('es-AR', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(val)}`;
	}
</script>

<svelte:head>
	<title>Nuevo Producto para Venta — {data.activeBusiness.name}</title>
</svelte:head>

<AppShell
	user={data.user}
	activeBusiness={data.activeBusiness}
	businesses={data.businesses}
	currentSection="inventory"
	title="Nuevo Producto"
	description="Alta comercial y componentes"
>
	{#snippet headerActions()}
		<Button variant="outline" href="/inventory?tab=products" class="gap-1.5">
			<ArrowLeft class="size-4" />
			<span>Volver al Catálogo</span>
		</Button>
	{/snippet}

	{#if linkableItems.length === 0}
		<div class="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
			<AlertTriangle class="mx-auto size-12 text-amber-500" />
			<h3 class="mt-4 text-lg font-bold text-foreground">
				No hay ítems en el Inventario
			</h3>
			<p class="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
				Para crear un producto comercial necesitas al menos un ítem registrado en el inventario (materia prima, sub-ensamble o producto final).
			</p>
			<Button href="/inventory" class="mt-6">
				Ir a Inventario de Ítems →
			</Button>
		</div>
	{:else}
		<form
			action="?/createSalesProductAction"
			method="POST"
			use:enhance
			class="mx-auto max-w-4xl space-y-8 pb-12"
		>


			{#if $message || (form && typeof form === 'object' && 'error' in form ? form.error : null)}
				<div class="flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">
					<AlertTriangle class="size-5 shrink-0" />
					<p class="text-sm font-semibold">{$message || (form && typeof form === 'object' && 'error' in form ? form.error : null)}</p>
				</div>
			{/if}

			<!-- BLOQUE 1: DATOS COMERCIALES BÁSICOS -->
			<div class="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-5">
				<div class="flex items-center justify-between border-b border-border pb-3">
					<div>
						<h3 class="text-base font-bold text-foreground">1. Identificación</h3>
						<p class="text-xs text-muted-foreground">
							Nombre y código visible en mostrador
						</p>
					</div>
					<Badge variant="secondary" class="font-mono text-xs">
						Código: {code}
					</Badge>
				</div>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-12">
					<div class="space-y-2 sm:col-span-3">
						<Label for="f-code">Código</Label>
						<Input
							id="f-code"
							name="code"
							bind:value={code}
							class="font-mono uppercase font-semibold"
							required
						/>
					</div>

					<div class="space-y-2 sm:col-span-9">
						<Label for="f-name">Nombre Comercial</Label>
						<Input
							id="f-name"
							name="name"
							bind:value={name}
							placeholder="Ej. Torta Selva Negra o Combo Cumpleaños"
							class="font-medium"
							required
						/>
						{#if $errors.name}<p class="text-xs text-destructive">{$errors.name}</p>{/if}
					</div>

					<div class="space-y-2 sm:col-span-12">
						<Label for="f-desc">Descripción (opcional)</Label>
						<Input
							id="f-desc"
							name="description"
							bind:value={description}
							placeholder="Ej. Incluye packaging especial y vela"
						/>
					</div>

					<!-- Atajo Rápido -->
					<div class="sm:col-span-12 pt-1">
						<label class="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3 cursor-pointer hover:bg-muted/30 transition-colors">
							<input
								type="checkbox"
								bind:checked={isShortcut}
								class="size-4.5 rounded border-input text-amber-500 focus:ring-amber-500"
							/>
							<div>
								<span class="flex items-center gap-1.5 text-xs font-bold text-foreground">
									<Star class="size-3.5 {isShortcut ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'}" />
									Fijar como atajo rápido en la pantalla de ventas
								</span>
							</div>
						</label>
					</div>
				</div>
			</div>

			<!-- BLOQUE 2: COMPONENTES / COMBOS -->
			<div class="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-5">
				<div class="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
					<div>
						<h3 class="text-base font-bold text-foreground">
							2. Componentes que Descuenta ({components.length})
						</h3>
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onclick={addComponentLine}
						class="gap-1.5 text-xs"
					>
						<Plus class="size-3.5" />
						<span>Agregar ítem (Combo)</span>
					</Button>
				</div>

				<div class="space-y-3">
					{#each components as comp, idx (idx)}
						{@const selectedItem = data.items.find((i) => i.id === comp.itemId)}
						{@const itemRecipeCost = selectedItem ? (data.recipeSummaries[selectedItem.id]?.estimatedUnitCost ?? getDirectUnitCost(selectedItem)) : 0}
						<div class="flex flex-col gap-3 rounded-xl border border-border bg-muted/15 p-3.5 sm:flex-row sm:items-center">
							<div class="min-w-0 flex-1 space-y-1">
								<Label class="text-xs text-muted-foreground">Ítem del Inventario</Label>
								<select
									bind:value={comp.itemId}
									onchange={() => {
										if (components.length === 1 && !name && selectedItem) {
											name = selectedItem.name;
										}
									}}
									class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
									required
								>
									{#each linkableItems as cand (cand.id)}
										<option value={cand.id}>
											[{cand.code}] {cand.name} ({ITEM_TYPE_LABELS[cand.type]} · Stock: {formatQuantity(cand.currentStock)} {cand.baseUnit === 'unit' ? 'un' : cand.baseUnit})
										</option>
									{/each}
								</select>
							</div>

							<div class="w-full sm:w-32 space-y-1">
								<Label class="text-xs text-muted-foreground">Cantidad</Label>
								<div class="flex items-center gap-1.5">
									<Input
										type="number"
										step="any"
										min="0.001"
										bind:value={comp.quantity}
										class="h-10 font-mono text-sm"
										required
									/>
									<span class="text-xs font-mono text-muted-foreground">
										{selectedItem?.baseUnit ?? 'u'}
									</span>
								</div>
							</div>

							<div class="w-full sm:w-36 space-y-1 sm:text-right">
								<span class="block text-xs text-muted-foreground">Costo de Receta</span>
								<span class="block font-mono text-sm font-semibold text-foreground">
									{formatCurrency(itemRecipeCost * (comp.quantity > 0 ? comp.quantity : 1))}
								</span>
							</div>

							{#if components.length > 1}
								<div class="pt-2 sm:pt-4">
									<Button
										type="button"
										size="icon"
										variant="ghost"
										class="size-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
										onclick={() => removeComponentLine(idx)}
									>
										<Trash2 class="size-4" />
									</Button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<!-- BLOQUE 3: PRECIO BASE Y ANÁLISIS DE RENTABILIDAD -->
			<div class="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-5">
				<div class="border-b border-border pb-3">
					<h3 class="text-base font-bold text-foreground">3. Precio de Lista Base</h3>
					<p class="text-xs text-muted-foreground">
						Precio comercial estándar para 1 unidad antes de cualquier escala por cantidad
					</p>
				</div>

				<div class="grid grid-cols-1 gap-6 sm:grid-cols-12 items-center">
					<div class="space-y-2 sm:col-span-5">
						<Label for="f-price" class="text-sm font-bold">Precio de Venta Unitario ($)</Label>
						<Input
							id="f-price"
							name="salePrice"
							type="number"
							step="any"
							min="0"
							bind:value={salePrice}
							class="h-12 font-mono text-lg font-bold"
							placeholder="0.00"
							required
						/>
						{#if $errors.salePrice}<p class="text-xs text-destructive">{$errors.salePrice}</p>{/if}
					</div>

					<div class="rounded-xl border border-border bg-muted/20 p-4 sm:col-span-7 space-y-2">
						<div class="flex items-center justify-between text-xs">
							<span class="text-muted-foreground">Costo de Producción según Receta:</span>
							<span class="font-mono font-bold text-foreground">
								{formatCurrency(estimatedRecipeCost)}
							</span>
						</div>
						<div class="flex items-center justify-between text-xs">
							<span class="text-muted-foreground">Margen Bruto Unitario:</span>
							<span class="font-mono font-bold {marginAmount >= 0 ? 'text-emerald-600' : 'text-destructive'}">
								{formatCurrency(marginAmount)} ({marginPercentage}%)
							</span>
						</div>
					</div>
				</div>
			</div>

			<!-- BLOQUE 4: ESCALAS PREDEFINIDAS DE DESCUENTO POR CANTIDAD (LA CLAVE) -->
			<div class="rounded-2xl border border-primary/30 bg-card p-6 shadow-xs space-y-5">
				<div class="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
					<div class="space-y-0.5">
						<div class="flex items-center gap-2">
							<Percent class="size-4 text-primary" />
							<h3 class="text-base font-bold text-foreground">
								4. Descuentos por Cantidad Predefinidos
							</h3>
						</div>
						<p class="text-xs text-muted-foreground">
							Al tomar la orden, si el cliente lleva esta cantidad, el sistema le asignará este precio o porcentaje automáticamente.
						</p>
					</div>

					<div class="flex items-center gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={() => addTier(6, 'percentage', 10)}
							class="h-8 gap-1 text-xs"
						>
							<span>+ Media Docena (6u -10%)</span>
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={() => addTier(12, 'percentage', 15)}
							class="h-8 gap-1 text-xs"
						>
							<span>+ Docena (12u -15%)</span>
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={() => addTier(10, 'percentage', 10)}
							class="h-8 gap-1 text-xs"
						>
							<Plus class="size-3.5" />
							<span>Personalizada</span>
						</Button>
					</div>
				</div>

				{#if pricingTiers.length === 0}
					<div class="rounded-xl border border-dashed border-border/80 bg-muted/10 p-6 text-center space-y-2">
						<Percent class="mx-auto size-7 text-muted-foreground/50" />
						<p class="text-xs font-medium text-foreground">
							Sin descuentos por cantidad configurados
						</p>
						<p class="text-[11px] text-muted-foreground max-w-md mx-auto">
							Si dejas esta sección vacía, se cobrará siempre el precio de lista. Agrega una regla arriba si ofreces descuento por media docena, docena o volumen.
						</p>
					</div>
				{:else}
					<div class="space-y-3">
						{#each pricingTiers as tier, idx (idx)}
							{@const tierUnitPrice =
								tier.type === 'percentage'
									? salePrice * (1 - (tier.value || 0) / 100)
									: tier.value || 0}
							{@const tierSavings = Math.max(0, salePrice - tierUnitPrice)}
							<div class="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-center">
								<!-- Cantidad Mínima -->
								<div class="w-full sm:w-44 space-y-1">
									<Label class="text-xs text-muted-foreground">A partir de (unidades)</Label>
									<div class="flex items-center gap-1.5">
										<span class="text-xs font-bold text-muted-foreground">≥</span >
										<Input
											type="number"
											min="2"
											step="1"
											bind:value={tier.minQuantity}
											class="h-9 font-mono text-xs font-bold"
											required
										/>
										<span class="text-xs text-muted-foreground">un</span>
									</div>
								</div>

								<!-- Tipo de Descuento -->
								<div class="w-full sm:w-44 space-y-1">
									<Label class="text-xs text-muted-foreground">Tipo de Regla</Label>
									<select
										bind:value={tier.type}
										class="flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs"
									>
										<option value="percentage">% Descuento</option>
										<option value="fixed_price">Precio Unitario Fijo ($)</option>
									</select>
								</div>

								<!-- Valor -->
								<div class="w-full sm:w-36 space-y-1">
									<Label class="text-xs text-muted-foreground">
										{tier.type === 'percentage' ? 'Porcentaje (%)' : 'Precio Especial ($)'}
									</Label>
									<Input
										type="number"
										step="any"
										min="0"
										max={tier.type === 'percentage' ? 100 : undefined}
										bind:value={tier.value}
										class="h-9 font-mono text-xs font-bold"
										required
									/>
								</div>

								<!-- Resultado Calculado en Vivo -->
								<div class="flex-1 rounded-lg bg-background p-2.5 text-xs space-y-0.5 border border-border/60">
									<div class="flex items-center justify-between">
										<span class="text-muted-foreground">Precio resultante:</span>
										<strong class="font-mono text-emerald-600 font-bold">
											{formatCurrency(tierUnitPrice)} c/u
										</strong>
									</div>
									<div class="flex items-center justify-between text-[11px] text-muted-foreground">
										<span>Ahorro para el cliente:</span>
										<span class="font-mono text-primary font-semibold">
											{formatCurrency(tierSavings)} por unidad
										</span>
									</div>
								</div>

								<!-- Eliminar -->
								<Button
									type="button"
									size="icon"
									variant="ghost"
									class="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
									onclick={() => removeTier(idx)}
								>
									<Trash2 class="size-4" />
								</Button>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- ACCIONES FINALES -->
			<div class="flex items-center justify-between rounded-2xl border border-border bg-card p-6 shadow-sm">
				<Button variant="ghost" href="/inventory?tab=products">
					Cancelar
				</Button>

				<Button type="submit" disabled={$delayed} class="gap-2 font-bold px-6 h-11">
					<Check class="size-4" />
					<span>Guardar Producto para Venta</span>
				</Button>
			</div>
		</form>
	{/if}
</AppShell>
