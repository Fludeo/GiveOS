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
		badgeClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
		color: 'emerald'
	},
	prepared: {
		label: 'Elaboración',
		shortLabel: 'Elaborado',
		prefix: 'ELB',
		badgeClass: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
		color: 'indigo'
	}
} as const;

export const UNIT_LABELS: Record<UnitOfMeasure, string> = {
	g: 'Gramos (g)',
	kg: 'Kilogramos (kg)',
	ml: 'Mililitros (ml)',
	l: 'Litros (l)',
	unit: 'Unidad (u)'
};

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
	currentStock: number;
	minStock: number;
	notes: string | null;
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
	currentStock?: number;
	minStock?: number;
	notes?: string | null;
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
	currentStock?: number;
	minStock?: number;
	notes?: string | null;
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

export function getDirectUnitCost(item: Pick<Item, 'referenceCost' | 'purchaseQuantity'>): number {
	if (!item.purchaseQuantity || item.purchaseQuantity <= 0) return 0;
	return item.referenceCost / item.purchaseQuantity;
}
