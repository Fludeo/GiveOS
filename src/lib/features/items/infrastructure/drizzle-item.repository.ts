import { and, asc, eq } from 'drizzle-orm';
import type { AppDb } from '#lib/server/db/index';
import * as schema from '#lib/server/db/schema';
import {
	normalizeItemType,
	type CreateItemInput,
	type Item,
	type ItemType,
	type UpdateItemInput
} from '../domain/item.entity';
import type { IItemRepository } from '../domain/item.repository';

function mapRow(row: typeof schema.items.$inferSelect): Item {
	return {
		...row,
		type: normalizeItemType(row.type)
	};
}

export class DrizzleItemRepository implements IItemRepository {
	constructor(private readonly db: AppDb) {}

	async findAllByBusiness(
		businessId: string,
		filter?: { type?: ItemType; search?: string }
	): Promise<Item[]> {
		const rawRows = await this.db
			.select()
			.from(schema.items)
			.where(eq(schema.items.businessId, businessId))
			.orderBy(asc(schema.items.type), asc(schema.items.code));

		const rows = rawRows.map((r) => mapRow(r));

		return rows.filter((row) => {
			if (filter?.type && row.type !== filter.type) return false;
			if (filter?.search) {
				const q = filter.search.toLowerCase().trim();
				if (
					!row.name.toLowerCase().includes(q) &&
					!row.code.toLowerCase().includes(q)
				) {
					return false;
				}
			}
			return true;
		});
	}

	async findById(id: string, businessId: string): Promise<Item | null> {
		const [row] = await this.db
			.select()
			.from(schema.items)
			.where(and(eq(schema.items.id, id), eq(schema.items.businessId, businessId)))
			.limit(1);
		return row ? mapRow(row) : null;
	}

	async findByCode(code: string, businessId: string): Promise<Item | null> {
		const [row] = await this.db
			.select()
			.from(schema.items)
			.where(and(eq(schema.items.code, code), eq(schema.items.businessId, businessId)))
			.limit(1);
		return row ? mapRow(row) : null;
	}

	async create(input: CreateItemInput & { code: string }): Promise<Item> {
		const [created] = await this.db
			.insert(schema.items)
			.values({
				businessId: input.businessId,
				code: input.code.trim().toUpperCase(),
				name: input.name.trim(),
				type: input.type,
				baseUnit: input.baseUnit,
				referenceCost: input.referenceCost,
				purchaseQuantity: input.purchaseQuantity > 0 ? input.purchaseQuantity : 1,
				yieldQuantity: input.yieldQuantity && input.yieldQuantity > 0 ? input.yieldQuantity : 1,
				currentStock: input.currentStock ?? 0,
				minStock: input.minStock ?? 0,
				notes: input.notes?.trim() || null
			})
			.returning();

		return mapRow(created);
	}

	async update(id: string, businessId: string, input: UpdateItemInput): Promise<Item | null> {
		const updateData: Partial<typeof schema.items.$inferInsert> = {};
		if (input.code !== undefined) updateData.code = input.code.trim().toUpperCase();
		if (input.name !== undefined) updateData.name = input.name.trim();
		if (input.type !== undefined) updateData.type = input.type;
		if (input.baseUnit !== undefined) updateData.baseUnit = input.baseUnit;
		if (input.referenceCost !== undefined) updateData.referenceCost = input.referenceCost;
		if (input.purchaseQuantity !== undefined) {
			updateData.purchaseQuantity = input.purchaseQuantity > 0 ? input.purchaseQuantity : 1;
		}
		if (input.yieldQuantity !== undefined) {
			updateData.yieldQuantity = input.yieldQuantity > 0 ? input.yieldQuantity : 1;
		}
		if (input.currentStock !== undefined) {
			updateData.currentStock = input.currentStock >= 0 ? input.currentStock : 0;
		}
		if (input.minStock !== undefined) {
			updateData.minStock = input.minStock >= 0 ? input.minStock : 0;
		}
		if (input.notes !== undefined) updateData.notes = input.notes?.trim() || null;

		const [updated] = await this.db
			.update(schema.items)
			.set(updateData)
			.where(and(eq(schema.items.id, id), eq(schema.items.businessId, businessId)))
			.returning();

		return updated ? mapRow(updated) : null;
	}

	async delete(id: string, businessId: string): Promise<boolean> {
		const deleted = await this.db
			.delete(schema.items)
			.where(and(eq(schema.items.id, id), eq(schema.items.businessId, businessId)))
			.returning({ id: schema.items.id });
		return deleted.length > 0;
	}
}
