export const DRAFT_STATUSES = ['active', 'committed', 'discarded'] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const DRAFT_ENTITY_TYPES = ['item', 'recipe_line', 'sales_product', 'order'] as const;
export type DraftEntityType = (typeof DRAFT_ENTITY_TYPES)[number];

export const DRAFT_ACTIONS = ['create', 'update', 'delete'] as const;
export type DraftAction = (typeof DRAFT_ACTIONS)[number];

export const DRAFT_ENTITY_LABELS: Record<DraftEntityType, string> = {
	item: 'Ítem de Inventario (Insumo / Elaboración)',
	recipe_line: 'Ingrediente de Receta',
	sales_product: 'Producto de Venta (Catálogo)',
	order: 'Pedido / Orden'
};

export const DRAFT_ACTION_LABELS: Record<DraftAction, string> = {
	create: 'Crear',
	update: 'Actualizar',
	delete: 'Eliminar'
};

export interface DraftFieldIssue {
	field: string;
	message: string;
	description?: string;
}

export interface DraftEntry {
	/** Identificador o alias simbólico dentro del borrador (ej: "harina", "bizcochuelo") para poder referenciarlo entre entidades del mismo borrador */
	entryId: string;
	entityType: DraftEntityType;
	action: DraftAction;
	/** ID o código real en la base de datos cuando action es 'update' o 'delete' */
	targetId?: string | null;
	/** Datos dinámicos de la entidad (pueden estar parciales mientras se conversa con el usuario) */
	data: Record<string, any>;
	/** Indica si los datos actuales cumplen el schema de Zod completo para hacer commit */
	isValid: boolean;
	/** Lista de campos que faltan completar o tienen errores según el schema de Zod y sus .describe() */
	missingOrInvalidFields: DraftFieldIssue[];
	updatedAt: string;
}

export interface DraftPayload {
	entries: DraftEntry[];
	notes?: string | null;
}

export interface Draft {
	id: string;
	businessId: string;
	sessionId?: string | null;
	title: string;
	status: DraftStatus;
	payload: DraftPayload;
	createdAt: Date;
	updatedAt: Date;
}

export interface DraftSummaryStatus {
	draft: Draft;
	totalEntries: number;
	validEntriesCount: number;
	invalidEntriesCount: number;
	readyToCommit: boolean;
	pendingQuestionsSummary: Array<{
		entryId: string;
		entityType: DraftEntityType;
		action: DraftAction;
		label: string;
		issues: DraftFieldIssue[];
	}>;
}
