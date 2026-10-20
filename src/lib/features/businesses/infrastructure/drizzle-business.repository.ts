import { and, asc, eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from '#lib/server/db/schema';
import type {
	Business,
	CreateBusinessForUserInput,
	UpdateBusinessInput,
	UserBusinessMembership
} from '../domain/business.entity';
import type { IBusinessRepository } from '../domain/business.repository';

export class DrizzleBusinessRepository implements IBusinessRepository {
	constructor(private readonly db: LibSQLDatabase<typeof schema>) {}

	async findBusinessesByUserId(userId: string): Promise<UserBusinessMembership[]> {
		const rows = await this.db
			.select({
				business: schema.businesses,
				role: schema.userBusinesses.role,
				joinedAt: schema.userBusinesses.createdAt
			})
			.from(schema.userBusinesses)
			.innerJoin(schema.businesses, eq(schema.userBusinesses.businessId, schema.businesses.id))
			.where(eq(schema.userBusinesses.userId, userId))
			.orderBy(asc(schema.businesses.createdAt));

		return rows.map((r) => ({
			business: r.business,
			role: r.role,
			joinedAt: r.joinedAt
		}));
	}

	async findByIdForUser(
		businessId: string,
		userId: string
	): Promise<UserBusinessMembership | null> {
		const [row] = await this.db
			.select({
				business: schema.businesses,
				role: schema.userBusinesses.role,
				joinedAt: schema.userBusinesses.createdAt
			})
			.from(schema.userBusinesses)
			.innerJoin(schema.businesses, eq(schema.userBusinesses.businessId, schema.businesses.id))
			.where(
				and(
					eq(schema.userBusinesses.businessId, businessId),
					eq(schema.userBusinesses.userId, userId)
				)
			)
			.limit(1);

		return row
			? {
					business: row.business,
					role: row.role,
					joinedAt: row.joinedAt
				}
			: null;
	}

	async createForUser(input: CreateBusinessForUserInput): Promise<UserBusinessMembership> {
		const [createdBusiness] = await this.db
			.insert(schema.businesses)
			.values({
				name: input.name.trim(),
				description: input.description.trim(),
				whatsapp: input.whatsapp.trim(),
				openingHours: input.openingHours.trim()
			})
			.returning();

		const [membership] = await this.db
			.insert(schema.userBusinesses)
			.values({
				userId: input.userId,
				businessId: createdBusiness.id,
				role: 'owner'
			})
			.returning();

		return {
			business: createdBusiness,
			role: membership.role,
			joinedAt: membership.createdAt
		};
	}

	async update(businessId: string, input: UpdateBusinessInput): Promise<Business | null> {
		const updateData: Partial<typeof schema.businesses.$inferInsert> = {};
		if (input.name !== undefined) updateData.name = input.name.trim();
		if (input.description !== undefined) updateData.description = input.description.trim();
		if (input.whatsapp !== undefined) updateData.whatsapp = input.whatsapp.trim();
		if (input.openingHours !== undefined) updateData.openingHours = input.openingHours.trim();

		const [updated] = await this.db
			.update(schema.businesses)
			.set(updateData)
			.where(eq(schema.businesses.id, businessId))
			.returning();

		return updated ?? null;
	}
}
