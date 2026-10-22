import { v7 as uuidv7 } from 'uuid';

export const ITEM_TYPES = ['raw_material', 'prepared'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const UNITS_OF_MEASURE = ['g', 'kg', 'ml', 'l', 'unit'] as const;
export type UnitOfMeasure = (typeof UNITS_OF_MEASURE)[number];

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
	raw_material: 'Insumo',
	prepared: 'Elaboración'
};

export const ITEM_TYPE_PREFIXES: Record<ItemType, string> = {
	raw_material: 'INS',
	prepared: 'ELB'
};

export const ITEM_TYPE_CONFIG = {
	raw_material: {
		label: 'Insumo',
		shortLabel: 'Insumo',
		prefix: 'INS',
		badgeClass: 'border-tertiary/40 bg-tertiary/20 text-yellow-900 dark:text-yellow-300',
		color: 'tertiary'
	},
	prepared: {
		label: 'Elaboración',
		shortLabel: 'Elaborado',
		prefix: 'ELB',
		badgeClass: 'border-secondary/30 bg-secondary/10 text-secondary dark:text-secondary-foreground',
		color: 'secondary'
	}
} as const;

export const UNIT_LABELS: Record<UnitOfMeasure, string> = {
	g: 'Gramos (g)',
	kg: 'Kilogramos (kg)',
	ml: 'Mililitros (ml)',
	l: 'Litros (l)',
	unit: 'Unidad (un)'
};

export interface ItemStockBatch {
	id: string;
	createdAt: string; // ISO 8601 string
	initialQuantity: number;
	remainingQuantity: number;
	totalCost: number;
	unitCost: number;
	supplier?: string | null;
	notes?: string | null;
}

export interface Item {
	id: string;
	businessId: string;
	code: string;
	name: string;
	type: ItemType;
	baseUnit: UnitOfMeasure;
	referenceCost: number;
	purchaseQuantity: number;
	yieldQuantity: number;
	prepTimeMinutes: number;
	isPrepTimeScalable?: boolean;
	currentStock: number;
	minStock: number;
	notes: string | null;
	batches?: ItemStockBatch[];
	createdAt: Date;
}

export interface CreateItemInput {
	businessId: string;
	/** Si no se provee, se autogenera secuencialmente según el tipo (INS-001, ELB-001) */
	code?: string;
	name: string;
	type: ItemType;
	baseUnit: UnitOfMeasure;
	referenceCost: number;
	purchaseQuantity: number;
	yieldQuantity?: number;
	prepTimeMinutes?: number;
	isPrepTimeScalable?: boolean;
	currentStock?: number;
	minStock?: number;
	notes?: string | null;
	batches?: ItemStockBatch[];
}

export interface UpdateItemInput {
	code?: string;
	name?: string;
	type?: ItemType;
	baseUnit?: UnitOfMeasure;
	referenceCost?: number;
	purchaseQuantity?: number;
	yieldQuantity?: number;
	prepTimeMinutes?: number;
	isPrepTimeScalable?: boolean;
	currentStock?: number;
	minStock?: number;
	notes?: string | null;
	batches?: ItemStockBatch[];
}

/**
 * Calcula el próximo código correlativo libre para el tipo de ítem dado (ej. MP-001 -> MP-002).
 */
export function generateNextItemCode(type: ItemType, existingCodes: string[]): string {
	const prefix = ITEM_TYPE_PREFIXES[type];
	const prefixesToMatch = type === 'raw_material' ? [prefix, 'MP'] : [prefix, 'SUB', 'PRD'];
	const pattern = new RegExp(`^(?:${prefixesToMatch.join('|')})-(\\d+)$`, 'i');
	let maxNumber = 0;

	for (const code of existingCodes) {
		const match = code.trim().match(pattern);
		if (match) {
			const num = parseInt(match[1], 10);
			if (Number.isFinite(num) && num > maxNumber) {
				maxNumber = num;
			}
		}
	}

	const nextNum = String(maxNumber + 1).padStart(3, '0');
	return `${prefix}-${nextNum}`;
}

const UNIT_DIMENSION: Record<UnitOfMeasure, 'mass' | 'volume' | 'count'> = {
	g: 'mass',
	kg: 'mass',
	ml: 'volume',
	l: 'volume',
	unit: 'count'
};

const TO_BASE_FACTOR: Record<UnitOfMeasure, number> = {
	g: 1,
	kg: 1000,
	ml: 1,
	l: 1000,
	unit: 1
};

export function areUnitsCompatible(from: UnitOfMeasure, to: UnitOfMeasure): boolean {
	return UNIT_DIMENSION[from] === UNIT_DIMENSION[to];
}

export function convertQuantity(
	quantity: number,
	from: UnitOfMeasure,
	to: UnitOfMeasure
): number {
	if (from === to) return quantity;
	if (!areUnitsCompatible(from, to)) {
		return quantity;
	}
	const inCanonical = quantity * TO_BASE_FACTOR[from];
	return inCanonical / TO_BASE_FACTOR[to];
}

/**
 * Calcula el consumo exacto de un ingrediente según la proporción de la receta y el tamaño del lote.
 * Evita la división prematura que ocasiona pérdida de decimales.
 */
export function calculateRecipeConsumption(
	lineQuantity: number,
	lineUnit: UnitOfMeasure,
	componentBaseUnit: UnitOfMeasure,
	producedQty: number,
	yieldQty: number
): number {
	if (yieldQty <= 0 || producedQty <= 0 || lineQuantity <= 0) return 0;

	// Convertir la cantidad de la línea a la unidad base del componente de forma exacta
	const canonicalQty = lineQuantity * TO_BASE_FACTOR[lineUnit];
	const inCompBase = canonicalQty / TO_BASE_FACTOR[componentBaseUnit];

	// Multiplicar numeradores antes de dividir para no truncar fracciones (ej. (1 * 3) / 3 = 1 exacto)
	const exactQuantity = (inCompBase * producedQty) / yieldQty;

	// Redondear a 4 decimales pero normalizando a precisión flotante limpia
	return Math.round(exactQuantity * 10000) / 10000;
}

export function getDirectUnitCost(item: Pick<Item, 'referenceCost' | 'purchaseQuantity'>): number {
	if (!item.purchaseQuantity || item.purchaseQuantity <= 0) return 0;
	return item.referenceCost / item.purchaseQuantity;
}

/**
 * Calcula el costo unitario ponderado sobre las capas de stock activas (FIFO).
 * Si no quedan capas activas, mantiene el fallbackCost previo.
 */
export function calculateWeightedUnitCost(batches: ItemStockBatch[] = [], fallbackCost: number = 0): number {
	const active = batches.filter((b) => b.remainingQuantity > 0);
	if (active.length === 0) {
		if (batches.length > 0) {
			return batches[batches.length - 1].unitCost;
		}
		return fallbackCost;
	}
	let totalValue = 0;
	let totalQty = 0;
	for (const b of active) {
		totalValue += b.remainingQuantity * b.unitCost;
		totalQty += b.remainingQuantity;
	}
	return totalQty > 0 ? totalValue / totalQty : fallbackCost;
}

/**
 * Registra una nueva carga de stock (compra) y devuelve los lotes actualizados y el nuevo costo unitario ponderado.
 */
export function applyStockIntake(
	batches: ItemStockBatch[] = [],
	intake: {
		quantity: number;
		totalCost: number;
		supplier?: string | null;
		notes?: string | null;
	}
): { batches: ItemStockBatch[]; newReferenceCost: number; addedBatch: ItemStockBatch } {
	const qty = Math.max(0.0001, intake.quantity);
	const unitCost = intake.totalCost / qty;
	const newBatch: ItemStockBatch = {
		id: uuidv7(),
		createdAt: new Date().toISOString(),
		initialQuantity: qty,
		remainingQuantity: qty,
		totalCost: intake.totalCost,
		unitCost,
		supplier: intake.supplier?.trim() || null,
		notes: intake.notes?.trim() || null
	};

	// Conservar el historial de las últimas 15 cargas (incluso si alguna llegó a 0)
	// para permitir revertir elaboraciones y restaurar a los lotes originales exactos
	const updatedBatches = [...batches, newBatch].slice(-15);
	const newReferenceCost = calculateWeightedUnitCost(updatedBatches, unitCost);

	return {
		batches: updatedBatches,
		newReferenceCost,
		addedBatch: newBatch
	};
}

/**
 * Consume stock según la regla First-In, First-Out (FIFO) descontando de las capas más antiguas primero.
 */
export function applyStockConsumption(
	batches: ItemStockBatch[] = [],
	quantityToConsume: number,
	currentReferenceCost: number = 0
): { batches: ItemStockBatch[]; consumedCost: number; newReferenceCost: number } {
	let remainingToDeduct = Math.max(0, quantityToConsume);
	let consumedCost = 0;

	const updated = batches.map((batch) => {
		if (remainingToDeduct <= 0 || batch.remainingQuantity <= 0) {
			return batch;
		}
		const deductFromThis = Math.min(batch.remainingQuantity, remainingToDeduct);
		remainingToDeduct = Math.max(0, remainingToDeduct - deductFromThis);
		consumedCost += deductFromThis * batch.unitCost;
		let nextRem = batch.remainingQuantity - deductFromThis;
		// Absorción de micro-residuos de punto flotante (< 0.0005)
		if (nextRem <= 0.0005) {
			nextRem = 0;
		}
		return {
			...batch,
			remainingQuantity: Math.round(nextRem * 10000) / 10000
		};
	});

	const newReferenceCost = calculateWeightedUnitCost(updated, currentReferenceCost);

	return {
		batches: updated,
		consumedCost,
		newReferenceCost
	};
}

/**
 * Revierte un consumo de stock sobre los lotes en orden LIFO inverso (reponiendo a los lotes que tenían capacidad consumida).
 */
export function applyStockRestoration(
	batches: ItemStockBatch[] = [],
	quantityToRestore: number,
	currentReferenceCost: number = 0
): { batches: ItemStockBatch[]; newReferenceCost: number } {
	let remainingToRestore = Math.max(0, quantityToRestore);
	if (remainingToRestore <= 0 || batches.length === 0) {
		return { batches, newReferenceCost: currentReferenceCost };
	}

	// Recorremos de más nuevo a más viejo (orden inverso de consumo)
	const updated = [...batches];
	for (let i = updated.length - 1; i >= 0 && remainingToRestore > 0; i--) {
		const batch = updated[i];
		const capacity = Math.max(0, batch.initialQuantity - batch.remainingQuantity);
		if (capacity > 0) {
			const restoreToThis = Math.min(capacity, remainingToRestore);
			const nextRem = Math.min(batch.initialQuantity, batch.remainingQuantity + restoreToThis);
			updated[i] = {
				...batch,
				remainingQuantity: Math.round(nextRem * 10000) / 10000
			};
			remainingToRestore = Math.max(0, remainingToRestore - restoreToThis);
		}
	}

	// Si aún sobra cantidad por reponer (por ejemplo, si el stock original no alcanzaba en los lotes existentes)
	// se suma al lote más reciente
	if (remainingToRestore > 0 && updated.length > 0) {
		const lastIdx = updated.length - 1;
		updated[lastIdx] = {
			...updated[lastIdx],
			remainingQuantity: Math.round((updated[lastIdx].remainingQuantity + remainingToRestore) * 10000) / 10000
		};
	}

	const newReferenceCost = calculateWeightedUnitCost(updated, currentReferenceCost);

	return {
		batches: updated,
		newReferenceCost
	};
}

/**
 * Elimina una carga de stock (lote) existente, ajustando el stock actual y recalculando el costo de referencia.
 */
export function removeStockBatch(
	batches: ItemStockBatch[] = [],
	batchId: string,
	currentStock: number,
	fallbackCost: number = 0
): {
	batches: ItemStockBatch[];
	newStock: number;
	newReferenceCost: number;
	removedBatch: ItemStockBatch | null;
} {
	const targetIndex = batches.findIndex((b) => b.id === batchId);
	if (targetIndex === -1) {
		return {
			batches,
			newStock: currentStock,
			newReferenceCost: fallbackCost,
			removedBatch: null
		};
	}

	const removedBatch = batches[targetIndex];
	const updatedBatches = batches.filter((b) => b.id !== batchId);
	const newStock = Math.max(0, currentStock - removedBatch.remainingQuantity);
	const newReferenceCost = calculateWeightedUnitCost(updatedBatches, fallbackCost);

	return {
		batches: updatedBatches,
		newStock,
		newReferenceCost,
		removedBatch
	};
}

export function formatUnit(unit: string | null | undefined): string {
	if (!unit) return '';
	return unit === 'unit' ? 'un' : unit;
}
