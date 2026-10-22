import type { Item, UnitOfMeasure } from '#lib/features/items/domain/item.entity';

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
