import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { AppDb } from '#lib/server/db';
import { drafts } from '#lib/server/db/schema';
import type { Draft, DraftPayload, DraftStatus } from '../domain/draft.entity';
import type {
	CreateDraftInput,
	IDraftRepository,
	UpdateDraftInput
} from '../domain/draft.repository';

let tableInitialized = false;

export class DrizzleDraftRepository implements IDraftRepository {
	constructor(private readonly db: AppDb) {}

	private async ensureTable(): Promise<void> {
		if (tableInitialized) return;
		try {
			await this.db.execute(sql`
				CREATE TABLE IF NOT EXISTS "drafts" (
					"id" text PRIMARY KEY NOT NULL,
					"business_id" text NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,
					"session_id" text,
					"title" text DEFAULT 'Borrador activo' NOT NULL,
					"status" text DEFAULT 'active' NOT NULL,
					"payload" jsonb DEFAULT '{"entries":[]}'::jsonb NOT NULL,
					"created_at" timestamp DEFAULT now() NOT NULL,
					"updated_at" timestamp DEFAULT now() NOT NULL
				);
			`);
			tableInitialized = true;
		} catch {
			// Ignorar si ya existe o estamos en transacción
		}
	}

	private mapRow(row: typeof drafts.$inferSelect): Draft {
		const rawPayload = row.payload as DraftPayload | null;
		return {
			id: row.id,
			businessId: row.businessId,
			sessionId: row.sessionId ?? null,
			title: row.title,
			status: row.status,
			payload: {
				entries: Array.isArray(rawPayload?.entries) ? rawPayload.entries : [],
				notes: rawPayload?.notes ?? null
			},
			createdAt: row.createdAt,
			updatedAt: row.updatedAt
		};
	}

	async findById(id: string, businessId: string): Promise<Draft | null> {
		await this.ensureTable();
		const rows = await this.db
			.select()
			.from(drafts)
			.where(and(eq(drafts.id, id), eq(drafts.businessId, businessId)))
			.limit(1);
		return rows[0] ? this.mapRow(rows[0]) : null;
	}

	async findActiveByBusiness(businessId: string, sessionId?: string | null): Promise<Draft | null> {
		await this.ensureTable();
		const conditions = [eq(drafts.businessId, businessId), eq(drafts.status, 'active')];
		if (sessionId !== undefined) {
			if (sessionId === null) {
				conditions.push(isNull(drafts.sessionId));
			} else {
				conditions.push(eq(drafts.sessionId, sessionId));
			}
		}

		const rows = await this.db
			.select()
			.from(drafts)
			.where(and(...conditions))
			.orderBy(desc(drafts.updatedAt))
			.limit(1);

		return rows[0] ? this.mapRow(rows[0]) : null;
	}

	async findAllByBusiness(businessId: string, status?: DraftStatus): Promise<Draft[]> {
		await this.ensureTable();
		const conditions = [eq(drafts.businessId, businessId)];
		if (status) {
			conditions.push(eq(drafts.status, status));
		}

		const rows = await this.db
			.select()
			.from(drafts)
			.where(and(...conditions))
			.orderBy(desc(drafts.updatedAt));

		return rows.map((r) => this.mapRow(r));
	}

	async create(input: CreateDraftInput): Promise<Draft> {
		await this.ensureTable();
		const [created] = await this.db
			.insert(drafts)
			.values({
				businessId: input.businessId,
				sessionId: input.sessionId ?? null,
				title: input.title ?? 'Borrador activo',
				status: 'active',
				payload: input.payload ?? { entries: [] }
			})
			.returning();

		return this.mapRow(created);
	}

	async update(id: string, businessId: string, input: UpdateDraftInput): Promise<Draft | null> {
		await this.ensureTable();
		const updateData: Record<string, any> = {
			updatedAt: new Date()
		};
		if (input.title !== undefined) updateData.title = input.title;
		if (input.status !== undefined) updateData.status = input.status;
		if (input.payload !== undefined) updateData.payload = input.payload;

		const [updated] = await this.db
			.update(drafts)
			.set(updateData)
			.where(and(eq(drafts.id, id), eq(drafts.businessId, businessId)))
			.returning();

		return updated ? this.mapRow(updated) : null;
	}

	async delete(id: string, businessId: string): Promise<boolean> {
		await this.ensureTable();
		const deleted = await this.db
			.delete(drafts)
			.where(and(eq(drafts.id, id), eq(drafts.businessId, businessId)))
			.returning({ id: drafts.id });

		return deleted.length > 0;
	}
}
