import type { ItemService } from '#lib/features/items/application/item.service';
import type { Item, UnitOfMeasure } from '#lib/features/items/domain/item.entity';
import type { OrderService } from '#lib/features/orders/application/order.service';
import type { SalesProductWithItems } from '#lib/features/orders/domain/order.entity';
import type { RecipeService } from '#lib/features/recipes/application/recipe.service';
import { validateDraftEntryData } from '../domain/draft-schema-registry';
import {
	DRAFT_ENTITY_LABELS,
	type Draft,
	type DraftAction,
	type DraftEntityType,
	type DraftEntry,
	type DraftSummaryStatus
} from '../domain/draft.entity';
import type { IDraftRepository } from '../domain/draft.repository';

export interface UpsertDraftEntryInput {
	businessId: string;
	draftId?: string | null;
	sessionId?: string | null;
	entryId?: string;
	entityType: DraftEntityType;
	action?: DraftAction;
	targetId?: string | null;
	data: Record<string, any>;
	/** Si es true (por defecto), fusiona los campos con la entrada existente en vez de pisarla por completo */
	merge?: boolean;
}

export interface CommitDraftResult {
	draftId: string;
	createdItems: Array<{ id: string; code: string; name: string; type: string }>;
	updatedItems: Array<{ id: string; code: string; name: string }>;
	deletedItemIds: string[];
	createdRecipeLinesCount: number;
	createdSalesProducts: Array<{ id: string; code: string; name: string; salePrice: number }>;
	updatedSalesProducts: Array<{ id: string; code: string; name: string }>;
	deletedSalesProductIds: string[];
	createdOrders: Array<{ id: string; orderNumber: string; customerName: string; totalAmount: number }>;
}

function slugifyEntryId(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 40);
}

export class DraftService {
	constructor(
		private readonly draftRepo: IDraftRepository,
		private readonly itemService: ItemService,
		private readonly recipeService: RecipeService,
		private readonly orderService: OrderService
	) {}

	private buildSummary(draft: Draft): DraftSummaryStatus {
		// Re-validar todas las entradas contra el schema actual de Zod
		const revalidatedEntries: DraftEntry[] = draft.payload.entries.map((entry) => {
			const validation = validateDraftEntryData(
				entry.entityType,
				entry.action,
				entry.targetId,
				entry.data
			);
			return {
				...entry,
				data: validation.normalizedData,
				isValid: validation.isValid,
				missingOrInvalidFields: validation.issues
			};
		});

		const normalizedDraft: Draft = {
			...draft,
			payload: {
				...draft.payload,
				entries: revalidatedEntries
			}
		};

		const validEntriesCount = revalidatedEntries.filter((e) => e.isValid).length;
		const invalidEntriesCount = revalidatedEntries.length - validEntriesCount;

		const pendingQuestionsSummary = revalidatedEntries
			.filter((e) => !e.isValid)
			.map((e) => ({
				entryId: e.entryId,
				entityType: e.entityType,
				action: e.action,
				label:
					e.data?.name ||
					e.data?.customerName ||
					e.targetId ||
					`${DRAFT_ENTITY_LABELS[e.entityType]} (${e.entryId})`,
				issues: e.missingOrInvalidFields
			}));

		return {
			draft: normalizedDraft,
			totalEntries: revalidatedEntries.length,
			validEntriesCount,
			invalidEntriesCount,
			readyToCommit: revalidatedEntries.length > 0 && invalidEntriesCount === 0,
			pendingQuestionsSummary
		};
	}

	async getOrCreateActiveDraft(
		businessId: string,
		sessionId?: string | null,
		title?: string
	): Promise<DraftSummaryStatus> {
		let draft = await this.draftRepo.findActiveByBusiness(businessId, sessionId);
		if (!draft) {
			draft = await this.draftRepo.create({
				businessId,
				sessionId: sessionId ?? null,
				title: title ?? 'Borrador activo',
				payload: { entries: [] }
			});
		}
		return this.buildSummary(draft);
	}

	async getDraftById(id: string, businessId: string): Promise<DraftSummaryStatus | null> {
		const draft = await this.draftRepo.findById(id, businessId);
		if (!draft) return null;
		return this.buildSummary(draft);
	}

	async upsertEntry(input: UpsertDraftEntryInput): Promise<{
		entry: DraftEntry;
		summary: DraftSummaryStatus;
	}> {
		let draft: Draft | null = null;
		if (input.draftId) {
			draft = await this.draftRepo.findById(input.draftId, input.businessId);
		}
		if (!draft) {
			const activeSummary = await this.getOrCreateActiveDraft(input.businessId, input.sessionId);
			draft = activeSummary.draft;
		}

		const action: DraftAction = input.action ?? 'create';
		const rawEntryId =
			input.entryId?.trim() ||
			(input.data?.name ? `${input.entityType}:${slugifyEntryId(String(input.data.name))}` : '') ||
			(input.entityType === 'order' ? 'order:actual' : '') ||
			`${input.entityType}:${draft.payload.entries.length + 1}`;

		const existingIdx = draft.payload.entries.findIndex(
			(e) => e.entryId.toLowerCase() === rawEntryId.toLowerCase()
		);

		const shouldMerge = input.merge !== false;
		const existingEntry = existingIdx >= 0 ? draft.payload.entries[existingIdx] : null;

		const mergedData: Record<string, any> =
			shouldMerge && existingEntry
				? {
						...existingEntry.data,
						...Object.fromEntries(
							Object.entries(input.data ?? {}).filter(([, v]) => v !== undefined)
						)
					}
				: { ...(input.data ?? {}) };

		const targetId =
			input.targetId !== undefined ? input.targetId : (existingEntry?.targetId ?? null);

		const validation = validateDraftEntryData(input.entityType, action, targetId, mergedData);

		const updatedEntry: DraftEntry = {
			entryId: existingEntry ? existingEntry.entryId : rawEntryId,
			entityType: input.entityType,
			action,
			targetId,
			data: validation.normalizedData,
			isValid: validation.isValid,
			missingOrInvalidFields: validation.issues,
			updatedAt: new Date().toISOString()
		};

		const nextEntries = [...draft.payload.entries];
		if (existingIdx >= 0) {
			nextEntries[existingIdx] = updatedEntry;
		} else {
			nextEntries.push(updatedEntry);
		}

		const updatedDraft = await this.draftRepo.update(draft.id, input.businessId, {
			payload: {
				...draft.payload,
				entries: nextEntries
			}
		});

		if (!updatedDraft) {
			throw new Error('No se pudo actualizar el borrador.');
		}

		return {
			entry: updatedEntry,
			summary: this.buildSummary(updatedDraft)
		};
	}

	async removeEntry(
		businessId: string,
		entryId: string,
		draftId?: string | null,
		sessionId?: string | null
	): Promise<DraftSummaryStatus> {
		let draft: Draft | null = null;
		if (draftId) {
			draft = await this.draftRepo.findById(draftId, businessId);
		}
		if (!draft) {
			draft = await this.draftRepo.findActiveByBusiness(businessId, sessionId);
		}
		if (!draft) {
			throw new Error('No hay un borrador activo.');
		}

		const nextEntries = draft.payload.entries.filter(
			(e) => e.entryId.toLowerCase() !== entryId.trim().toLowerCase()
		);

		const updated = await this.draftRepo.update(draft.id, businessId, {
			payload: {
				...draft.payload,
				entries: nextEntries
			}
		});

		if (!updated) {
			throw new Error('No se pudo eliminar la entrada del borrador.');
		}

		return this.buildSummary(updated);
	}

	async clearDraft(
		businessId: string,
		draftId?: string | null,
		sessionId?: string | null
	): Promise<DraftSummaryStatus> {
		let draft: Draft | null = null;
		if (draftId) {
			draft = await this.draftRepo.findById(draftId, businessId);
		}
		if (!draft) {
			draft = await this.draftRepo.findActiveByBusiness(businessId, sessionId);
		}
		if (!draft) {
			return this.getOrCreateActiveDraft(businessId, sessionId);
		}

		const updated = await this.draftRepo.update(draft.id, businessId, {
			payload: {
				...draft.payload,
				entries: []
			}
		});

		if (!updated) {
			throw new Error('No se pudo vaciar el borrador.');
		}

		return this.buildSummary(updated);
	}

	/**
	 * Confirma y persiste todas las operaciones del borrador en las tablas reales de GiveOS,
	 * resolviendo referencias simbólicas entre insumos, elaboraciones, productos de venta y órdenes.
	 */
	async commitDraft(
		businessId: string,
		draftId?: string | null,
		sessionId?: string | null
	): Promise<CommitDraftResult> {
		let draft: Draft | null = null;
		if (draftId) {
			draft = await this.draftRepo.findById(draftId, businessId);
		}
		if (!draft) {
			draft = await this.draftRepo.findActiveByBusiness(businessId, sessionId);
		}
		if (!draft) {
			throw new Error('No se encontró un borrador activo para confirmar.');
		}

		const summary = this.buildSummary(draft);
		if (summary.totalEntries === 0) {
			throw new Error('El borrador está vacío. Agrega al menos una entidad antes de confirmar.');
		}

		if (!summary.readyToCommit) {
			const details = summary.pendingQuestionsSummary
				.map(
					(p) =>
						`- ${p.label}: ${p.issues.map((i) => `${i.field} (${i.message})`).join(', ')}`
				)
				.join('\n');
			throw new Error(
				`El borrador aún tiene datos incompletos o pendientes de confirmar:\n${details}`
			);
		}

		const entries = summary.draft.payload.entries;

		// Cargar estado actual del negocio para resolver referencias por ID, código o nombre
		const [existingItems, existingSalesProducts] = await Promise.all([
			this.itemService.listItems(businessId),
			this.orderService.listSalesProducts(businessId)
		]);

		const itemRefMap = new Map<string, Item>();
		const registerItemRef = (item: Item, alias?: string) => {
			itemRefMap.set(item.id.toLowerCase(), item);
			itemRefMap.set(item.code.toLowerCase(), item);
			itemRefMap.set(item.name.trim().toLowerCase(), item);
			itemRefMap.set(`item:${slugifyEntryId(item.name)}`, item);
			itemRefMap.set(slugifyEntryId(item.name), item);
			if (alias) {
				itemRefMap.set(alias.trim().toLowerCase(), item);
			}
		};

		for (const item of existingItems) {
			registerItemRef(item);
		}

		const productRefMap = new Map<string, SalesProductWithItems | { id: string; code: string; name: string; salePrice: number }>();
		const registerProductRef = (
			prod: { id: string; code: string; name: string; salePrice: number },
			alias?: string
		) => {
			productRefMap.set(prod.id.toLowerCase(), prod);
			productRefMap.set(prod.code.toLowerCase(), prod);
			productRefMap.set(prod.name.trim().toLowerCase(), prod);
			productRefMap.set(`sales_product:${slugifyEntryId(prod.name)}`, prod);
			productRefMap.set(slugifyEntryId(prod.name), prod);
			if (alias) {
				productRefMap.set(alias.trim().toLowerCase(), prod);
			}
		};

		for (const prod of existingSalesProducts) {
			registerProductRef(prod);
		}

		const resolveItem = (ref: string): Item => {
			const key = ref.trim().toLowerCase();
			const found = itemRefMap.get(key) ?? itemRefMap.get(slugifyEntryId(key));
			if (!found) {
				throw new Error(
					`No se encontró el ítem o insumo referenciado como "${ref}". Asegúrate de incluirlo en el borrador o que exista en el inventario.`
				);
			}
			return found;
		};

		const resolveSalesProduct = (ref: string) => {
			const key = ref.trim().toLowerCase();
			const found = productRefMap.get(key) ?? productRefMap.get(slugifyEntryId(key));
			if (!found) {
				throw new Error(
					`No se encontró el producto de venta referenciado como "${ref}".`
				);
			}
			return found;
		};

		const result: CommitDraftResult = {
			draftId: draft.id,
			createdItems: [],
			updatedItems: [],
			deletedItemIds: [],
			createdRecipeLinesCount: 0,
			createdSalesProducts: [],
			updatedSalesProducts: [],
			deletedSalesProductIds: [],
			createdOrders: []
		};

		// 1. Crear y actualizar Ítems (primero raw_material y luego prepared para permitir referencias en cadena)
		const itemEntries = entries.filter(
			(e) => e.entityType === 'item' && (e.action === 'create' || e.action === 'update')
		);
		const sortedItemEntries = [...itemEntries].sort((a, b) => {
			if (a.data?.type === 'raw_material' && b.data?.type !== 'raw_material') return -1;
			if (a.data?.type !== 'raw_material' && b.data?.type === 'raw_material') return 1;
			return 0;
		});

		const inlineRecipeQueue: Array<{
			parentItemId: string;
			componentRef: string;
			quantity: number;
			unit: UnitOfMeasure;
			notes?: string | null;
		}> = [];

		for (const entry of sortedItemEntries) {
			if (entry.action === 'create') {
				const d = entry.data;
				// Si ya existe un ítem con exactamente el mismo nombre, lo actualizamos (upsert amigable)
				const existingByName = itemRefMap.get(String(d.name).trim().toLowerCase());
				if (existingByName) {
					const updated = await this.itemService.updateItem(existingByName.id, businessId, {
						name: d.name,
						baseUnit: d.baseUnit,
						referenceCost: d.referenceCost ?? existingByName.referenceCost,
						purchaseQuantity: d.purchaseQuantity ?? existingByName.purchaseQuantity,
						yieldQuantity: d.yieldQuantity ?? existingByName.yieldQuantity,
						currentStock: d.currentStock ?? existingByName.currentStock,
						minStock: d.minStock ?? existingByName.minStock,
						prepTimeMinutes: d.prepTimeMinutes ?? existingByName.prepTimeMinutes,
						passiveTimeMinutes: d.passiveTimeMinutes ?? existingByName.passiveTimeMinutes,
						notes: d.notes ?? existingByName.notes
					});
					registerItemRef(updated, entry.entryId);
					result.updatedItems.push({ id: updated.id, code: updated.code, name: updated.name });

					if (Array.isArray(d.ingredients)) {
						for (const ing of d.ingredients) {
							inlineRecipeQueue.push({
								parentItemId: updated.id,
								componentRef: ing.componentRef,
								quantity: Number(ing.quantity),
								unit: ing.unit as UnitOfMeasure,
								notes: ing.notes ?? null
							});
						}
					}
				} else {
					const created = await this.itemService.createItem({
						businessId,
						name: d.name,
						type: d.type,
						baseUnit: d.baseUnit,
						referenceCost: Number(d.referenceCost ?? 0),
						purchaseQuantity: Number(d.purchaseQuantity ?? 1),
						yieldQuantity: Number(d.yieldQuantity ?? 1),
						currentStock: Number(d.currentStock ?? 0),
						minStock: Number(d.minStock ?? 0),
						prepTimeMinutes: Number(d.prepTimeMinutes ?? 0),
						passiveTimeMinutes: Number(d.passiveTimeMinutes ?? 0),
						notes: d.notes ?? null
					});
					registerItemRef(created, entry.entryId);
					result.createdItems.push({
						id: created.id,
						code: created.code,
						name: created.name,
						type: created.type
					});

					if (Array.isArray(d.ingredients)) {
						for (const ing of d.ingredients) {
							inlineRecipeQueue.push({
								parentItemId: created.id,
								componentRef: ing.componentRef,
								quantity: Number(ing.quantity),
								unit: ing.unit as UnitOfMeasure,
								notes: ing.notes ?? null
							});
						}
					}
				}
			} else if (entry.action === 'update' && entry.targetId) {
				const target = resolveItem(entry.targetId);
				const updated = await this.itemService.updateItem(target.id, businessId, entry.data);
				registerItemRef(updated, entry.entryId);
				result.updatedItems.push({ id: updated.id, code: updated.code, name: updated.name });
			}
		}

		// 2. Procesar ingredientes inline de elaboraciones + entradas recipe_line
		for (const inlineLine of inlineRecipeQueue) {
			const component = resolveItem(inlineLine.componentRef);
			await this.recipeService.addLine(businessId, {
				parentItemId: inlineLine.parentItemId,
				componentItemId: component.id,
				quantity: inlineLine.quantity,
				unit: inlineLine.unit,
				notes: inlineLine.notes
			});
			result.createdRecipeLinesCount++;
		}

		const recipeLineEntries = entries.filter((e) => e.entityType === 'recipe_line');
		for (const entry of recipeLineEntries) {
			if (entry.action === 'create') {
				const parent = resolveItem(entry.data.parentRef);
				const component = resolveItem(entry.data.componentRef);
				await this.recipeService.addLine(businessId, {
					parentItemId: parent.id,
					componentItemId: component.id,
					quantity: Number(entry.data.quantity),
					unit: entry.data.unit as UnitOfMeasure,
					notes: entry.data.notes ?? null
				});
				result.createdRecipeLinesCount++;
			} else if (entry.action === 'update' && entry.targetId) {
				await this.recipeService.updateLine(businessId, entry.targetId, entry.data);
			} else if (entry.action === 'delete' && entry.targetId) {
				await this.recipeService.removeLine(businessId, entry.targetId);
			}
		}

		// 3. Crear / actualizar Productos de Venta (sales_product)
		const salesProductEntries = entries.filter(
			(e) => e.entityType === 'sales_product' && (e.action === 'create' || e.action === 'update')
		);
		for (const entry of salesProductEntries) {
			if (entry.action === 'create') {
				const d = entry.data;
				const resolvedComponents = (d.components ?? []).map((comp: any) => {
					const item = resolveItem(comp.itemRef);
					return {
						itemId: item.id,
						quantity: Number(comp.quantity ?? 1)
					};
				});
				const created = await this.orderService.createSalesProduct({
					businessId,
					name: d.name,
					salePrice: Number(d.salePrice),
					description: d.description ?? null,
					isShortcut: Boolean(d.isShortcut),
					components: resolvedComponents
				});
				registerProductRef(created, entry.entryId);
				result.createdSalesProducts.push({
					id: created.id,
					code: created.code,
					name: created.name,
					salePrice: created.salePrice
				});
			} else if (entry.action === 'update' && entry.targetId) {
				const target = resolveSalesProduct(entry.targetId);
				const d = entry.data;
				const resolvedComponents = Array.isArray(d.components)
					? d.components.map((comp: any) => ({
							itemId: resolveItem(comp.itemRef).id,
							quantity: Number(comp.quantity ?? 1)
						}))
					: undefined;
				const updated = await this.orderService.updateSalesProduct(target.id, businessId, {
					...d,
					components: resolvedComponents
				});
				registerProductRef(updated, entry.entryId);
				result.updatedSalesProducts.push({
					id: updated.id,
					code: updated.code,
					name: updated.name
				});
			}
		}

		// 4. Crear Órdenes / Pedidos (order)
		const orderEntries = entries.filter(
			(e) => e.entityType === 'order' && e.action === 'create'
		);
		for (const entry of orderEntries) {
			const d = entry.data;
			const resolvedLines = (d.lines ?? []).map((line: any) => {
				const prod = resolveSalesProduct(line.productRef);
				return {
					salesProductId: prod.id,
					quantity: Number(line.quantity),
					unitPrice:
						line.unitPrice !== undefined && line.unitPrice !== null
							? Number(line.unitPrice)
							: Number(prod.salePrice),
					fulfillmentType: line.fulfillmentType ?? 'preorder',
					notes: line.notes ?? null
				};
			});

			let parsedDeliveryDate: Date | null = null;
			if (d.deliveryDate) {
				const candidate = new Date(d.deliveryDate);
				if (!isNaN(candidate.getTime())) {
					parsedDeliveryDate = candidate;
				}
			}

			const createdOrder = await this.orderService.createOrder({
				businessId,
				customerName: d.customerName,
				paymentStatus: d.paymentStatus ?? 'pending',
				paidAmount: Number(d.paidAmount ?? 0),
				deliveryDate: parsedDeliveryDate,
				notes: d.notes ?? null,
				status: d.status ?? 'pending',
				lines: resolvedLines
			});

			result.createdOrders.push({
				id: createdOrder.id,
				orderNumber: createdOrder.orderNumber,
				customerName: createdOrder.customerName,
				totalAmount: createdOrder.totalAmount
			});
		}

		// 5. Ejecutar eliminaciones en orden inverso de dependencia (sales_product -> item)
		const deleteProductEntries = entries.filter(
			(e) => e.entityType === 'sales_product' && e.action === 'delete' && e.targetId
		);
		for (const entry of deleteProductEntries) {
			const target = resolveSalesProduct(entry.targetId!);
			await this.orderService.deleteSalesProduct(target.id, businessId);
			result.deletedSalesProductIds.push(target.id);
		}

		const deleteItemEntries = entries.filter(
			(e) => e.entityType === 'item' && e.action === 'delete' && e.targetId
		);
		for (const entry of deleteItemEntries) {
			const target = resolveItem(entry.targetId!);
			await this.itemService.deleteItem(target.id, businessId);
			result.deletedItemIds.push(target.id);
		}

		// Marcar borrador como confirmado (committed)
		await this.draftRepo.update(draft.id, businessId, {
			status: 'committed'
		});

		return result;
	}
}
