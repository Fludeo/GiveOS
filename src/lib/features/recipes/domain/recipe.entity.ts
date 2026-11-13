import {
	convertQuantity,
	isRecipeDivisible,
	type Item,
	type UnitOfMeasure
} from '#lib/features/items/domain/item.entity';

export interface RecipeLine {
	id: string;
	parentItemId: string;
	componentItemId: string;
	quantity: number;
	unit: UnitOfMeasure;
	notes: string | null;
	sortOrder: number;
}

export interface RecipeLineWithComponent extends RecipeLine {
	component: Item;
}

export interface CreateRecipeLineInput {
	parentItemId: string;
	componentItemId: string;
	quantity: number;
	unit: UnitOfMeasure;
	notes?: string | null;
	sortOrder?: number;
}

export interface UpdateRecipeLineInput {
	quantity?: number;
	unit?: UnitOfMeasure;
	notes?: string | null;
	sortOrder?: number;
}

export interface RecipeTreeNode {
	lineId: string;
	parentItemId: string;
	component: Item;
	quantity: number;
	unit: UnitOfMeasure;
	notes: string | null;
	depth: number;
	/** Costo unitario efectivo del componente en su unidad base (calculado recursivamente si tiene sub-receta) */
	componentUnitCost: number;
	/** Costo estimado de esta línea en la receta padre */
	estimatedLineCost: number;
	/** Hijos si este componente es a su vez un sub-ensamble con su propia receta */
	children: RecipeTreeNode[];
}

export interface RecipeTree {
	rootItem: Item;
	nodes: RecipeTreeNode[];
	/** Costo total estimado para el lote de rendimiento (yieldQuantity) del ítem raíz (insumos + costos operativos) */
	estimatedTotalCost: number;
	/** Costo estimado por 1 unidad base del ítem raíz */
	estimatedUnitCost: number;
	/** Desglose de costos de insumos vs operativos */
	ingredientTotalCost?: number;
	operationalTotalCost?: number;
	activeMinutes?: number;
	passiveMinutes?: number;
}

export interface SimulatedSubAssemblyStep {
	item: Item;
	/** Cantidad total requerida por las recetas padre en unidad base */
	requiredQty: number;
	/** Cantidad tomada del stock existente del elaborado antes de auto-producir */
	usedFromStockQty: number;
	/** Cantidad faltante que obligó a auto-producir este elaborado */
	deficitQty: number;
	/** Cantidad total auto-producida (redondeada al lote yieldQuantity si es Tanda Fija) */
	autoProducedQty: number;
	/** Cantidad de tandas auto-producidas (autoProducedQty / yieldQuantity) */
	batchesAutoProduced: number;
	/** Excedente neto que quedará guardado en stock tras auto-producir la tanda */
	surplusToStockQty: number;
	/** Stock final proyectado del elaborado */
	projectedFinalStock: number;
	/** Si el elaborado es divisible por unidad (true) o Tanda Fija (false) */
	isDivisible: boolean;
	/** Si el elaborado es Make-to-Order (sin stock físico) */
	isMakeToOrder: boolean;
	/** Si falta receta para poder auto-producirlo cuando no alcanza su stock */
	missingRecipeError: boolean;
}

export interface SimulatedRawMaterialUsage {
	item: Item;
	/** Cantidad total requerida en unidad base del insumo (sumando todos los niveles) */
	requiredQty: number;
	/** Stock actual disponible del insumo */
	availableStock: number;
	/** Cantidad faltante si requiredQty > availableStock */
	shortageQty: number;
	/** Stock final proyectado después de producir */
	projectedFinalStock: number;
	/** Si no alcanza el stock actual (bloquea la producción) */
	isShortage: boolean;
	/** Si el stock restante queda igual o por debajo del stock mínimo */
	isLowStock: boolean;
}

export interface ProductionSimulationResult {
	rootItem: Item | null;
	producedQty: number;
	rootHasRecipe: boolean;
	subAssemblies: SimulatedSubAssemblyStep[];
	rawMaterials: SimulatedRawMaterialUsage[];
	/** Si se puede ejecutar la producción (tiene receta y todos los insumos alcanzan) */
	canProduce: boolean;
	/** Lista de razones de bloqueo legibles por el usuario */
	blockingErrors: string[];
}

function fmtQty(n: number): string {
	const rounded = Math.round(n * 100) / 100;
	return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

/**
 * Simula la explosión multinivel (BOM Backflushing) para fabricar `producedQty` de `rootItemId`:
 * 1. Consume primero el stock disponible de los sub-elaborados intermedios (salvo Make-to-Order).
 * 2. Por cualquier faltante de un sub-elaborado intermedio, lo auto-produce recursivamente:
 *    - Si el sub-elaborado es Tanda Fija (`!isRecipeDivisible`), redondea hacia arriba al múltiplo entero de `yieldQuantity` y deja el excedente como sobrante en stock.
 *    - Si el sub-elaborado es Divisible (`isRecipeDivisible`), produce exactamente la cantidad faltante.
 * 3. Acumula todos los insumos (`raw_material`) requeridos en todos los niveles y valida que su `currentStock` alcance; de lo contrario bloquea la producción.
 */
export function simulateMultiLevelProduction(input: {
	rootItemId: string;
	producedQty: number;
	itemsById: Map<string, Item>;
	linesByParent: Map<
		string,
		Array<{ componentItemId: string; quantity: number; unit: UnitOfMeasure }>
	>;
}): ProductionSimulationResult {
	const { rootItemId, producedQty, itemsById, linesByParent } = input;
	const rootItem = itemsById.get(rootItemId) ?? null;
	if (!rootItem) {
		return {
			rootItem: null,
			producedQty,
			rootHasRecipe: false,
			subAssemblies: [],
			rawMaterials: [],
			canProduce: false,
			blockingErrors: ['El ítem elaborado no existe en este negocio.']
		};
	}

	const rootLines = linesByParent.get(rootItemId) ?? [];
	if (rootLines.length === 0) {
		return {
			rootItem,
			producedQty,
			rootHasRecipe: false,
			subAssemblies: [],
			rawMaterials: [],
			canProduce: false,
			blockingErrors: [
				`La elaboración "${rootItem.name}" aún no tiene ingredientes configurados en su receta.`
			]
		};
	}

	const workingStock = new Map<string, number>();
	for (const [id, it] of itemsById.entries()) {
		workingStock.set(id, Math.max(0, it.currentStock));
	}

	const subStatsMap = new Map<
		string,
		{
			item: Item;
			requiredQty: number;
			deficitQty: number;
			autoProducedQty: number;
			missingRecipeError: boolean;
		}
	>();
	const subOrder: string[] = [];
	const rawRequiredMap = new Map<string, number>();

	const effectiveQty = Math.max(0, Number(producedQty) || 0);

	function explode(parentItem: Item, qtyToMake: number, depth: number) {
		if (depth > 25 || qtyToMake <= 0) return;
		const lines = linesByParent.get(parentItem.id) ?? [];
		const parentYield = parentItem.yieldQuantity > 0 ? parentItem.yieldQuantity : 1;
		const batchRatio = qtyToMake / parentYield;

		for (const line of lines) {
			const comp = itemsById.get(line.componentItemId);
			if (!comp) continue;

			const reqInBase = Number(
				(convertQuantity(line.quantity, line.unit, comp.baseUnit) * batchRatio).toFixed(6)
			);
			if (reqInBase <= 0) continue;

			if (comp.type === 'raw_material') {
				rawRequiredMap.set(
					comp.id,
					Number(((rawRequiredMap.get(comp.id) ?? 0) + reqInBase).toFixed(6))
				);
			} else {
				let stat = subStatsMap.get(comp.id);
				if (!stat) {
					stat = {
						item: comp,
						requiredQty: 0,
						deficitQty: 0,
						autoProducedQty: 0,
						missingRecipeError: false
					};
					subStatsMap.set(comp.id, stat);
					subOrder.push(comp.id);
				}

				stat.requiredQty = Number((stat.requiredQty + reqInBase).toFixed(6));

				const isMTO = Boolean(comp.recipeConfig?.isMakeToOrder);
				const avail = isMTO ? 0 : Math.max(0, workingStock.get(comp.id) ?? 0);
				const used = Math.min(avail, reqInBase);
				const deficit = Number(Math.max(0, reqInBase - used).toFixed(6));

				if (used > 0 && !isMTO) {
					workingStock.set(comp.id, Number(Math.max(0, avail - used).toFixed(6)));
				}

				if (deficit > 1e-6) {
					const compLines = linesByParent.get(comp.id) ?? [];
					if (compLines.length === 0) {
						stat.missingRecipeError = true;
						stat.deficitQty = Number((stat.deficitQty + deficit).toFixed(6));
					} else {
						const divisible = isRecipeDivisible(comp);
						const compYield = comp.yieldQuantity > 0 ? comp.yieldQuantity : 1;
						const autoProduce = divisible
							? deficit
							: Number((Math.ceil((deficit - 1e-9) / compYield) * compYield).toFixed(6));
						const surplus = Number(Math.max(0, autoProduce - deficit).toFixed(6));

						stat.deficitQty = Number((stat.deficitQty + deficit).toFixed(6));
						stat.autoProducedQty = Number((stat.autoProducedQty + autoProduce).toFixed(6));

						if (!isMTO && surplus > 0) {
							workingStock.set(
								comp.id,
								Number(((workingStock.get(comp.id) ?? 0) + surplus).toFixed(6))
							);
						}

						explode(comp, autoProduce, depth + 1);
					}
				}
			}
		}
	}

	if (effectiveQty > 0) {
		explode(rootItem, effectiveQty, 0);
	}

	const blockingErrors: string[] = [];
	const subAssemblies: SimulatedSubAssemblyStep[] = [];

	for (const subId of subOrder) {
		const stat = subStatsMap.get(subId)!;
		const comp = stat.item;
		const isMTO = Boolean(comp.recipeConfig?.isMakeToOrder);
		const initialStock = isMTO ? 0 : Math.max(0, comp.currentStock);
		const finalWorking = isMTO ? 0 : Math.max(0, workingStock.get(comp.id) ?? 0);

		const usedFromStockQty =
			stat.autoProducedQty > 0
				? Number(initialStock.toFixed(4))
				: Number(Math.max(0, initialStock - finalWorking).toFixed(4));
		const surplusToStockQty =
			stat.autoProducedQty > 0 && !isMTO ? Number(finalWorking.toFixed(4)) : 0;
		const projectedFinalStock = isMTO ? comp.currentStock : Number(finalWorking.toFixed(4));
		const compYield = comp.yieldQuantity > 0 ? comp.yieldQuantity : 1;
		const batchesAutoProduced =
			stat.autoProducedQty > 0 ? Number((stat.autoProducedQty / compYield).toFixed(2)) : 0;

		if (stat.missingRecipeError) {
			blockingErrors.push(
				`Falta stock del elaborado intermedio "${comp.name}" (necesitas ${fmtQty(stat.requiredQty)} ${comp.baseUnit}, disponible: ${fmtQty(initialStock)} ${comp.baseUnit}) y no tiene receta configurada para auto-producirlo.`
			);
		}

		subAssemblies.push({
			item: comp,
			requiredQty: Number(stat.requiredQty.toFixed(4)),
			usedFromStockQty,
			deficitQty: Number(stat.deficitQty.toFixed(4)),
			autoProducedQty: Number(stat.autoProducedQty.toFixed(4)),
			batchesAutoProduced,
			surplusToStockQty,
			projectedFinalStock,
			isDivisible: isRecipeDivisible(comp),
			isMakeToOrder: isMTO,
			missingRecipeError: stat.missingRecipeError
		});
	}

	const rawMaterials: SimulatedRawMaterialUsage[] = [];
	for (const [rawId, reqQty] of rawRequiredMap.entries()) {
		const rawItem = itemsById.get(rawId);
		if (!rawItem) continue;

		const availableStock = Math.max(0, rawItem.currentStock);
		const requiredQty = Number(reqQty.toFixed(4));
		const shortageQty = Number(Math.max(0, requiredQty - availableStock).toFixed(4));
		const isShortage = shortageQty > 1e-4;
		const projectedFinalStock = Number(Math.max(0, availableStock - requiredQty).toFixed(4));
		const isLowStock =
			!isShortage && rawItem.minStock > 0 && projectedFinalStock <= rawItem.minStock;

		if (isShortage) {
			blockingErrors.push(
				`Stock insuficiente de "${rawItem.name}": necesitas ${fmtQty(requiredQty)} ${rawItem.baseUnit} y hay ${fmtQty(availableStock)} ${rawItem.baseUnit} disponibles (faltan ${fmtQty(shortageQty)} ${rawItem.baseUnit}).`
			);
		}

		rawMaterials.push({
			item: rawItem,
			requiredQty,
			availableStock,
			shortageQty,
			projectedFinalStock,
			isShortage,
			isLowStock
		});
	}

	return {
		rootItem,
		producedQty: effectiveQty,
		rootHasRecipe: true,
		subAssemblies,
		rawMaterials,
		canProduce: effectiveQty > 0 && blockingErrors.length === 0,
		blockingErrors
	};
}

/**
 * Calcula la cantidad máxima de `rootItemId` que puede producirse con el stock actual
 * (considerando tanto el stock de sub-elaborados intermedios como el stock de materias primas y lotes fijos).
 */
export function calculateMaxProducibleQuantity(input: {
	rootItemId: string;
	itemsById: Map<string, Item>;
	linesByParent: Map<
		string,
		Array<{ componentItemId: string; quantity: number; unit: UnitOfMeasure }>
	>;
}): { maxQuantity: number; bottleneckNames: string[] } {
	const { rootItemId, itemsById, linesByParent } = input;
	const rootItem = itemsById.get(rootItemId);
	const rootLines = linesByParent.get(rootItemId) ?? [];
	if (!rootItem || rootLines.length === 0) {
		return { maxQuantity: 0, bottleneckNames: [] };
	}

	const divisible = isRecipeDivisible(rootItem);
	const yieldQty = rootItem.yieldQuantity > 0 ? rootItem.yieldQuantity : 1;
	const step = divisible ? (rootItem.baseUnit === 'unit' ? 1 : 0.1) : yieldQty;

	const firstSim = simulateMultiLevelProduction({
		rootItemId,
		producedQty: step,
		itemsById,
		linesByParent
	});

	if (!firstSim.canProduce) {
		const bottlenecks = [
			...firstSim.subAssemblies.filter((s) => s.missingRecipeError).map((s) => s.item.name),
			...firstSim.rawMaterials.filter((r) => r.isShortage).map((r) => r.item.name)
		];
		return { maxQuantity: 0, bottleneckNames: bottlenecks };
	}

	let lowSteps = 1;
	let highSteps = 2;
	while (highSteps < 10000) {
		const sim = simulateMultiLevelProduction({
			rootItemId,
			producedQty: Number((highSteps * step).toFixed(4)),
			itemsById,
			linesByParent
		});
		if (!sim.canProduce) break;
		lowSteps = highSteps;
		highSteps *= 2;
	}

	let bestSteps = lowSteps;
	let left = lowSteps;
	let right = highSteps - 1;
	while (left <= right) {
		const mid = Math.floor((left + right) / 2);
		const sim = simulateMultiLevelProduction({
			rootItemId,
			producedQty: Number((mid * step).toFixed(4)),
			itemsById,
			linesByParent
		});
		if (sim.canProduce) {
			bestSteps = mid;
			left = mid + 1;
		} else {
			right = mid - 1;
		}
	}

	const nextSim = simulateMultiLevelProduction({
		rootItemId,
		producedQty: Number(((bestSteps + 1) * step).toFixed(4)),
		itemsById,
		linesByParent
	});
	const bottlenecks = [
		...nextSim.subAssemblies.filter((s) => s.missingRecipeError).map((s) => s.item.name),
		...nextSim.rawMaterials.filter((r) => r.isShortage).map((r) => r.item.name)
	];

	return {
		maxQuantity: Number((bestSteps * step).toFixed(2)),
		bottleneckNames: bottlenecks
	};
}
