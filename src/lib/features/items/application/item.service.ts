import { v7 as uuidv7 } from 'uuid';
import {
	applyStockConsumption,
	applyStockIntake,
	generateNextItemCode,
	removeStockBatch,
	type CreateItemInput,
	type Item,
	type ItemStockBatch,
	type ItemType,
	type UpdateItemInput
} from '../domain/item.entity';
import type { IItemRepository } from '../domain/item.repository';

export class ItemService {
	constructor(private readonly itemRepo: IItemRepository) {}

	async listItems(
		businessId: string,
		filter?: { type?: ItemType; search?: string }
	): Promise<Item[]> {
		return this.itemRepo.findAllByBusiness(businessId, filter);
	}

	async getItemById(id: string, businessId: string): Promise<Item | null> {
		return this.itemRepo.findById(id, businessId);
	}

	async createItem(input: CreateItemInput): Promise<Item> {
		if (!input.name.trim()) {
			throw new Error('El nombre del ítem es obligatorio.');
		}

		let normalizedCode = (input.code ?? '').trim().toUpperCase();
		if (!normalizedCode) {
			const existingItems = await this.itemRepo.findAllByBusiness(input.businessId);
			normalizedCode = generateNextItemCode(
				input.type,
				existingItems.map((i) => i.code)
			);
		} else {
			const existing = await this.itemRepo.findByCode(normalizedCode, input.businessId);
			if (existing) {
				throw new Error(`Ya existe un ítem con el código "${normalizedCode}" en este negocio.`);
			}
		}

		return this.itemRepo.create({
			...input,
			code: normalizedCode
		});
	}

	async updateItem(id: string, businessId: string, input: UpdateItemInput): Promise<Item> {
		const existing = await this.itemRepo.findById(id, businessId);
		if (!existing) {
			throw new Error('Ítem no encontrado en este negocio.');
		}
		if (input.code) {
			const normalizedCode = input.code.trim().toUpperCase();
			const duplicate = await this.itemRepo.findByCode(normalizedCode, businessId);
			if (duplicate && duplicate.id !== id) {
				throw new Error(`Ya existe otro ítem con el código "${normalizedCode}".`);
			}
		}
		const updated = await this.itemRepo.update(id, businessId, input);
		if (!updated) {
			throw new Error('No se pudo actualizar el ítem.');
		}
		return updated;
	}

	async addStockBatch(
		id: string,
		businessId: string,
		intake: {
			quantity: number;
			totalCost: number;
			supplier?: string | null;
			notes?: string | null;
		}
	): Promise<{ item: Item; addedBatch: ItemStockBatch }> {
		const existing = await this.itemRepo.findById(id, businessId);
		if (!existing) {
			throw new Error('Ítem no encontrado en este negocio.');
		}
		if (!intake.quantity || intake.quantity <= 0) {
			throw new Error('La cantidad ingresada debe ser mayor a 0.');
		}

		if (existing.type === 'prepared') {
			const newBatch: ItemStockBatch = {
				id: uuidv7(),
				createdAt: new Date().toISOString(),
				initialQuantity: intake.quantity,
				remainingQuantity: intake.quantity,
				totalCost: 0,
				unitCost: 0,
				supplier: null,
				notes: intake.notes?.trim() || null
			};
			const currentBatches = existing.batches ?? [];
			const updatedBatches = [...currentBatches.slice(-29), newBatch];
			const newStock = existing.currentStock + intake.quantity;

			const updated = await this.itemRepo.update(id, businessId, {
				currentStock: newStock,
				batches: updatedBatches
			});

			if (!updated) {
				throw new Error('No se pudo registrar la carga de stock de la elaboración.');
			}

			return { item: updated, addedBatch: newBatch };
		}

		if (intake.totalCost === undefined || intake.totalCost < 0) {
			throw new Error('El costo total debe ser mayor o igual a 0.');
		}

		const currentBatches = existing.batches ?? [];
		const { batches: newBatches, newReferenceCost, addedBatch } = applyStockIntake(
			currentBatches,
			intake
		);

		const newStock = existing.currentStock + intake.quantity;

		const updated = await this.itemRepo.update(id, businessId, {
			currentStock: newStock,
			referenceCost: newReferenceCost,
			purchaseQuantity: 1,
			batches: newBatches
		});

		if (!updated) {
			throw new Error('No se pudo registrar la carga de stock.');
		}

		return { item: updated, addedBatch };
	}

	async consumeStock(
		id: string,
		businessId: string,
		quantityToConsume: number
	): Promise<{ item: Item; consumedCost: number }> {
		const existing = await this.itemRepo.findById(id, businessId);
		if (!existing) {
			throw new Error('Ítem no encontrado en este negocio.');
		}
		if (quantityToConsume <= 0) {
			return { item: existing, consumedCost: 0 };
		}

		const currentBatches = existing.batches ?? [];
		const { batches: newBatches, consumedCost, newReferenceCost } = applyStockConsumption(
			currentBatches,
			quantityToConsume,
			existing.referenceCost
		);

		const newStock = Math.max(0, existing.currentStock - quantityToConsume);

		const updated = await this.itemRepo.update(id, businessId, {
			currentStock: newStock,
			referenceCost: newReferenceCost,
			batches: newBatches
		});

		if (!updated) {
			throw new Error('No se pudo descontar el stock del ítem.');
		}

		return { item: updated, consumedCost };
	}

	async deleteStockBatch(
		id: string,
		businessId: string,
		batchId: string
	): Promise<{ item: Item; removedBatch: ItemStockBatch }> {
		const existing = await this.itemRepo.findById(id, businessId);
		if (!existing) {
			throw new Error('Ítem no encontrado en este negocio.');
		}

		const currentBatches = existing.batches ?? [];
		const { batches: newBatches, newStock, newReferenceCost, removedBatch } = removeStockBatch(
			currentBatches,
			batchId,
			existing.currentStock,
			existing.referenceCost
		);

		if (!removedBatch) {
			throw new Error('El lote seleccionado no existe.');
		}

		const updated = await this.itemRepo.update(id, businessId, {
			currentStock: newStock,
			referenceCost: newReferenceCost,
			batches: newBatches
		});

		if (!updated) {
			throw new Error('No se pudo eliminar la carga de stock.');
		}

		return { item: updated, removedBatch };
	}

	async deleteItem(id: string, businessId: string): Promise<void> {
		const ok = await this.itemRepo.delete(id, businessId);
		if (!ok) {
			throw new Error('No se pudo eliminar el ítem.');
		}
	}
}
