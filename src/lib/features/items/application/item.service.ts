import {
	generateNextItemCode,
	type CreateItemInput,
	type Item,
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

	async deleteItem(id: string, businessId: string): Promise<void> {
		const ok = await this.itemRepo.delete(id, businessId);
		if (!ok) {
			throw new Error('No se pudo eliminar el ítem.');
		}
	}
}
