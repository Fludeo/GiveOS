import postgres from 'postgres';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

export async function runMigrations() {
	if (!fs.existsSync('./drizzle')) {
		console.log('[db:migrate] No migrations folder found, skipping.');
		return;
	}

	const dbUrl = process.env.DATABASE_URL;

	try {
		if (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
			console.log('[db:migrate] Connecting to Postgres for migrations...');
			const migrationClient = postgres(dbUrl, { max: 1 });
			const db = drizzlePostgres(migrationClient);

			// Direct DDL safeguard to ensure critical schema patches are applied immediately
			try {
				await migrationClient.unsafe(`
					ALTER TABLE IF EXISTS "items" ADD COLUMN IF NOT EXISTS "prep_time_minutes" integer DEFAULT 0 NOT NULL;
					UPDATE "items" SET "type" = 'prepared' WHERE "type" IN ('sub_assembly', 'finished_product');
				`);
				console.log('[db:migrate] Applied direct DDL safeguards.');
			} catch (ddlErr) {
				console.warn('[db:migrate] Direct DDL safeguard notice:', ddlErr);
			}

			console.log('[db:migrate] Running Drizzle migrations...');
			await migratePostgres(db, { migrationsFolder: './drizzle' });
			console.log('[db:migrate] Migrations completed successfully.');
			await migrationClient.end();
		} else {
			console.log('[db:migrate] Running local PGlite migrations...');
			const dataDir = process.env.PGLITE_DATA_DIR || './.pglite_data';
			const client = new PGlite(dataDir);
			const db = drizzlePglite(client);
			await migratePglite(db, { migrationsFolder: './drizzle' });
			console.log('[db:migrate] PGlite migrations completed.');
		}
	} catch (error) {
		console.error('[db:migrate] Migration error:', error);
	}
}
