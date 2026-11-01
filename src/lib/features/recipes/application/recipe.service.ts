import { v7 as uuidv7 } from 'uuid';
import {
	applyStockConsumption,
	applyStockRestoration,
	areUnitsCompatible,
	calculateRecipeConsumption,
	calculateRecipeOperationalSummary,
	convertQuantity,
	getDirectUnitCost,
	trimStockBatches,
	type Item,
	type ItemStockBatch,
	type ProductionLedgerEntry
} from '#lib/features/items/domain/item.entity';
import type { IItemRepository } from '#lib/features/items/domain/item.repository';
import {
	simulateMultiLevelProduction,
	type RecipeLine,
	type RecipeTree,
	type RecipeTreeNode,
	type CreateRecipeLineInput,
	type UpdateRecipeLineInput
} from '../domain/recipe.entity';
import type { IRecipeRepository } from '../domain/recipe.repository';

export class RecipeService {
	constructor(
		private readonly recipeRepo: IRecipeRepository,
		private readonly itemRepo: IItemRepository
	) {}

	async addLine(businessId: string, input: CreateRecipeLineInput): Promise<RecipeLine> {
		if (input.parentItemId === input.componentItemId) {
			throw new Error('Un ítem no puede ser ingrediente/componente de sí mismo.');
		}
		if (input.quantity <= 0) {
			throw new Error('La cantidad debe ser mayor a 0.');
		}

		const [parent, component] = await Promise.all([
			this.itemRepo.findById(input.parentItemId, businessId),
			this.itemRepo.findById(input.componentItemId, businessId)
		]);

		if (!parent) throw new Error('El ítem padre no existe en este negocio.');
		if (!component) throw new Error('El ingrediente o componente seleccionado no existe en este negocio.');

		if (!areUnitsCompatible(input.unit, component.baseUnit)) {
			throw new Error(
				`La unidad seleccionada (${input.unit}) no es compatible con la unidad base del componente (${component.baseUnit}).`
			);
		}

		const allLines = await this.recipeRepo.findAllLinesByBusiness(businessId);
		if (this.wouldCreateCycle(input.parentItemId, input.componentItemId, allLines)) {
			throw new Error(
				'No se puede agregar este componente porque generaría una referencia circular en la Estructura de Recetas.'
			);
		}

		return this.recipeRepo.createLine(input);
	}

	async updateLine(
		businessId: string,
		id: string,
		input: UpdateRecipeLineInput
	): Promise<RecipeLine> {
		const existing = await this.recipeRepo.findLineById(id);
		if (!existing) throw new Error('Línea de receta no encontrada.');

		const parent = await this.itemRepo.findById(existing.parentItemId, businessId);
		if (!parent) throw new Error('No tienes permiso para modificar esta línea de la receta.');

		if (input.quantity !== undefined && input.quantity <= 0) {
			throw new Error('La cantidad debe ser mayor a 0.');
		}

		if (input.unit) {
			const component = await this.itemRepo.findById(existing.componentItemId, businessId);
			if (component && !areUnitsCompatible(input.unit, component.baseUnit)) {
				throw new Error(
					`La unidad (${input.unit}) no es compatible con la unidad base del componente (${component.baseUnit}).`
				);
			}
		}

		const updated = await this.recipeRepo.updateLine(id, input);
		if (!updated) throw new Error('No se pudo actualizar la línea de la receta.');
		return updated;
	}

	async removeLine(businessId: string, id: string): Promise<void> {
		const existing = await this.recipeRepo.findLineById(id);
		if (!existing) throw new Error('Línea de receta no encontrada.');

		const parent = await this.itemRepo.findById(existing.parentItemId, businessId);
		if (!parent) throw new Error('No tienes permiso para eliminar esta línea de la receta.');

		const ok = await this.recipeRepo.deleteLine(id);
		if (!ok) throw new Error('No se pudo eliminar la línea de la receta.');
	}

	private buildRecipeTreeFromMaps(
		rootItemId: string,
		itemsById: Map<string, Item>,
		linesByParent: Map<string, RecipeLine[]>
	): RecipeTree | null {
		const rootItem = itemsById.get(rootItemId);
		if (!rootItem) return null;

		const buildNodes = (
			parentId: string,
			depth: number,
			visited: Set<string>
		): RecipeTreeNode[] => {
			const directLines = linesByParent.get(parentId) ?? [];
			const nodes: RecipeTreeNode[] = [];

			for (const line of directLines) {
				const component = itemsById.get(line.componentItemId);
				if (!component) continue;

				const nextVisited = new Set(visited);
				let children: RecipeTreeNode[] = [];
				if (!nextVisited.has(component.id)) {
					nextVisited.add(component.id);
					children = buildNodes(component.id, depth + 1, nextVisited);
				}

				let componentUnitCost = getDirectUnitCost(component);
				if (children.length > 0) {
					const subIngredientCost = children.reduce(
						(acc, child) => acc + child.estimatedLineCost,
						0
					);
					const subOpSummary = calculateRecipeOperationalSummary(
						component.recipeConfig,
						component.prepTimeMinutes,
						component.passiveTimeMinutes,
						Boolean(component.isPrepTimeScalable),
						component.yieldQuantity
					);
					const subRecipeTotalCost = subIngredientCost + subOpSummary.operationalTotalCost;
					const yieldQty = component.yieldQuantity > 0 ? component.yieldQuantity : 1;
					componentUnitCost = subRecipeTotalCost / yieldQty;
				} else if (component.type === 'prepared' && component.recipeConfig?.operationalCosts?.length) {
					const subOpSummary = calculateRecipeOperationalSummary(
						component.recipeConfig,
						component.prepTimeMinutes,
						component.passiveTimeMinutes,
						Boolean(component.isPrepTimeScalable),
						component.yieldQuantity
					);
					componentUnitCost = getDirectUnitCost(component) + subOpSummary.operationalUnitCost;
				}

				const quantityInComponentBaseUnit = convertQuantity(
					line.quantity,
					line.unit,
					component.baseUnit
				);
				const estimatedLineCost = quantityInComponentBaseUnit * componentUnitCost;

				nodes.push({
					lineId: line.id,
					parentItemId: parentId,
					component,
					quantity: line.quantity,
					unit: line.unit,
					notes: line.notes,
					depth,
					componentUnitCost,
					estimatedLineCost,
					children
				});
			}

			return nodes;
		};

		const nodes = buildNodes(rootItem.id, 0, new Set([rootItem.id]));
		const ingredientTotalCost =
			nodes.length > 0
				? nodes.reduce((sum, n) => sum + n.estimatedLineCost, 0)
				: rootItem.referenceCost;

		const opSummary = calculateRecipeOperationalSummary(
			rootItem.recipeConfig,
			rootItem.prepTimeMinutes,
			rootItem.passiveTimeMinutes,
			Boolean(rootItem.isPrepTimeScalable),
			rootItem.yieldQuantity
		);

		const estimatedTotalCost = Math.round((ingredientTotalCost + opSummary.operationalTotalCost) * 100) / 100;
		const yieldQty = rootItem.yieldQuantity > 0 ? rootItem.yieldQuantity : 1;
		const estimatedUnitCost =
			nodes.length > 0
				? Math.round((estimatedTotalCost / yieldQty) * 100) / 100
				: Math.round((getDirectUnitCost(rootItem) + opSummary.operationalUnitCost) * 100) / 100;

		return {
			rootItem,
			nodes,
			estimatedTotalCost,
			estimatedUnitCost,
			ingredientTotalCost,
			operationalTotalCost: opSummary.operationalTotalCost,
			activeMinutes: opSummary.activeMinutes,
			passiveMinutes: opSummary.passiveMinutes
		};
	}

	/**
	 * Construye el árbol de receta multinivel completo de un ítem del negocio y calcula costos de referencia en cascada.
	 */
	async getRecipeTree(businessId: string, rootItemId: string): Promise<RecipeTree | null> {
		const [allItems, allLines] = await Promise.all([
			this.itemRepo.findAllByBusiness(businessId),
			this.recipeRepo.findAllLinesByBusiness(businessId)
		]);

		const itemsById = new Map<string, Item>(allItems.map((item) => [item.id, item]));
		const linesByParent = new Map<string, RecipeLine[]>();
		for (const line of allLines) {
			const list = linesByParent.get(line.parentItemId) ?? [];
			list.push(line);
			linesByParent.set(line.parentItemId, list);
		}

		return this.buildRecipeTreeFromMaps(rootItemId, itemsById, linesByParent);
	}

	/**
	 * Devuelve un resumen rápido del conteo de ingredientes directos y costo estimado para todos los ítems del negocio.
	 */
	async getAllRecipeSummaries(
		businessId: string
	): Promise<
		Record<
			string,
			{
				directComponentsCount: number;
				estimatedTotalCost: number;
				estimatedUnitCost: number;
				ingredientTotalCost?: number;
				operationalTotalCost?: number;
				activeMinutes?: number;
				passiveMinutes?: number;
				nodes: RecipeTreeNode[];
			}
		>
	> {
		const [allItems, allLines] = await Promise.all([
			this.itemRepo.findAllByBusiness(businessId),
			this.recipeRepo.findAllLinesByBusiness(businessId)
		]);

		const itemsById = new Map<string, Item>(allItems.map((item) => [item.id, item]));
		const linesByParent = new Map<string, RecipeLine[]>();
		const directCounts = new Map<string, number>();

		for (const line of allLines) {
			const list = linesByParent.get(line.parentItemId) ?? [];
			list.push(line);
			linesByParent.set(line.parentItemId, list);
			directCounts.set(line.parentItemId, (directCounts.get(line.parentItemId) ?? 0) + 1);
		}

		const summaries: Record<
			string,
			{
				directComponentsCount: number;
				estimatedTotalCost: number;
				estimatedUnitCost: number;
				ingredientTotalCost?: number;
				operationalTotalCost?: number;
				activeMinutes?: number;
				passiveMinutes?: number;
				nodes: RecipeTreeNode[];
			}
		> = {};

		for (const item of allItems) {
			const tree = this.buildRecipeTreeFromMaps(item.id, itemsById, linesByParent);
			summaries[item.id] = {
				directComponentsCount: directCounts.get(item.id) ?? 0,
				estimatedTotalCost: tree?.estimatedTotalCost ?? item.referenceCost,
				estimatedUnitCost: tree?.estimatedUnitCost ?? getDirectUnitCost(item),
				ingredientTotalCost: tree?.ingredientTotalCost,
				operationalTotalCost: tree?.operationalTotalCost,
				activeMinutes: tree?.activeMinutes,
				passiveMinutes: tree?.passiveMinutes,
				nodes: tree?.nodes ?? []
			};
		}

		return summaries;
	}

	/**
	 * Produce `producedQty` (en la unidad base del ítem padre) con explosión multinivel (BOM Backflushing):
	 * 1. Valida que la receta tenga ingredientes y que todos los insumos base (`raw_material`) alcancen; de lo contrario bloquea con error.
	 * 2. Para cada sub-elaborado intermedio (`prepared`), consume primero su stock disponible y, si falta, auto-produce la cantidad necesaria
	 *    (respetando `yieldQuantity` en Tanda Fija y dejando el excedente en stock, o exacto si es Divisible).
	 * 3. Descuenta todos los insumos base consumidos y suma `+producedQty` al ítem padre.
	 */
	async produceItemBatch(
		businessId: string,
		parentItemId: string,
		producedQty: number,
		notes?: string | null
	): Promise<{ parent: Item; consumedComponents: Array<{ item: Item; consumedQty: number }> }> {
		if (producedQty <= 0) {
			throw new Error('La cantidad a producir debe ser mayor a 0.');
		}

		const [allItems, allLines] = await Promise.all([
			this.itemRepo.findAllByBusiness(businessId),
			this.recipeRepo.findAllLinesByBusiness(businessId)
		]);

		const itemsById = new Map<string, Item>(allItems.map((i) => [i.id, i]));
		const parent = itemsById.get(parentItemId);
		if (!parent) {
			throw new Error('El ítem a producir no existe en este negocio.');
		}

		const linesByParent = new Map<string, RecipeLine[]>();
		for (const line of allLines) {
			const list = linesByParent.get(line.parentItemId) ?? [];
			list.push(line);
			linesByParent.set(line.parentItemId, list);
		}

		const simulation = simulateMultiLevelProduction({
			rootItemId: parentItemId,
			producedQty,
			itemsById,
			linesByParent
		});

		if (!simulation.canProduce) {
			throw new Error(
				simulation.blockingErrors.join(' ') ||
					'No hay insumos suficientes para registrar esta producción.'
			);
		}

		const consumedComponents: Array<{ item: Item; consumedQty: number }> = [];
		const productionLedger: ProductionLedgerEntry[] = [];
		let totalConsumedIngredientsCost = 0;

		// 1. Procesar sub-elaborados intermedios (consumo de stock existente y/o alta de excedentes de tanda fija)
		for (const sub of simulation.subAssemblies) {
			const comp = itemsById.get(sub.item.id);
			if (!comp) continue;

			let newBatches = comp.batches ?? [];
			let newRefCost = comp.referenceCost;

			if (sub.usedFromStockQty > 0) {
				if (newBatches.length > 0) {
					const res = applyStockConsumption(newBatches, sub.usedFromStockQty, newRefCost);
					newBatches = res.batches;
					newRefCost = res.newReferenceCost;
					totalConsumedIngredientsCost += res.consumedCost;
				} else {
					const subTree = this.buildRecipeTreeFromMaps(comp.id, itemsById, linesByParent);
					totalConsumedIngredientsCost +=
						sub.usedFromStockQty * (subTree?.estimatedUnitCost ?? getDirectUnitCost(comp));
				}
			}

			let surplusBatchId: string | undefined;
			if (sub.surplusToStockQty > 0) {
				const subTree = this.buildRecipeTreeFromMaps(comp.id, itemsById, linesByParent);
				const subUnitCost = subTree?.estimatedUnitCost ?? getDirectUnitCost(comp);
				surplusBatchId = uuidv7();
				const surplusBatch: ItemStockBatch = {
					id: surplusBatchId,
					createdAt: new Date().toISOString(),
					initialQuantity: sub.autoProducedQty,
					remainingQuantity: sub.surplusToStockQty,
					totalCost: Math.round(sub.autoProducedQty * subUnitCost * 100) / 100,
					unitCost: Math.round(subUnitCost * 10000) / 10000,
					notes: `Sobrante de tanda (auto-producción para ${parent.name})`
				};
				newBatches = trimStockBatches([...newBatches, surplusBatch]);
			}

			if (sub.usedFromStockQty > 0 || sub.surplusToStockQty > 0) {
				const updatedSub = await this.itemRepo.update(comp.id, businessId, {
					currentStock: sub.projectedFinalStock,
					referenceCost: newRefCost,
					batches: newBatches
				});
				if (updatedSub) {
					itemsById.set(comp.id, updatedSub);
					consumedComponents.push({ item: updatedSub, consumedQty: sub.requiredQty });
				}
				productionLedger.push({
					itemId: comp.id,
					consumedFromStockQty: sub.usedFromStockQty,
					surplusAddedQty: sub.surplusToStockQty,
					...(surplusBatchId ? { surplusBatchId } : {})
				});
			}
		}

		// 2. Procesar materias primas / insumos base
		for (const raw of simulation.rawMaterials) {
			const comp = itemsById.get(raw.item.id);
			if (!comp || raw.requiredQty <= 0) continue;

			let newBatches = comp.batches ?? [];
			let newRefCost = comp.referenceCost;
			if (newBatches.length > 0) {
				const res = applyStockConsumption(newBatches, raw.requiredQty, comp.referenceCost);
				newBatches = res.batches;
				newRefCost = res.newReferenceCost;
				totalConsumedIngredientsCost += res.consumedCost;
			} else {
				totalConsumedIngredientsCost += raw.requiredQty * getDirectUnitCost(comp);
			}

			const updatedRaw = await this.itemRepo.update(comp.id, businessId, {
				currentStock: raw.projectedFinalStock,
				referenceCost: newRefCost,
				batches: newBatches
			});
			if (updatedRaw) {
				itemsById.set(comp.id, updatedRaw);
				consumedComponents.push({ item: updatedRaw, consumedQty: raw.requiredQty });
			}
			productionLedger.push({
				itemId: comp.id,
				consumedFromStockQty: raw.requiredQty,
				surplusAddedQty: 0
			});
		}

		const parentOpSummary = calculateRecipeOperationalSummary(
			parent.recipeConfig,
			parent.prepTimeMinutes,
			parent.passiveTimeMinutes,
			Boolean(parent.isPrepTimeScalable),
			parent.yieldQuantity
		);
		const parentTree = this.buildRecipeTreeFromMaps(parent.id, itemsById, linesByParent);
		const estimatedBatchCost =
			parentTree && parentTree.estimatedUnitCost > 0
				? Math.round(parentTree.estimatedUnitCost * producedQty * 100) / 100
				: Math.round(
						(totalConsumedIngredientsCost + parentOpSummary.operationalUnitCost * producedQty) * 100
					) / 100;
		const batchTotalCost =
			estimatedBatchCost > 0
				? estimatedBatchCost
				: Math.round(
						(totalConsumedIngredientsCost + parentOpSummary.operationalUnitCost * producedQty) * 100
					) / 100;
		const batchUnitCost =
			producedQty > 0 ? Math.round((batchTotalCost / producedQty) * 10000) / 10000 : 0;

		const nextParentStock = Math.round((parent.currentStock + producedQty) * 10000) / 10000;
		const newBatch: ItemStockBatch = {
			id: uuidv7(),
			createdAt: new Date().toISOString(),
			initialQuantity: producedQty,
			remainingQuantity: producedQty,
			totalCost: batchTotalCost,
			unitCost: batchUnitCost,
			notes: notes?.trim() || null,
			productionLedger
		};
		const currentBatches = parent.batches ?? [];
		const updatedBatches = trimStockBatches([...currentBatches, newBatch]);

		const updatedParent = await this.itemRepo.update(parent.id, businessId, {
			currentStock: nextParentStock,
			batches: updatedBatches
		});

		return {
			parent: updatedParent ?? parent,
			consumedComponents
		};
	}

	/**
	 * Revierte una carga de producción de elaboración:
	 * 1. Descuenta remainingQuantity del ítem padre y remueve el batch.
	 * 2. Si el batch cuenta con `productionLedger`, revierte con exactitud los consumos y retira los sobrantes de tanda generados.
	 *    Para lotes antiguos sin `productionLedger`, utiliza el cálculo proporcional de respaldo.
	 */
	async revertProducedBatch(
		businessId: string,
		parentItemId: string,
		batchId: string
	): Promise<{
		parent: Item;
		restoredComponents: Array<{ item: Item; restoredQty: number }>;
		removedBatch: ItemStockBatch;
	}> {
		const [allItems, allLines] = await Promise.all([
			this.itemRepo.findAllByBusiness(businessId),
			this.recipeRepo.findAllLinesByBusiness(businessId)
		]);

		const itemsById = new Map<string, Item>(allItems.map((i) => [i.id, i]));
		const parent = itemsById.get(parentItemId);
		if (!parent) {
			throw new Error('El ítem elaborado no existe en este negocio.');
		}

		const currentBatches = parent.batches ?? [];
		const batchToDelete = currentBatches.find((b) => b.id === batchId);
		if (!batchToDelete) {
			throw new Error('El lote de elaboración seleccionado no existe.');
		}

		const restoredComponents: Array<{ item: Item; restoredQty: number }> = [];

		if (batchToDelete.productionLedger && batchToDelete.productionLedger.length > 0) {
			for (const entry of batchToDelete.productionLedger) {
				const comp = itemsById.get(entry.itemId);
				if (!comp) continue;

				let nextStock = comp.currentStock;
				let newBatches = comp.batches ?? [];
				let newRefCost = comp.referenceCost;

				if (entry.surplusAddedQty > 0) {
					nextStock = Math.max(
						0,
						Math.round((nextStock - entry.surplusAddedQty) * 10000) / 10000
					);
					if (entry.surplusBatchId) {
						newBatches = newBatches.filter((b) => b.id !== entry.surplusBatchId);
					}
				}

				if (entry.consumedFromStockQty > 0) {
					nextStock = Math.round((nextStock + entry.consumedFromStockQty) * 10000) / 10000;
					if (newBatches.length > 0) {
						const res = applyStockRestoration(
							newBatches,
							entry.consumedFromStockQty,
							newRefCost
						);
						newBatches = res.batches;
						newRefCost = res.newReferenceCost;
					}
				}

				const updatedComp = await this.itemRepo.update(comp.id, businessId, {
					currentStock: nextStock,
					referenceCost: newRefCost,
					batches: newBatches
				});

				if (updatedComp) {
					itemsById.set(comp.id, updatedComp);
					restoredComponents.push({
						item: updatedComp,
						restoredQty: entry.consumedFromStockQty
					});
				}
			}
		} else {
			const producedQty = batchToDelete.initialQuantity;
			const linesByParent = new Map<string, RecipeLine[]>();
			for (const line of allLines) {
				const list = linesByParent.get(line.parentItemId) ?? [];
				list.push(line);
				linesByParent.set(line.parentItemId, list);
			}

			const restorationsMap = new Map<string, { item: Item; qty: number }>();
			const queue: Array<{ itemId: string; qtyNeeded: number }> = [
				{ itemId: parentItemId, qtyNeeded: producedQty }
			];

			let safetyCount = 0;
			while (queue.length > 0 && safetyCount < 1000) {
				safetyCount++;
				const current = queue.shift()!;
				const currentItem = itemsById.get(current.itemId);
				if (!currentItem) continue;

				const lines = linesByParent.get(current.itemId) ?? [];
				const currentYield = currentItem.yieldQuantity > 0 ? currentItem.yieldQuantity : 1;

				for (const line of lines) {
					const comp = itemsById.get(line.componentItemId);
					if (!comp) continue;

					const requiredInCompBase = calculateRecipeConsumption(
						line.quantity,
						line.unit,
						comp.baseUnit,
						current.qtyNeeded,
						currentYield
					);

					const isMakeToOrder =
						comp.type === 'prepared' && Boolean(comp.recipeConfig?.isMakeToOrder);
					if (isMakeToOrder) {
						queue.push({ itemId: comp.id, qtyNeeded: requiredInCompBase });
					} else {
						const existing = restorationsMap.get(comp.id);
						if (existing) {
							existing.qty += requiredInCompBase;
						} else {
							restorationsMap.set(comp.id, { item: comp, qty: requiredInCompBase });
						}
					}
				}
			}

			for (const { item: comp, qty: qtyToRestore } of restorationsMap.values()) {
				const nextStock = Math.round((comp.currentStock + qtyToRestore) * 10000) / 10000;
				let newBatches = comp.batches;
				let newRefCost = comp.referenceCost;

				if (newBatches && newBatches.length > 0) {
					const res = applyStockRestoration(newBatches, qtyToRestore, comp.referenceCost);
					newBatches = res.batches;
					newRefCost = res.newReferenceCost;
				}

				const updatedComp = await this.itemRepo.update(comp.id, businessId, {
					currentStock: nextStock,
					referenceCost: newRefCost,
					batches: newBatches
				});

				if (updatedComp) {
					itemsById.set(comp.id, updatedComp);
					restoredComponents.push({ item: updatedComp, restoredQty: qtyToRestore });
				}
			}
		}

		// Descontar del padre y eliminar el lote
		const nextParentStock = Math.max(
			0,
			Math.round((parent.currentStock - batchToDelete.remainingQuantity) * 10000) / 10000
		);
		const updatedBatches = currentBatches.filter((b) => b.id !== batchId);

		const updatedParent = await this.itemRepo.update(parent.id, businessId, {
			currentStock: nextParentStock,
			batches: updatedBatches
		});

		return {
			parent: updatedParent ?? parent,
			restoredComponents,
			removedBatch: batchToDelete
		};
	}

	private wouldCreateCycle(
		parentItemId: string,
		candidateComponentId: string,
		allLines: RecipeLine[]
	): boolean {
		if (parentItemId === candidateComponentId) return true;

		const childrenMap = new Map<string, string[]>();
		for (const line of allLines) {
			const list = childrenMap.get(line.parentItemId) ?? [];
			list.push(line.componentItemId);
			childrenMap.set(line.parentItemId, list);
		}

		const stack = [candidateComponentId];
		const visited = new Set<string>();

		while (stack.length > 0) {
			const current = stack.pop()!;
			if (current === parentItemId) return true;
			if (visited.has(current)) continue;
			visited.add(current);

			const children = childrenMap.get(current) ?? [];
			for (const childId of children) {
				stack.push(childId);
			}
		}

		return false;
	}
}
