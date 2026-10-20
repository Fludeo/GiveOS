import { and, asc, eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from '#lib/server/db/schema';
import type {
	RecipeLine,
	RecipeLineWithComponent,
	CreateRecipeLineInput,
	UpdateRecipeLineInput
} from '../domain/recipe.entity';
import type { IRecipeRepository } from '../domain/recipe.repository';

export class DrizzleRecipeRepository implements IRecipeRepository {
	constructor(private readonly db: LibSQLDatabase<typeof schema>) {}

	async findAllLinesByBusiness(businessId: string): Promise<RecipeLine[]> {
		const rows = await this.db
			.select({ line: schema.recipeLines })
			.from(schema.recipeLines)
			.innerJoin(schema.items, eq(schema.recipeLines.parentItemId, schema.items.id))
			.where(eq(schema.items.businessId, businessId))
			.orderBy(asc(schema.recipeLines.sortOrder), asc(schema.recipeLines.id));

		return rows.map((r) => r.line);
	}

	async findLinesByParentId(
		parentItemId: string,
		businessId: string
	): Promise<RecipeLineWithComponent[]> {
		const rows = await this.db
			.select({
				line: schema.recipeLines,
				component: schema.items
			})
			.from(schema.recipeLines)
			.innerJoin(schema.items, eq(schema.recipeLines.componentItemId, schema.items.id))
			.where(
				and(
					eq(schema.recipeLines.parentItemId, parentItemId),
					eq(schema.items.businessId, businessId)
				)
			)
			.orderBy(asc(schema.recipeLines.sortOrder), asc(schema.items.name));

		return rows.map(({ line, component }) => ({
			...line,
			component
		}));
	}

	async findLineById(id: string): Promise<RecipeLine | null> {
		const [row] = await this.db
			.select()
			.from(schema.recipeLines)
			.where(eq(schema.recipeLines.id, id))
			.limit(1);
		return row ?? null;
	}

	async createLine(input: CreateRecipeLineInput): Promise<RecipeLine> {
		const [created] = await this.db
			.insert(schema.recipeLines)
			.values({
				parentItemId: input.parentItemId,
				componentItemId: input.componentItemId,
				quantity: input.quantity,
				unit: input.unit,
				notes: input.notes?.trim() || null,
				sortOrder: input.sortOrder ?? 0
			})
			.returning();

		return created;
	}

	async updateLine(id: string, input: UpdateRecipeLineInput): Promise<RecipeLine | null> {
		const updateData: Partial<typeof schema.recipeLines.$inferInsert> = {};
		if (input.quantity !== undefined) updateData.quantity = input.quantity;
		if (input.unit !== undefined) updateData.unit = input.unit;
		if (input.notes !== undefined) updateData.notes = input.notes?.trim() || null;
		if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;

		const [updated] = await this.db
			.update(schema.recipeLines)
			.set(updateData)
			.where(eq(schema.recipeLines.id, id))
			.returning();

		return updated ?? null;
	}

	async deleteLine(id: string): Promise<boolean> {
		const deleted = await this.db
			.delete(schema.recipeLines)
			.where(eq(schema.recipeLines.id, id))
			.returning({ id: schema.recipeLines.id });
		return deleted.length > 0;
	}
}
