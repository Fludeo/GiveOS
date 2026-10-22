import { v7 as uuidv7 } from 'uuid';
import {
	applyStockConsumption,
	applyStockRestoration,
	areUnitsCompatible,
	calculateRecipeConsumption,
	calculateRecipeOperationalSummary,
	convertQuantity,
	getDirectUnitCost,
	type Item,
	type ItemStockBatch
} from '#lib/features/items/domain/item.entity';
import type { IItemRepository } from '#lib/features/items/domain/item.repository';
import type {
	RecipeLine,
	RecipeTree,
	RecipeTreeNode,
	CreateRecipeLineInput,
	UpdateRecipeLineInput
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

	/**
	 * Construye el árbol de receta multinivel completo de un ítem del negocio y calcula costos de referencia en cascada.
	 */
	async getRecipeTree(businessId: string, rootItemId: string): Promise<RecipeTree | null> {
		const [allItems, allLines] = await Promise.all([
			this.itemRepo.findAllByBusiness(businessId),
			this.recipeRepo.findAllLinesByBusiness(businessId)
		]);

		const itemsById = new Map<string, Item>(allItems.map((item) => [item.id, item]));
		const rootItem = itemsById.get(rootItemId);
		if (!rootItem) return null;

		const linesByParent = new Map<string, RecipeLine[]>();
		for (const line of allLines) {
			const list = linesByParent.get(line.parentItemId) ?? [];
			list.push(line);
			linesByParent.set(line.parentItemId, list);
		}

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
					const subRecipeTotalCost = children.reduce(
						(acc, child) => acc + child.estimatedLineCost,
						0
					);
					const yieldQty = component.yieldQuantity > 0 ? component.yieldQuantity : 1;
					componentUnitCost = subRecipeTotalCost / yieldQty;
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
			Boolean(rootItem.isPrepTimeScalable)
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

		const directCounts = new Map<string, number>();
		for (const line of allLines) {
			directCounts.set(line.parentItemId, (directCounts.get(line.parentItemId) ?? 0) + 1);
		}

		for (const item of allItems) {
			const tree = await this.getRecipeTree(businessId, item.id);
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
	 * Produce `producedQty` (en la unidad base del ítem padre):
	 * 1. Suma +producedQty al stock actual del ítem padre.
	 * 2. Descuenta proporcionalmente el stock de todos sus ingredientes/componentes directos de la receta.
	 *    Si un componente es `isMakeToOrder` (fabricación a demanda), no descuenta de su propio stock (que es 0),
	 *    sino que desciende recursivamente y descuenta los ingredientes de su sub-receta.
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

		// Recolectar consumos de insumos/componentes finales a descontar
		// itemId -> { item, totalQtyToDeduct }
		const deductionsMap = new Map<string, { item: Item; qty: number }>();

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

				const isMakeToOrder = comp.type === 'prepared' && Boolean(comp.recipeConfig?.isMakeToOrder);
				if (isMakeToOrder) {
					// Si es a demanda, expandir en cascada a sus propios ingredientes
					queue.push({ itemId: comp.id, qtyNeeded: requiredInCompBase });
				} else {
					// Si es insumo o elaborado tradicional con stock físico, acumular descuento
					const existing = deductionsMap.get(comp.id);
					if (existing) {
						existing.qty += requiredInCompBase;
					} else {
						deductionsMap.set(comp.id, { item: comp, qty: requiredInCompBase });
					}
				}
			}
		}

		const consumedComponents: Array<{ item: Item; consumedQty: number }> = [];

		for (const { item: comp, qty: requiredInCompBase } of deductionsMap.values()) {
			const nextStock = Math.max(0, Math.round((comp.currentStock - requiredInCompBase) * 10000) / 10000);
			let newBatches = comp.batches;
			let newRefCost = comp.referenceCost;
			if (comp.batches && comp.batches.length > 0) {
				const res = applyStockConsumption(comp.batches, requiredInCompBase, comp.referenceCost);
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
				consumedComponents.push({ item: updatedComp, consumedQty: requiredInCompBase });
			}
		}

		const nextParentStock = Math.round((parent.currentStock + producedQty) * 10000) / 10000;
		const newBatch: ItemStockBatch = {
			id: uuidv7(),
			createdAt: new Date().toISOString(),
			initialQuantity: producedQty,
			remainingQuantity: producedQty,
			totalCost: 0,
			unitCost: 0,
			notes: notes?.trim() || null
		};
		const currentBatches = parent.batches ?? [];
		const updatedBatches = [...currentBatches, newBatch].slice(-15);

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
	 * 1. Descuenta initialQuantity del ítem padre y remueve el batch.
	 * 2. Devuelve / repone proporcionalmente el stock consumido a cada ingrediente/componente de la receta
	 *    (incluyendo los insumos descontados en cascada de elaborados Make-to-Order).
	 */
	async revertProducedBatch(
		businessId: string,
		parentItemId: string,
		batchId: string
	): Promise<{ parent: Item; restoredComponents: Array<{ item: Item; restoredQty: number }>; removedBatch: ItemStockBatch }> {
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

				const isMakeToOrder = comp.type === 'prepared' && Boolean(comp.recipeConfig?.isMakeToOrder);
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

		const restoredComponents: Array<{ item: Item; restoredQty: number }> = [];

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

		// Descontar del padre y eliminar el lote
		const nextParentStock = Math.max(0, Math.round((parent.currentStock - batchToDelete.remainingQuantity) * 10000) / 10000);
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
