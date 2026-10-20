import type { CreateItemInput, Item, ItemType, UpdateItemInput } from './item.entity';

export interface IItemRepository {
	findAllByBusiness(
		businessId: string,
		filter?: { type?: ItemType; search?: string }
	): Promise<Item[]>;
	findById(id: string, businessId: string): Promise<Item | null>;
	findByCode(code: string, businessId: string): Promise<Item | null>;
	create(input: CreateItemInput): Promise<Item>;
	update(id: string, businessId: string, input: UpdateItemInput): Promise<Item | null>;
	delete(id: string, businessId: string): Promise<boolean>;
}
