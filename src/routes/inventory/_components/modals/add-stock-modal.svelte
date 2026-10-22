<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Item, ItemStockBatch } from '#lib/features/items/domain/item.entity';
	import {
		getDirectUnitCost,
		convertQuantity,
		ITEM_TYPE_CONFIG
	} from '#lib/features/items/domain/item.entity';
	import type { RecipeTreeNode } from '#lib/features/recipes/domain/recipe.entity';
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
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Info from '@lucide/svelte/icons/info';
	import Layers from '@lucide/svelte/icons/layers';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import Clock from '@lucide/svelte/icons/clock';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import { formatCurrency, formatDate, getDaysAgo, formatQuantity } from '../utils';

	interface Props {
		open: boolean;
		item: Item | null;
		businessId: string;
		allItems?: Item[];
		recipeSummary?: {
			nodes: RecipeTreeNode[];
			estimatedTotalCost?: number;
			estimatedUnitCost?: number;
		};
		estimatedUnitCost?: number;
		onClose: () => void;
		onOpenRecipeStructure?: (itemId: string) => void;
	}

	let {
		open = $bindable(),
		item,
		businessId,
		allItems = [],
		recipeSummary,
		estimatedUnitCost = 0,
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

	$effect(() => {
		if (open) {
			stockIntakeQty = '';
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

	// Paso inteligente para el stepper según la unidad de medida
	const stepperStep = $derived.by(() => {
		if (!item) return 1;
		if (item.baseUnit === 'g' || item.baseUnit === 'ml') return 50;
		if (item.baseUnit === 'kg' || item.baseUnit === 'l') return 1;
		return 1;
	});

	// Líneas directas de receta si es elaboración
	const recipeNodes = $derived(item?.type === 'prepared' ? (recipeSummary?.nodes ?? []) : []);
	const hasRecipe = $derived(recipeNodes.length > 0);
	const yieldQuantity = $derived(
		item?.yieldQuantity && item.yieldQuantity > 0 ? item.yieldQuantity : 1
	);

	interface ComponentImpact {
		node: RecipeTreeNode;
		component: Item;
		requiredPerParentUnit: number;
		consumedForInput: number;
		currentStock: number;
		remainingStock: number;
		isDeficit: boolean;
		deficitQty: number;
		isLowStock: boolean;
		maxProducibleUnits: number;
	}

	// Cálculo reactivo del consumo en tiempo real y capacidad por cada componente
	const impacts = $derived.by<ComponentImpact[]>(() => {
		if (!item || item.type !== 'prepared' || recipeNodes.length === 0) return [];
		const inputQty =
			typeof stockIntakeQty === 'number' && !isNaN(stockIntakeQty)
				? Math.max(0, stockIntakeQty)
				: 0;
		const batchFactor = inputQty / yieldQuantity;

		return recipeNodes.map((node) => {
			const comp = allItems.find((i) => i.id === node.component.id) ?? node.component;
			// Cantidad necesaria en la unidad base del componente para 1 tanda de rendimiento
			const requiredInCompBaseForBatch = convertQuantity(node.quantity, node.unit, comp.baseUnit);
			const requiredPerParentUnit = requiredInCompBaseForBatch / yieldQuantity;

			// Cantidad consumida para la cantidad actualmente ingresada
			const consumedForInput = convertQuantity(
				node.quantity * batchFactor,
				node.unit,
				comp.baseUnit
			);
			const currentStock = comp.currentStock;
			const remainingStock = currentStock - consumedForInput;
			const isDeficit = inputQty > 0 && remainingStock < -0.0001;
			const deficitQty = isDeficit ? Math.abs(remainingStock) : 0;
			const isLowStock = inputQty > 0 && !isDeficit && remainingStock <= comp.minStock;

			// Unidades máximas del ítem padre que se pueden elaborar con el stock de este componente
			const maxProducibleUnits =
				requiredPerParentUnit > 0
					? Math.max(0, comp.currentStock / requiredPerParentUnit)
					: Infinity;

			return {
				node,
				component: comp,
				requiredPerParentUnit,
				consumedForInput,
				currentStock,
				remainingStock,
				isDeficit,
				deficitQty,
				isLowStock,
				maxProducibleUnits
			};
		});
	});

	// Stock máximo potencial que se podría elaborar con todas las existencias actuales
	const maxProducible = $derived.by(() => {
		if (impacts.length === 0) return null;
		const minVal = Math.min(...impacts.map((i) => i.maxProducibleUnits));
		if (!Number.isFinite(minVal) || minVal < 0) return 0;
		return Math.round(minVal * 100) / 100;
	});

	// Insumo o elaborado limitante (cuello de botella)
	const bottleneckComponents = $derived.by(() => {
		if (maxProducible === null || impacts.length === 0) return [];
		return impacts.filter((i) => Math.abs(i.maxProducibleUnits - maxProducible) < 0.01);
	});

	const hasAnyDeficit = $derived(impacts.some((i) => i.isDeficit));
	const deficitCount = $derived(impacts.filter((i) => i.isDeficit).length);

	// Cálculo del tiempo estimado de preparación/horneado
	// Para recetas parciales o hasta 1 tanda base no lleva menos tiempo (tiempo fijo de horneado)
	const estimatedTimeMinutes = $derived.by(() => {
		if (!item || item.type !== 'prepared' || !item.prepTimeMinutes || item.prepTimeMinutes <= 0) {
			return 0;
		}
		const inputQty =
			typeof stockIntakeQty === 'number' && !isNaN(stockIntakeQty) ? stockIntakeQty : 0;
		if (inputQty <= 0) {
			return item.prepTimeMinutes;
		}
		const tandas = Math.ceil(inputQty / yieldQuantity);
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
		class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl lg:max-w-3xl"
		>
			<!-- Encabezado del Modal -->
			<div class="flex items-start justify-between gap-4 border-b border-border p-6 pb-4">
				<div class="space-y-1">
					<div class="flex items-center gap-2">
						<span
							class="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-tight bg-muted text-muted-foreground"
						>
							{item.code}
						</span>
						<span class="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
							{item.type === 'raw_material' ? 'Insumo' : 'Elaboración'}
						</span>
					</div>
					<h2 class="text-xl font-bold text-foreground">
						Cargar Stock: {item.name}
					</h2>
					<p class="text-xs text-muted-foreground">
						{#if item.type === 'raw_material'}
							Ingresa la cantidad comprada y el costo total abonado. El sistema actualizará el stock y calculará el costo unitario ponderado.
						{:else}
							Ingresa la cantidad producida. Se actualizará el stock de esta elaboración y se descontarán los ingredientes de la receta según el stock disponible.
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
								{formatQuantity(item.currentStock)} <span class="text-xs font-normal text-muted-foreground">{item.baseUnit}</span>
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
									<p class="text-[10px] text-muted-foreground">según receta</p>
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
					<div class="flex items-center justify-between rounded-xl border border-dashed border-border bg-muted/20 px-3.5 py-2.5 text-xs text-muted-foreground">
						<div class="flex items-center gap-2">
							<Info class="size-4 text-muted-foreground" />
							<span>Esta elaboración aún no tiene ingredientes en su receta.</span>
						</div>
						{#if onOpenRecipeStructure}
							<button
								type="button"
								class="inline-flex items-center gap-1 font-semibold text-primary hover:underline cursor-pointer"
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
					use:enhance={() => {
						isSubmittingStock = true;
						return async ({ result, update }) => {
							await update();
							isSubmittingStock = false;
							if (result.type === 'success') {
								handleClose();
							}
						};
					}}
				>
					<input type="hidden" name="businessId" value={businessId} />
					<input type="hidden" name="id" value={item.id} />

					<div class="grid grid-cols-1 gap-4 {item.type === 'raw_material' ? 'sm:grid-cols-2' : ''}">
						<!-- Cantidad Comprada / Producida con NumberStepper al estilo /ui-design -->
						<div class="space-y-1.5">
							<div class="flex items-center gap-2">
								<Label for="stock-intake-qty" class="text-xs font-semibold text-foreground">
									{item.type === 'raw_material' ? 'Cantidad Comprada' : 'Cantidad Producida'}
								</Label>
								<span class="font-mono text-xs font-bold text-primary">
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

								<!-- A la derecha del input la info de máximo disponible con símbolo de caja (Package) -->
								{#if item.type === 'prepared' && maxProducible !== null}
									{#if maxProducible > 0}
										<button
											type="button"
											onclick={() => {
												stockIntakeQty = maxProducible;
											}}
											class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 font-mono text-xs font-bold text-foreground shadow-2xs hover:border-primary hover:bg-primary/5 hover:text-primary active:scale-95 transition-all cursor-pointer"
											title={bottleneckComponents.length > 0 ? `Limitado por: ${bottleneckComponents.map(b => `${b.component.name} (${formatQuantity(b.currentStock)} ${b.component.baseUnit})`).join(', ')}` : 'Cargar capacidad máxima'}
										>
											<Package class="size-3.5 text-primary" />
											<span>Máx: {formatQuantity(maxProducible)} {item.baseUnit}</span>
										</button>
									{:else}
										<div
											class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 font-mono text-xs font-bold text-destructive"
											title={bottleneckComponents.length > 0 ? `Sin stock en: ${bottleneckComponents.map(b => b.component.name).join(', ')}` : 'Sin stock disponible'}
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
										title="Tiempo estimado (tanda completa u horneado fijo)"
									>
										<Clock class="size-3.5 text-secondary shrink-0" />
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

					<!-- Panel en Vivo: Consumo de Receta y Stock Resultante para Elaborados -->
					{#if item.type === 'prepared' && hasRecipe}
						{@const inputQty = typeof stockIntakeQty === 'number' && stockIntakeQty > 0 ? stockIntakeQty : 0}
						<div class="space-y-2.5 rounded-xl border border-border bg-card p-3.5 shadow-2xs">
							<div class="flex h-7 items-center justify-between gap-2 border-b border-border/60 pb-2">
								<div class="flex items-center gap-2">
									<Layers class="size-4 text-secondary" />
									<h3 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
										Consumo de Receta
									</h3>
								</div>
								<div class="flex h-5 items-center">
									{#if inputQty > 0 && hasAnyDeficit}
										<span
											class="inline-flex items-center gap-1 font-mono text-xs font-bold text-destructive"
										>
											<TriangleAlert class="size-3.5" />
											<span>{deficitCount} {deficitCount === 1 ? 'insuficiente' : 'insuficientes'}</span>
										</span>
									{/if}
								</div>
							</div>

							<!-- Lista de ingredientes / elaborados componentes -->
							<div class="space-y-1.5 max-h-56 overflow-y-auto pr-1">
								{#each impacts as imp (imp.node.lineId)}
									{@const isPrepared = imp.component.type === 'prepared'}
									{@const remainingPct = imp.currentStock > 0
										? Math.max(0, Math.min(100, Math.round((imp.remainingStock / imp.currentStock) * 100)))
										: 0}
									<div
										class="rounded-lg border px-3 py-2 transition-colors {imp.isDeficit
											? 'border-destructive/40 bg-destructive/5'
											: imp.isLowStock
												? 'border-amber-500/30 bg-amber-500/5'
												: 'border-border/50 bg-muted/10'}"
									>
										<div class="flex flex-wrap items-center justify-between gap-2 text-xs">
											<!-- Nombre, Código y Badge de Tipo -->
											<div class="flex items-center gap-2 min-w-0">
												<span
													class="size-2 shrink-0 rounded-full {imp.isDeficit
														? 'bg-destructive animate-pulse'
														: imp.isLowStock
															? 'bg-amber-500'
															: 'bg-emerald-500'}"
													title={imp.isDeficit
														? 'Stock insuficiente'
														: imp.isLowStock
															? 'Quedará en stock bajo'
															: 'Stock suficiente'}
												></span>
												<span class="font-mono text-[10px] font-bold text-muted-foreground">
													{imp.component.code}
												</span>
												<span class="font-semibold text-foreground truncate max-w-[140px] sm:max-w-[200px]" title={imp.component.name}>
													{imp.component.name}
												</span>
												<span
													class="rounded px-1.5 py-0.2 font-mono text-[9px] font-semibold {isPrepared
														? 'border border-secondary/30 bg-secondary/15 text-secondary'
														: 'border border-tertiary/40 bg-tertiary/20 text-yellow-900 dark:text-yellow-300'}"
												>
													{isPrepared ? 'ELB' : 'INS'}
												</span>
											</div>

											<!-- Consumo y Stock Resultante con símbolo de caja (Package) -->
											<div class="flex items-center gap-3 font-mono text-xs shrink-0">
												<!-- Consumo -->
												<span
													class="font-bold {inputQty > 0
														? 'text-destructive dark:text-red-400'
														: 'text-muted-foreground'}"
												>
													{inputQty > 0
														? `-${formatQuantity(imp.consumedForInput)}`
														: `${formatQuantity(imp.requiredPerParentUnit)}/u`} {imp.component.baseUnit}
												</span>

												<span class="text-muted-foreground/30">|</span>

												<!-- Stock con símbolo de caja 📦 -->
												<div class="flex items-center gap-1.5">
													<Package class="size-3.5 text-muted-foreground shrink-0" />
													{#if inputQty > 0}
														{#if imp.isDeficit}
															<span class="font-bold text-destructive">
																Faltan {formatQuantity(imp.deficitQty)} {imp.component.baseUnit}
															</span>
														{:else}
															<span class="text-foreground">
																{formatQuantity(imp.currentStock)} → <strong class="font-bold">{formatQuantity(imp.remainingStock)}</strong> {imp.component.baseUnit}
															</span>
														{/if}
													{:else}
														<span class="text-muted-foreground">
															{formatQuantity(imp.currentStock)} {imp.component.baseUnit}
														</span>
													{/if}
												</div>
											</div>
										</div>

										<!-- Barra visual de stock remanente: comienza en 100% y desciende al descontar -->
										<div class="mt-1.5 flex items-center gap-2">
											<div class="h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
												<div
													class="h-full rounded-full transition-all duration-300 {imp.isDeficit
														? 'bg-destructive'
														: imp.isLowStock
															? 'bg-amber-500'
															: 'bg-emerald-500'}"
													style="width: {inputQty > 0 ? remainingPct : 100}%"
												></div>
											</div>
											<span class="w-7 text-right font-mono text-[9px] text-muted-foreground shrink-0">
												{inputQty > 0 ? `${remainingPct}%` : '100%'}
											</span>
										</div>
									</div>
								{/each}
							</div>

							<!-- Advertencia si la cantidad supera el stock existente -->
							{#if hasAnyDeficit}
								<div class="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
									<TriangleAlert class="size-4 shrink-0 mt-0.5" />
									<span>
										<strong>Stock insuficiente:</strong> La cantidad a elaborar excede los ingredientes disponibles en {deficitCount} componente{deficitCount === 1 ? '' : 's'}. Si continúas, esos componentes se consumirán hasta agotarse a 0.
									</span>
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
													<!-- Para elaboraciones: mostramos cuánto se cargó / restante -->
													<p class="font-mono text-xs font-bold text-foreground">
														+{formatQuantity(batch.initialQuantity)} {item.baseUnit} <span class="text-[11px] font-normal text-muted-foreground">cargados</span>
													</p>
													<p class="font-mono text-[11px] text-muted-foreground">
														{formatQuantity(batch.remainingQuantity)} {item.baseUnit} disponible{batch.remainingQuantity === 1 ? '' : 's'}
													</p>
												{/if}
											</div>

											<!-- Botón para disparar modal de confirmación -->
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
					disabled={isSubmittingStock}
				>
					Cancelar
				</Button>
				<Button
					type="submit"
					form="add-stock-form"
					disabled={isSubmittingStock ||
						!stockIntakeQty ||
						Number(stockIntakeQty) <= 0 ||
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
			class="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
			role="dialog"
			aria-modal="true"
		>
			<div
				class="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150"
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
									Se descontarán los <strong class="font-mono">{formatQuantity(batchToDelete.remainingQuantity)} {item.baseUnit}</strong> del stock de esta elaboración y se <strong>restaurarán automáticamente todos los insumos e ingredientes</strong> consumidos en esta tanda a sus inventarios correspondientes.
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
						use:enhance={() => {
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
