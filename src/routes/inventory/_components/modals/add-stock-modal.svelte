<script lang="ts">
	import { enhance as nativeEnhance } from '$app/forms';
	import { superForm } from 'sveltekit-superforms';
	import type { SuperValidated, Infer } from 'sveltekit-superforms';
	import type { AddStockBatchSchema } from '#lib/schemas/stock-batch.schema';
	import type { Item, ItemStockBatch, UnitOfMeasure } from '#lib/features/items/domain/item.entity';
	import {
		getDirectUnitCost,
		isRecipeDivisible
	} from '#lib/features/items/domain/item.entity';
	import {
		calculateMaxProducibleQuantity,
		simulateMultiLevelProduction,
		type RecipeTreeNode
	} from '#lib/features/recipes/domain/recipe.entity';
	import { Button } from '#lib/components/ui/button';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import NumberStepper from '#lib/components/ui/number-stepper.svelte';
	import X from '@lucide/svelte/icons/x';
	import Package from '@lucide/svelte/icons/package';
	import PackagePlus from '@lucide/svelte/icons/package-plus';
	import History from '@lucide/svelte/icons/history';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Info from '@lucide/svelte/icons/info';
	import Layers from '@lucide/svelte/icons/layers';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import Clock from '@lucide/svelte/icons/clock';
	import ClockFading from '@lucide/svelte/icons/clock-fading';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import { formatCurrency, formatDate, getDaysAgo, formatQuantity } from '../utils';

	interface Props {
		open: boolean;
		formData: SuperValidated<Infer<AddStockBatchSchema>>;
		item: Item | null;
		businessId: string;
		allItems?: Item[];
		recipeSummary?: {
			nodes: RecipeTreeNode[];
			estimatedTotalCost?: number;
			estimatedUnitCost?: number;
		};
		recipeSummaries?: Record<
			string,
			{
				directComponentsCount: number;
				estimatedTotalCost: number;
				estimatedUnitCost: number;
				nodes: RecipeTreeNode[];
			}
		>;
		estimatedUnitCost?: number;
		initialQty?: number | '';
		onClose: () => void;
		onOpenRecipeStructure?: (itemId: string) => void;
	}

	let {
		open = $bindable(),
		formData,
		item,
		businessId,
		allItems = [],
		recipeSummary,
		recipeSummaries = {},
		estimatedUnitCost = 0,
		initialQty = '',
		onClose,
		onOpenRecipeStructure
	}: Props = $props();

	let stockIntakeQty = $state<number | ''>('');
	let stockIntakeTotalCost = $state<number | ''>('');
	let stockIntakeSupplier = $state('');
	let stockIntakeNotes = $state('');
	let isSubmittingStock = $state(false);
	let batchToDelete = $state<ItemStockBatch | null>(null);
	let isDeletingBatch = $state(false);

	// svelte-ignore state_referenced_locally
	const { form, errors, message, enhance, submitting, reset } = superForm(formData, {
		onResult({ result }) {
			if (result.type === 'success') {
				handleClose();
			}
		}
	});

	// Líneas directas de receta si es elaboración
	const recipeNodes = $derived(item?.type === 'prepared' ? (recipeSummary?.nodes ?? []) : []);
	const hasRecipe = $derived(recipeNodes.length > 0);
	const yieldQuantity = $derived(
		item?.yieldQuantity && item.yieldQuantity > 0 ? item.yieldQuantity : 1
	);
	const isDivisible = $derived(item ? isRecipeDivisible(item) : false);

	$effect(() => {
		if (open) {
			if (initialQty !== '' && Number(initialQty) > 0) {
				if (item?.type === 'prepared') {
					const y = item.yieldQuantity && item.yieldQuantity > 0 ? item.yieldQuantity : 1;
					const div = isRecipeDivisible(item);
					stockIntakeQty = div
						? Number(Number(initialQty).toFixed(2))
						: Number((Math.max(y, Math.ceil(Number(initialQty) / y) * y)).toFixed(2));
				} else {
					stockIntakeQty = Number(Number(initialQty).toFixed(2));
				}
			} else if (item?.type === 'prepared') {
				const y = item.yieldQuantity && item.yieldQuantity > 0 ? item.yieldQuantity : 1;
				stockIntakeQty = isRecipeDivisible(item) ? 1 : y;
			} else {
				stockIntakeQty = '';
			}
			stockIntakeTotalCost = '';
			stockIntakeSupplier = '';
			stockIntakeNotes = '';
			isSubmittingStock = false;
			batchToDelete = null;
			isDeletingBatch = false;
		}
	});

	function handleClose() {
		open = false;
		reset();
		onClose();
	}

	const calculatedIntakeUnitCost = $derived.by(() => {
		const qty = Number(stockIntakeQty);
		const cost = Number(stockIntakeTotalCost);
		if (qty > 0 && cost >= 0) {
			return cost / qty;
		}
		return 0;
	});

	// Paso inteligente: si la receta es divisible permite avanzar de a 1; si es Tanda Fija avanza de a yieldQuantity
	const stepperStep = $derived.by(() => {
		if (!item) return 1;
		if (item.type === 'prepared') {
			return isDivisible ? 1 : yieldQuantity;
		}
		if (item.baseUnit === 'g' || item.baseUnit === 'ml') return 50;
		if (item.baseUnit === 'kg' || item.baseUnit === 'l') return 1;
		return 1;
	});

	const itemsMap = $derived.by(() => {
		const map = new Map<string, Item>();
		for (const i of allItems) {
			map.set(i.id, i);
		}
		if (item && !map.has(item.id)) {
			map.set(item.id, item);
		}
		return map;
	});

	const linesByParentMap = $derived.by(() => {
		const map = new Map<
			string,
			Array<{ componentItemId: string; quantity: number; unit: UnitOfMeasure }>
		>();
		for (const [parentId, summary] of Object.entries(recipeSummaries ?? {})) {
			map.set(
				parentId,
				(summary?.nodes ?? []).map((n) => ({
					componentItemId: n.component.id,
					quantity: n.quantity,
					unit: n.unit
				}))
			);
		}
		if (item && recipeSummary && !map.has(item.id)) {
			map.set(
				item.id,
				(recipeSummary.nodes ?? []).map((n) => ({
					componentItemId: n.component.id,
					quantity: n.quantity,
					unit: n.unit
				}))
			);
		}
		return map;
	});

	const inputQtyNum = $derived(
		typeof stockIntakeQty === 'number' && !isNaN(stockIntakeQty) && stockIntakeQty > 0
			? stockIntakeQty
			: 0
	);

	// Simulación multinivel exacta (idéntica al backend)
	const simulation = $derived.by(() => {
		if (!item || item.type !== 'prepared') return null;
		const previewQty = inputQtyNum > 0 ? inputQtyNum : isDivisible ? 1 : yieldQuantity;
		return simulateMultiLevelProduction({
			rootItemId: item.id,
			producedQty: previewQty,
			itemsById: itemsMap,
			linesByParent: linesByParentMap
		});
	});

	const maxCapacityInfo = $derived.by(() => {
		if (!item || item.type !== 'prepared' || !hasRecipe) return null;
		return calculateMaxProducibleQuantity({
			rootItemId: item.id,
			itemsById: itemsMap,
			linesByParent: linesByParentMap
		});
	});

	const maxProducible = $derived(maxCapacityInfo ? maxCapacityInfo.maxQuantity : null);
	const bottleneckNames = $derived(maxCapacityInfo ? maxCapacityInfo.bottleneckNames : []);

	const hasAnyDeficit = $derived(
		Boolean(
			item?.type === 'prepared' &&
				hasRecipe &&
				inputQtyNum > 0 &&
				simulation &&
				!simulation.canProduce
		)
	);
	const deficitCount = $derived(
		simulation
			? simulation.rawMaterials.filter((r) => r.isShortage).length +
					simulation.subAssemblies.filter((s) => s.missingRecipeError).length
			: 0
	);

	// Cálculo del tiempo estimado de preparación/horneado
	const estimatedTimeMinutes = $derived.by(() => {
		if (!item || item.type !== 'prepared' || !item.prepTimeMinutes || item.prepTimeMinutes <= 0) {
			return 0;
		}
		if (isDivisible) {
			if (inputQtyNum <= 0) return 0;
			return Math.round((item.prepTimeMinutes / yieldQuantity) * inputQtyNum);
		}
		if (inputQtyNum <= 0) {
			return item.prepTimeMinutes;
		}
		const tandas = Math.ceil(inputQtyNum / yieldQuantity);
		return tandas * item.prepTimeMinutes;
	});

	function formatDuration(mins: number): string {
		if (mins < 60) return `${mins} min`;
		const h = Math.floor(mins / 60);
		const m = mins % 60;
		return m > 0 ? `${h}h ${m}m` : `${h}h`;
	}
</script>

{#if open && item}
	{@const batches = item.batches ?? []}
	{@const activeBatches = batches.filter((b) => b.remainingQuantity > 0)}
	{@const oldestActive = activeBatches.length > 0 ? activeBatches[0] : null}
	<div
		class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 p-0 sm:p-4 backdrop-blur-[1px]"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="flex max-h-[94vh] sm:max-h-[90vh] w-full max-w-full sm:max-w-2xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border-t sm:border border-border bg-card shadow-2xl lg:max-w-3xl"
		>
			<!-- Encabezado del Modal -->
			<div class="flex items-start justify-between gap-4 border-b border-border p-6 pb-4">
				<div class="space-y-1">
					<div class="flex flex-wrap items-center gap-2">
						<span
							class="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-tight bg-muted text-muted-foreground"
						>
							{item.code}
						</span>
						<span class="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
							{item.type === 'raw_material' ? 'Insumo' : 'Elaboración'}
						</span>
						{#if item.type === 'prepared'}
							<span class="rounded-full border border-secondary/30 bg-secondary/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-secondary">
								{isDivisible
									? `Divisible (1 a 1 · Receta base: ${yieldQuantity} ${item.baseUnit === 'unit' ? 'un' : item.baseUnit})`
									: `Tanda Fija (${yieldQuantity} ${item.baseUnit === 'unit' ? 'un' : item.baseUnit}/lote)`}
							</span>
						{/if}
					</div>
					<h2 class="text-xl font-bold text-foreground">
						Cargar Stock: {item.name}
					</h2>
					<p class="text-xs text-muted-foreground">
						{#if item.type === 'raw_material'}
							Ingresa la cantidad comprada y el costo total abonado. El sistema actualizará el stock y calculará el costo unitario ponderado.
						{:else}
							Ingresa la cantidad producida. Si faltan sub-elaborados intermedios, el sistema producirá sus tandas automáticamente (dejando sobrantes en stock) y descontará los insumos base.
						{/if}
					</p>
				</div>
				<Button
					type="button"
					size="icon"
					variant="ghost"
					class="size-8"
					onclick={handleClose}
				>
					<X class="size-4" />
				</Button>
			</div>

			<!-- Contenido con scroll -->
			<div class="flex-1 space-y-5 overflow-y-auto p-6">
				{#if $message}
					<div class="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
						<TriangleAlert class="size-4 shrink-0 mt-0.5" />
						<span class="font-medium leading-relaxed">{$message}</span>
					</div>
				{/if}

				<!-- Métricas Rápidas del Ítem -->
				<div
					class="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/20 p-3.5 sm:grid-cols-4"
				>
					<div class="flex flex-col justify-between">
						<div class="flex h-5 items-center gap-1 text-[11px] font-medium text-muted-foreground">
							<Package class="size-3 shrink-0" />
							<span>Stock Actual</span>
						</div>
						<div>
							<p class="font-mono text-base font-bold text-foreground">
								{formatQuantity(item.currentStock)} <span class="text-xs font-normal text-muted-foreground">{item.baseUnit === 'unit' ? 'un' : item.baseUnit}</span>
							</p>
							<p class="text-[10px] text-transparent select-none">&nbsp;</p>
						</div>
					</div>
					<div class="flex flex-col justify-between">
						<div class="flex h-5 items-center text-[11px] font-medium text-muted-foreground">
							<span>Costo Unit.</span>
						</div>
						<div>
							<p class="font-mono text-base font-bold text-foreground">
								{#if item.type === 'raw_material'}
									{formatCurrency(getDirectUnitCost(item))}
								{:else}
									{formatCurrency(estimatedUnitCost)}
								{/if}
							</p>
							<p class="text-[10px] text-muted-foreground">
								{item.type === 'raw_material' ? `por ${item.baseUnit}` : 'por receta'}
							</p>
						</div>
					</div>
					<div class="flex flex-col justify-between">
						<div class="flex h-5 items-center text-[11px] font-medium text-muted-foreground">
							<span>{item.type === 'raw_material' ? 'Lotes Activos' : 'Lotes Registrados'}</span>
						</div>
						<div>
							<p class="font-mono text-base font-bold text-foreground">
								{activeBatches.length} <span class="text-xs font-normal text-muted-foreground">({batches.length} hist.)</span>
							</p>
							<p class="text-[10px] text-transparent select-none">&nbsp;</p>
						</div>
					</div>
					<div class="flex flex-col justify-between">
						<div class="flex h-5 items-center gap-1 text-[11px] font-medium text-muted-foreground">
							<Package class="size-3 shrink-0" />
							<span>{item.type === 'raw_material' ? 'Lote más Antiguo' : 'Máx. Fabricable'}</span>
						</div>
						<div>
							{#if item.type === 'raw_material'}
								{#if oldestActive}
									<p class="text-xs font-semibold text-foreground">
										{getDaysAgo(oldestActive.createdAt)}
									</p>
									<p class="text-[10px] text-muted-foreground">1º en rotación</p>
								{:else}
									<p class="text-xs text-muted-foreground">Sin stock previo</p>
									<p class="text-[10px] text-transparent select-none">&nbsp;</p>
								{/if}
							{:else}
								{#if maxProducible !== null}
									<p class="font-mono text-base font-bold {maxProducible > 0 ? 'text-primary' : 'text-destructive'}">
										{formatQuantity(maxProducible)} <span class="text-xs font-normal text-muted-foreground">{item.baseUnit}</span>
									</p>
									<p class="text-[10px] text-muted-foreground">según BOM multinivel</p>
								{:else}
									<p class="text-xs text-muted-foreground">Sin receta</p>
									<p class="text-[10px] text-transparent select-none">&nbsp;</p>
								{/if}
							{/if}
						</div>
					</div>
				</div>

				<!-- Aviso sólo si la elaboración no tiene receta -->
				{#if item.type === 'prepared' && !hasRecipe}
					<div class="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
						<div class="flex items-center gap-2">
							<Info class="size-4 shrink-0" />
							<span>Esta elaboración aún no tiene ingredientes en su receta. Configúrala para poder registrar producción.</span>
						</div>
						{#if onOpenRecipeStructure}
							<button
								type="button"
								class="inline-flex items-center gap-1 font-bold text-destructive hover:underline cursor-pointer shrink-0"
								onclick={() => {
									const targetId = item.id;
									handleClose();
									onOpenRecipeStructure?.(targetId);
								}}
							>
								<span>Configurar</span>
								<ArrowUpRight class="size-3" />
							</button>
						{/if}
					</div>
				{/if}

				<!-- Formulario de Entrada de Stock -->
				<form
					id="add-stock-form"
					method="POST"
					action="?/addStockBatch"
					class="space-y-4"
					use:enhance
				>
					<input type="hidden" name="businessId" value={businessId} />
					<input type="hidden" name="id" value={item.id} />

					<div class="grid grid-cols-1 gap-4 {item.type === 'raw_material' ? 'sm:grid-cols-2' : ''}">
						<!-- Cantidad Comprada / Producida con NumberStepper -->
						<div class="space-y-1.5">
							<div class="flex items-center gap-2">
								<Label for="stock-intake-qty" class="text-xs font-semibold text-foreground">
									{item.type === 'raw_material' ? 'Cantidad Comprada' : 'Cantidad Producida'}
								</Label>
								<span class="font-mono text-xs font-bold {item.type === 'raw_material' ? 'text-yellow-700 dark:text-yellow-400' : 'text-secondary'}">
									{stockIntakeQty ? `${formatQuantity(Number(stockIntakeQty))} ${item.baseUnit}` : `0 ${item.baseUnit}`}
								</span>
							</div>

							<div class="flex flex-wrap items-center gap-2">
								<NumberStepper
									id="stock-intake-qty"
									name="quantity"
									bind:value={stockIntakeQty}
									step={stepperStep}
									min={0}
									placeholder="0"
									required
									inputClass="w-20"
								/>

								{#if item.type === 'prepared'}
									<!-- Botones rápidos de unidad (si es divisible) y múltiplos de receta (1x, 2x, 3x, 4x) -->
									<div class="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
										{#if isDivisible && yieldQuantity > 1}
											<button
												type="button"
												onclick={() => (stockIntakeQty = 1)}
												class="rounded-md px-2 py-1 font-mono text-[11px] font-bold transition-colors cursor-pointer {Number(stockIntakeQty) === 1
													? 'bg-secondary text-secondary-foreground shadow-2xs'
													: 'text-muted-foreground hover:text-foreground hover:bg-background'}"
												title="Producir 1 unidad suelta"
											>
												1 {item.baseUnit === 'unit' ? 'un' : item.baseUnit}
											</button>
										{/if}
										{#each [1, 2, 3, 4] as mult (mult)}
											{@const multQty = Number((yieldQuantity * mult).toFixed(2))}
											{@const isSelected = Number(stockIntakeQty) === multQty}
											<button
												type="button"
												onclick={() => (stockIntakeQty = multQty)}
												class="rounded-md px-2 py-1 font-mono text-[11px] font-bold transition-colors cursor-pointer {isSelected
													? 'bg-primary text-primary-foreground shadow-2xs'
													: 'text-muted-foreground hover:text-foreground hover:bg-background'}"
												title="{mult} {mult === 1 ? 'tanda' : 'tandas'} de receta ({multQty} {item.baseUnit})"
											>
												{mult}x ({multQty})
											</button>
										{/each}
									</div>
								{/if}

								<!-- Info de máximo disponible según BOM multinivel -->
								{#if item.type === 'prepared' && maxProducible !== null}
									{#if maxProducible > 0}
										<button
											type="button"
											onclick={() => {
												stockIntakeQty = maxProducible;
											}}
											class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 font-mono text-xs font-bold text-foreground shadow-2xs hover:border-primary hover:bg-primary/5 hover:text-primary active:scale-95 transition-all cursor-pointer"
											title={bottleneckNames.length > 0 ? `Limitado por: ${bottleneckNames.join(', ')}` : 'Cargar capacidad máxima'}
										>
											<Package class="size-3.5 text-primary" />
											<span>Máx: {formatQuantity(maxProducible)} {item.baseUnit}</span>
										</button>
									{:else}
										<div
											class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 font-mono text-xs font-bold text-destructive"
											title={bottleneckNames.length > 0 ? `Falta stock en: ${bottleneckNames.join(', ')}` : 'Sin stock disponible de insumos'}
										>
											<Package class="size-3.5 text-destructive" />
											<span>Máx: 0 {item.baseUnit}</span>
										</div>
									{/if}
								{/if}

								<!-- Tiempo estimado de preparación / horneado -->
								{#if item.type === 'prepared' && estimatedTimeMinutes > 0}
									<div
										class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2.5 font-mono text-xs font-semibold text-foreground/90 select-none"
										title={isDivisible ? 'Tiempo estimado proporcional por unidad' : 'Tiempo estimado por tanda completa (/ lote)'}
									>
										{#if isDivisible}
											<ClockFading class="size-3.5 text-secondary shrink-0" />
										{:else}
											<Clock class="size-3.5 text-secondary shrink-0" />
										{/if}
										<span>{formatDuration(estimatedTimeMinutes)}</span>
									</div>
								{/if}
							</div>
						</div>

						{#if item.type === 'raw_material'}
							<!-- Costo Total Pagado (sólo insumos) -->
							<div class="space-y-1.5">
								<div class="flex items-center justify-between">
									<Label for="stock-intake-cost" class="text-xs font-semibold text-foreground">
										Costo Total Abonado ($) *
									</Label>
									{#if calculatedIntakeUnitCost > 0}
										<span class="font-mono text-xs font-bold text-muted-foreground">
											{formatCurrency(calculatedIntakeUnitCost)} / {item.baseUnit}
										</span>
									{/if}
								</div>
								<div class="relative flex items-center">
									<span class="pointer-events-none absolute left-3 font-bold text-sm text-muted-foreground">$</span>
									<Input
										id="stock-intake-cost"
										name="totalCost"
										type="number"
										step="any"
										min="0"
										bind:value={stockIntakeTotalCost}
										placeholder="0.00"
										class="h-9 pl-7 font-mono text-sm"
										required
									/>
								</div>
								<p class="text-[11px] text-muted-foreground">
									Total pagado por el lote completo de insumo.
								</p>
							</div>
						{/if}
					</div>

					<!-- Banner en Vivo: Costo Resultante (sólo insumos) -->
					{#if item.type === 'raw_material' && calculatedIntakeUnitCost > 0}
						<div class="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5">
							<div class="space-y-0.5">
								<span class="text-xs font-semibold text-primary">Costo Unitario Calculado</span>
								<p class="font-mono text-lg font-extrabold text-foreground">
									{formatCurrency(calculatedIntakeUnitCost)} <span class="text-xs font-normal text-muted-foreground">/ {item.baseUnit}</span>
								</p>
							</div>
							{#if item.baseUnit === 'g'}
								<div class="text-right">
									<span class="text-[11px] font-medium text-muted-foreground">Equivalente por Kilo</span>
									<p class="font-mono text-sm font-bold text-foreground">
										{formatCurrency(calculatedIntakeUnitCost * 1000)} / kg
									</p>
								</div>
							{:else if item.baseUnit === 'ml'}
								<div class="text-right">
									<span class="text-[11px] font-medium text-muted-foreground">Equivalente por Litro</span>
									<p class="font-mono text-sm font-bold text-foreground">
										{formatCurrency(calculatedIntakeUnitCost * 1000)} / l
									</p>
								</div>
							{/if}
						</div>
					{/if}

					<!-- Panel en Vivo: Explosión BOM Multinivel (Sub-elaborados + Materias Primas) -->
					{#if item.type === 'prepared' && hasRecipe && simulation}
						<div class="space-y-3 rounded-xl border border-border bg-card p-3.5 shadow-2xs">
							<div class="flex h-7 items-center justify-between gap-2 border-b border-border/60 pb-2">
								<div class="flex items-center gap-2">
									<Layers class="size-4 text-secondary" />
									<h3 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
										Explosión BOM y Consumo de Insumos
									</h3>
								</div>
								<div class="flex h-5 items-center">
									{#if inputQtyNum > 0 && hasAnyDeficit}
										<span class="inline-flex items-center gap-1 font-mono text-xs font-bold text-destructive">
											<TriangleAlert class="size-3.5" />
											<span>{deficitCount} {deficitCount === 1 ? 'faltante bloqueante' : 'faltantes bloqueantes'}</span>
										</span>
									{/if}
								</div>
							</div>

							<div class="space-y-3 max-h-64 overflow-y-auto pr-1">
								<!-- 1. Sub-elaborados intermedios -->
								{#if simulation.subAssemblies.length > 0}
									<div class="space-y-1.5">
										<span class="text-[10px] font-bold uppercase tracking-wider text-secondary block">
											Sub-elaborados intermedios ({simulation.subAssemblies.length})
										</span>
										{#each simulation.subAssemblies as sub (sub.item.id)}
											<div
												class="rounded-lg border px-3 py-2 transition-colors {sub.missingRecipeError
													? 'border-destructive/40 bg-destructive/5'
													: sub.autoProducedQty > 0
														? 'border-secondary/30 bg-secondary/5'
														: 'border-border/50 bg-muted/10'}"
											>
												<div class="flex flex-wrap items-center justify-between gap-2 text-xs">
													<div class="flex items-center gap-2 min-w-0">
														<span
															class="size-2 shrink-0 rounded-full {sub.missingRecipeError
																? 'bg-destructive animate-pulse'
																: sub.autoProducedQty > 0
																	? 'bg-secondary'
																	: 'bg-emerald-500'}"
														></span>
														<span class="font-mono text-[10px] font-bold text-muted-foreground">
															{sub.item.code}
														</span>
														<span class="font-semibold text-foreground truncate max-w-[140px] sm:max-w-[200px]" title={sub.item.name}>
															{sub.item.name}
														</span>
														<span class="rounded border border-secondary/30 bg-secondary/15 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-secondary">
															{sub.isDivisible ? 'ELB · Divisible' : `ELB · Tanda ${sub.item.yieldQuantity} ${sub.item.baseUnit === 'unit' ? 'un' : sub.item.baseUnit}`}
														</span>
													</div>

													<div class="flex flex-wrap items-center gap-2 font-mono text-xs shrink-0">
														<span class="text-muted-foreground">
															Req: <strong class="text-foreground">{formatQuantity(sub.requiredQty)} {sub.item.baseUnit}</strong>
														</span>

														{#if sub.usedFromStockQty > 0}
															<span class="rounded bg-muted px-1.5 py-0.5 text-[10px] text-foreground">
																Usa stock: -{formatQuantity(sub.usedFromStockQty)}
															</span>
														{/if}

														{#if sub.autoProducedQty > 0}
															<span class="inline-flex items-center gap-1 rounded bg-secondary/15 px-1.5 py-0.5 text-[10px] font-bold text-secondary">
																<Sparkles class="size-3" />
																Auto-fabrica +{formatQuantity(sub.autoProducedQty)} {sub.item.baseUnit}
																{#if !sub.isDivisible && sub.item.yieldQuantity > 1}
																	({sub.batchesAutoProduced}x)
																{/if}
															</span>
														{/if}

														{#if sub.surplusToStockQty > 0}
															<span class="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
																+{formatQuantity(sub.surplusToStockQty)} {sub.item.baseUnit} sobrante a stock
															</span>
														{/if}

														{#if !sub.isMakeToOrder}
															<span class="text-muted-foreground">
																| Stock: {formatQuantity(sub.item.currentStock)} → <strong class="text-foreground">{formatQuantity(sub.projectedFinalStock)}</strong> {sub.item.baseUnit}
															</span>
														{/if}
													</div>
												</div>
											</div>
										{/each}
									</div>
								{/if}

								<!-- 2. Materias Primas / Insumos Base consolidados -->
								{#if simulation.rawMaterials.length > 0}
									<div class="space-y-1.5">
										<span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
											Insumos / Materias Primas a descontar ({simulation.rawMaterials.length})
										</span>
										{#each simulation.rawMaterials as raw (raw.item.id)}
											{@const remainingPct = raw.availableStock > 0
												? Math.max(0, Math.min(100, Math.round((raw.projectedFinalStock / raw.availableStock) * 100)))
												: 0}
											<div
												class="rounded-lg border px-3 py-2 transition-colors {raw.isShortage
													? 'border-destructive/40 bg-destructive/5'
													: raw.isLowStock
														? 'border-amber-500/30 bg-amber-500/5'
														: 'border-border/50 bg-muted/10'}"
											>
												<div class="flex flex-wrap items-center justify-between gap-2 text-xs">
													<div class="flex items-center gap-2 min-w-0">
														<span
															class="size-2 shrink-0 rounded-full {raw.isShortage
																? 'bg-destructive animate-pulse'
																: raw.isLowStock
																	? 'bg-amber-500'
																	: 'bg-emerald-500'}"
														></span>
														<span class="font-mono text-[10px] font-bold text-muted-foreground">
															{raw.item.code}
														</span>
														<span class="font-semibold text-foreground truncate max-w-[140px] sm:max-w-[200px]" title={raw.item.name}>
															{raw.item.name}
														</span>
														<span class="rounded border border-tertiary/40 bg-tertiary/20 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-yellow-900 dark:text-yellow-300">
															INS
														</span>
													</div>

													<div class="flex items-center gap-3 font-mono text-xs shrink-0">
														<span class="font-bold text-destructive dark:text-red-400">
															-{formatQuantity(raw.requiredQty)} {raw.item.baseUnit}
														</span>
														<span class="text-muted-foreground/30">|</span>
														<div class="flex items-center gap-1.5">
															<Package class="size-3.5 text-muted-foreground shrink-0" />
															{#if raw.isShortage}
																<span class="font-bold text-destructive">
																	Disp: {formatQuantity(raw.availableStock)} · Faltan {formatQuantity(raw.shortageQty)} {raw.item.baseUnit}
																</span>
															{:else}
																<span class="text-foreground">
																	{formatQuantity(raw.availableStock)} → <strong class="font-bold">{formatQuantity(raw.projectedFinalStock)}</strong> {raw.item.baseUnit}
																</span>
															{/if}
														</div>
													</div>
												</div>

												<div class="mt-1.5 flex items-center gap-2">
													<div class="h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
														<div
															class="h-full rounded-full transition-all duration-300 {raw.isShortage
																? 'bg-destructive'
																: raw.isLowStock
																	? 'bg-amber-500'
																	: 'bg-emerald-500'}"
															style="width: {inputQtyNum > 0 ? remainingPct : 100}%"
														></div>
													</div>
													<span class="w-7 text-right font-mono text-[9px] text-muted-foreground shrink-0">
														{inputQtyNum > 0 ? `${remainingPct}%` : '100%'}
													</span>
												</div>
											</div>
										{/each}
									</div>
								{/if}
							</div>

							<!-- Bloqueo si faltan insumos o sub-recetas -->
							{#if hasAnyDeficit && simulation.blockingErrors.length > 0}
								<div class="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
									<TriangleAlert class="size-4 shrink-0 mt-0.5" />
									<div class="space-y-1">
										<p class="font-bold">Producción bloqueada por falta de stock de insumos:</p>
										<ul class="list-disc pl-4 space-y-0.5">
											{#each simulation.blockingErrors as err}
												<li>{err}</li>
											{/each}
										</ul>
									</div>
								</div>
							{/if}
						</div>
					{/if}

					<div class="grid grid-cols-1 gap-4 {item.type === 'raw_material' ? 'sm:grid-cols-2' : ''}">
						{#if item.type === 'raw_material'}
							<div class="space-y-1.5">
								<Label for="stock-intake-supplier" class="font-medium text-foreground">
									Proveedor (opcional)
								</Label>
								<Input
									id="stock-intake-supplier"
									name="supplier"
									type="text"
									bind:value={stockIntakeSupplier}
									placeholder="Ej. Molinos Río de la Plata"
									class="h-9 text-xs"
								/>
							</div>
						{/if}

						<div class="space-y-1.5">
							<Label for="stock-intake-notes" class="font-medium text-foreground">
								{item.type === 'raw_material'
									? 'Comprobante / Lote / Notas (opcional)'
									: 'Lote / Notas de producción (opcional)'}
							</Label>
							<Input
								id="stock-intake-notes"
								name="notes"
								type="text"
								bind:value={stockIntakeNotes}
								placeholder={item.type === 'raw_material'
									? 'Ej. Factura A-1234 o Vto 10/2026'
									: 'Ej. Tanda mañana, lote #4'}
								class="h-9 text-xs"
							/>
						</div>
					</div>
				</form>

				<!-- Historial de Cargas de Stock -->
				<div class="space-y-2.5 border-t border-border/60 pt-3">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<History class="size-4 text-muted-foreground" />
							<h3 class="text-sm font-bold text-foreground">
								Historial de Cargas de Stock
							</h3>
						</div>
						<span class="text-xs text-muted-foreground">
							{activeBatches.length} {activeBatches.length === 1 ? 'lote en existencia' : 'lotes en existencia'}
						</span>
					</div>

					{#if batches.length > 0}
						<div class="space-y-2">
							{#each batches.slice().reverse() as batch (batch.id)}
								{@const isOldestActive = oldestActive && batch.id === oldestActive.id}
								{@const isExhausted = batch.remainingQuantity <= 0}
								<div
									class="rounded-xl border p-3 transition-colors {isOldestActive
										? 'border-primary/50 bg-primary/5 ring-1 ring-primary/30'
										: isExhausted
											? 'border-border/40 bg-muted/10 opacity-55'
											: 'border-border bg-card'}"
								>
									<div class="flex flex-wrap items-center justify-between gap-2">
										<div class="flex items-center gap-2">
											<span class="font-mono text-xs font-semibold text-foreground">
												{formatDate(batch.createdAt)}
											</span>
											<span class="text-xs text-muted-foreground">
												({getDaysAgo(batch.createdAt)})
											</span>
											{#if isOldestActive}
												<span
													class="rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary"
												>
													1º en rotación
												</span>
											{:else if isExhausted}
												<span
													class="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
												>
													Agotado
												</span>
											{:else}
												<span
													class="rounded-full border border-secondary/30 bg-secondary/15 px-2 py-0.5 text-[10px] font-medium text-secondary"
												>
													En cola
												</span>
											{/if}
										</div>

										<div class="flex items-center gap-3">
											<div class="text-right">
												{#if item.type === 'raw_material'}
													{@const totalCostVal = batch.totalCost != null && batch.totalCost > 0
														? batch.totalCost
														: (batch.initialQuantity * batch.unitCost)}
													<p class="font-mono text-xs font-bold text-foreground">
														{formatQuantity(batch.remainingQuantity)} / {formatQuantity(batch.initialQuantity)} {item.baseUnit}
													</p>
													<p class="font-mono text-[11px] text-muted-foreground">
														Total: {formatCurrency(totalCostVal)} · <span class="text-muted-foreground/80">{formatCurrency(batch.unitCost)}/{item.baseUnit}</span>
													</p>
												{:else}
													<p class="font-mono text-xs font-bold text-foreground">
														+{formatQuantity(batch.initialQuantity)} {item.baseUnit} <span class="text-[11px] font-normal text-muted-foreground">producidos</span>
													</p>
													<p class="font-mono text-[11px] text-muted-foreground">
														{formatQuantity(batch.remainingQuantity)} {item.baseUnit} disponible{batch.remainingQuantity === 1 ? '' : 's'}
													</p>
												{/if}
											</div>

											<Button
												type="button"
												size="icon"
												variant="ghost"
												class="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
												title="Eliminar esta carga de stock"
												onclick={() => {
													batchToDelete = batch;
												}}
											>
												<Trash2 class="size-3.5" />
											</Button>
										</div>
									</div>

									{#if batch.supplier || batch.notes}
										<div
											class="mt-2 flex flex-wrap items-center gap-2 border-t border-border/40 pt-1.5 text-[11px] text-muted-foreground"
										>
											{#if batch.supplier}
												<span class="font-medium text-foreground/80">Prov: {batch.supplier}</span>
											{/if}
											{#if batch.notes}
												<span>· {batch.notes}</span>
											{/if}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{:else}
						<div class="rounded-xl border border-dashed border-border p-6 text-center">
							<p class="text-xs text-muted-foreground">
								{item.type === 'raw_material'
									? 'Aún no hay compras registradas para este insumo. Al ingresar la primera carga, quedará documentada con su fecha y costo unitario.'
									: 'Aún no hay registros de elaboración. Al cargar stock de producción, quedará registrado con la fecha y cantidad producida.'}
							</p>
						</div>
					{/if}
				</div>
			</div>

			<!-- Acciones del Modal -->
			<div class="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-4">
				<Button
					type="button"
					variant="outline"
					onclick={handleClose}
					disabled={$submitting || isSubmittingStock}
				>
					Cancelar
				</Button>
				<Button
					type="submit"
					form="add-stock-form"
					disabled={$submitting ||
						isSubmittingStock ||
						!stockIntakeQty ||
						Number(stockIntakeQty) <= 0 ||
						(item.type === 'prepared' && (!hasRecipe || hasAnyDeficit)) ||
						(item.type === 'raw_material' &&
							(!stockIntakeTotalCost || Number(stockIntakeTotalCost) < 0))}
				>
					<PackagePlus class="mr-1.5 size-4" />
					<span>{isSubmittingStock
						? 'Registrando...'
						: item.type === 'raw_material'
							? 'Registrar Carga de Stock'
							: 'Registrar Elaboración'}</span>
				</Button>
			</div>
		</div>
	</div>

	<!-- Modal de confirmación para eliminar carga de stock -->
	{#if batchToDelete}
		<div
			class="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs"
			role="dialog"
			aria-modal="true"
		>
			<div
				class="w-full max-w-full sm:max-w-md overflow-hidden rounded-t-2xl sm:rounded-2xl border-t sm:border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150"
			>
				<div class="border-b border-border px-5 py-4">
					<div class="flex items-center gap-2.5">
						<div
							class="flex size-9 items-center justify-center rounded-xl {item.type === 'prepared'
								? 'bg-amber-500/15 text-amber-500'
								: 'bg-destructive/15 text-destructive'}"
						>
							{#if item.type === 'prepared'}
								<RotateCcw class="size-5" />
							{:else}
								<TriangleAlert class="size-5" />
							{/if}
						</div>
						<div>
							<h3 class="text-sm font-bold text-foreground">
								{item.type === 'prepared'
									? '¿Revertir esta elaboración?'
									: '¿Eliminar esta carga de stock?'}
							</h3>
							<p class="text-xs text-muted-foreground">
								Lote del {formatDate(batchToDelete.createdAt)}
							</p>
						</div>
					</div>
				</div>

				<div class="space-y-3.5 p-5 text-xs text-muted-foreground">
					<div class="rounded-xl border border-border/60 bg-muted/20 p-3">
						<p class="font-semibold text-foreground">
							{item.name}
						</p>
						<p class="mt-0.5 font-mono text-[11px]">
							Carga inicial: <span class="font-bold text-foreground">{formatQuantity(batchToDelete.initialQuantity)} {item.baseUnit}</span>
							{#if batchToDelete.remainingQuantity !== batchToDelete.initialQuantity}
								· Restante: <span class="font-bold text-foreground">{formatQuantity(batchToDelete.remainingQuantity)} {item.baseUnit}</span>
							{/if}
						</p>
					</div>

					{#if item.type === 'prepared'}
						<div class="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
							<RotateCcw class="size-4 shrink-0 mt-0.5" />
							<div class="space-y-1">
								<p class="font-bold">Se devolverán los insumos consumidos</p>
								<p class="leading-relaxed">
									Se descontarán los <strong class="font-mono">{formatQuantity(batchToDelete.remainingQuantity)} {item.baseUnit}</strong> del stock de esta elaboración, se retirarán los sobrantes de tanda generados y se <strong>restaurarán automáticamente todos los insumos e ingredientes</strong> consumidos a sus inventarios correspondientes.
								</p>
							</div>
						</div>
					{:else}
						<div class="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-destructive">
							<TriangleAlert class="size-4 shrink-0 mt-0.5" />
							<div class="space-y-1">
								<p class="font-bold">Ajuste de inventario y costo</p>
								<p class="leading-relaxed">
									Se descontarán <strong class="font-mono">{formatQuantity(batchToDelete.remainingQuantity)} {item.baseUnit}</strong> del stock disponible de este insumo y se recalculará automáticamente el costo promedio ponderado.
								</p>
							</div>
						</div>
					{/if}
				</div>

				<div class="flex items-center justify-end gap-2 border-t border-border bg-muted/20 px-5 py-3">
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={isDeletingBatch}
						onclick={() => {
							batchToDelete = null;
						}}
					>
						Cancelar
					</Button>

					<form
						method="POST"
						action="?/deleteStockBatch"
						use:nativeEnhance={() => {
							isDeletingBatch = true;
							return async ({ update }) => {
								await update();
								isDeletingBatch = false;
								batchToDelete = null;
							};
						}}
					>
						<input type="hidden" name="businessId" value={businessId} />
						<input type="hidden" name="id" value={item.id} />
						<input type="hidden" name="batchId" value={batchToDelete.id} />
						<Button
							type="submit"
							variant="destructive"
							size="sm"
							disabled={isDeletingBatch}
							class="gap-1.5"
						>
							{#if item.type === 'prepared'}
								<RotateCcw class="size-3.5" />
								<span>{isDeletingBatch ? 'Revirtiendo...' : 'Revertir y Devolver Insumos'}</span>
							{:else}
								<Trash2 class="size-3.5" />
								<span>{isDeletingBatch ? 'Eliminando...' : 'Eliminar Carga'}</span>
							{/if}
						</Button>
					</form>
				</div>
			</div>
		</div>
	{/if}
{/if}
