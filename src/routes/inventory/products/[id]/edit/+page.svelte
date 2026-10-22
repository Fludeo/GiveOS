<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import {
		type PriceTier,
		type SalesProductComponentInput
	} from '#lib/features/orders/domain/order.entity';
	import { getDirectUnitCost, ITEM_TYPE_LABELS } from '#lib/features/items/domain/item.entity';
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
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import { formatQuantity } from '../../../_components/utils';

	let { data, form }: PageProps = $props();

	// Permitir vincular cualquier ítem del inventario (materia prima, sub-ensamble o producto final)
	const linkableItems = $derived(data.items);

	// svelte-ignore state_referenced_locally
	let name = $state(data.product.name);
	// svelte-ignore state_referenced_locally
	let description = $state(data.product.description ?? '');
	// svelte-ignore state_referenced_locally
	let salePrice = $state(data.product.salePrice);
	// svelte-ignore state_referenced_locally
	let isActive = $state(data.product.isActive);
	// svelte-ignore state_referenced_locally
	let isShortcut = $state(data.product.isShortcut);
	let isSubmitting = $state(false);

	// svelte-ignore state_referenced_locally
	let components = $state<SalesProductComponentInput[]>(
		data.product.components.map((c) => ({
			itemId: c.itemId,
			quantity: c.quantity
		}))
	);

	// svelte-ignore state_referenced_locally
	let pricingTiers = $state<PriceTier[]>(
		data.product.pricingTiers && Array.isArray(data.product.pricingTiers)
			? [...data.product.pricingTiers]
			: []
	);

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
	<title>Editar {data.product.name} — {data.activeBusiness.name}</title>
</svelte:head>

<AppShell
	user={data.user}
	activeBusiness={data.activeBusiness}
	businesses={data.businesses}
	currentSection="inventory"
	title="Editar Producto Comercial"
	description="Actualiza precios, recetas asociadas y escalas de descuento por cantidad"
>
	{#snippet headerActions()}
		<Button variant="outline" href="/inventory?tab=products" class="gap-1.5">
			<ArrowLeft class="size-4" />
			<span>Volver al Catálogo</span>
		</Button>
	{/snippet}

	<form
		method="POST"
		action="?/updateSalesProduct"
		use:enhance={() => {
			isSubmitting = true;
			return async ({ update }) => {
				await update();
				isSubmitting = false;
			};
		}}
		class="mx-auto max-w-4xl space-y-8 pb-12"
	>
		<input type="hidden" name="businessId" value={data.activeBusiness.id} />
		<input type="hidden" name="componentsJson" value={JSON.stringify(components)} />
		<input type="hidden" name="pricingTiersJson" value={JSON.stringify(pricingTiers)} />
		<input type="hidden" name="isActive" value={isActive ? 'true' : 'false'} />
		<input type="hidden" name="isShortcut" value={isShortcut ? 'true' : 'false'} />

		{#if form?.error}
			<div class="flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">
				<AlertTriangle class="size-5 shrink-0" />
				<p class="text-sm font-semibold">{form.error}</p>
			</div>
		{/if}

		<!-- BLOQUE 1: IDENTIFICACIÓN -->
		<div class="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-5">
			<div class="flex items-center justify-between border-b border-border pb-3">
				<div>
					<h3 class="text-base font-bold text-foreground">1. Identificación Comercial</h3>
					<p class="text-xs text-muted-foreground">
						Código de catálogo y nombre comercial
					</p>
				</div>
				<Badge variant="secondary" class="font-mono text-xs">
					Código: {data.product.code}
				</Badge>
			</div>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-12">
				<div class="space-y-2 sm:col-span-9">
					<Label for="f-name">Nombre del Producto</Label>
					<Input id="f-name" name="name" bind:value={name} class="font-medium" required />
				</div>

				<div class="space-y-2 sm:col-span-3">
					<Label for="f-active">Estado</Label>
					<select
						id="f-active"
						bind:value={isActive}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs"
					>
						<option value={true}>Activo para Ventas</option>
						<option value={false}>Pausado</option>
					</select>
				</div>

				<div class="space-y-2 sm:col-span-12">
					<Label for="f-desc">Descripción / Presentación (opcional)</Label>
					<Input
						id="f-desc"
						name="description"
						bind:value={description}
						placeholder="Ej. Incluye packaging especial, vela y cartel"
					/>
				</div>

				<div class="sm:col-span-12 pt-2">
					<label class="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3.5 cursor-pointer hover:bg-muted/30 transition-colors">
						<input
							type="checkbox"
							bind:checked={isShortcut}
							class="size-4.5 rounded border-input text-amber-500 focus:ring-amber-500"
						/>
						<div>
							<span class="flex items-center gap-1.5 text-sm font-bold text-foreground">
								<Star class="size-4 {isShortcut ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'}" />
								Fijar como Atajo Rápido ⭐ en la pantalla de Ventas
							</span>
							<p class="text-xs text-muted-foreground">
								Aparecerá como botón de acceso rápido táctil al abrir el terminal de pedidos.
							</p>
						</div>
					</label>
				</div>
			</div>
		</div>

		<!-- BLOQUE 2: PRODUCTOS FINALES / COMBOS -->
		<div class="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-5">
			<div class="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
				<div>
					<h3 class="text-base font-bold text-foreground">
						2. Productos Finales Asociados ({components.length})
					</h3>
					<p class="text-xs text-muted-foreground">
						Recetas vinculadas que se descuentan al producir o vender
					</p>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onclick={addComponentLine}
					class="gap-1.5 text-xs"
				>
					<Plus class="size-3.5" />
					<span>Agregar otro producto (Armar Combo)</span>
				</Button>
			</div>

			<div class="space-y-3">
				{#each components as comp, idx (idx)}
					{@const selectedItem = data.items.find((i) => i.id === comp.itemId)}
					{@const itemRecipeCost = selectedItem ? (data.recipeSummaries[selectedItem.id]?.estimatedUnitCost ?? getDirectUnitCost(selectedItem)) : 0}
					<div class="flex flex-col gap-3 rounded-xl border border-border bg-muted/15 p-4 sm:flex-row sm:items-center">
						<div class="min-w-0 flex-1 space-y-1">
							<Label class="text-xs text-muted-foreground">Ítem del Inventario (Insumo, Sub-ensamble o Producto Final)</Label>
							<select
								bind:value={comp.itemId}
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

		<!-- BLOQUE 3: PRECIO BASE -->
		<div class="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-5">
			<div class="border-b border-border pb-3">
				<h3 class="text-base font-bold text-foreground">3. Precio de Lista Base</h3>
				<p class="text-xs text-muted-foreground">
					Precio unitario de referencia para 1 unidad
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

		<!-- BLOQUE 4: ESCALAS DE DESCUENTO POR CANTIDAD -->
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
						Al seleccionar la cantidad en la orden, el sistema aplicará automáticamente esta escala.
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
						Se cobrará el precio de lista para cualquier cantidad. Agrega una regla arriba si tienes precio especial por volumen.
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

		<!-- ACCIONES -->
		<div class="flex items-center justify-between rounded-2xl border border-border bg-card p-6 shadow-sm">
			<Button variant="ghost" href="/inventory?tab=products">
				Cancelar
			</Button>

			<Button type="submit" disabled={isSubmitting} class="gap-2 font-bold px-6 h-11">
				<Check class="size-4" />
				<span>Guardar Cambios</span>
			</Button>
		</div>
	</form>
</AppShell>
