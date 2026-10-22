import postgres from 'postgres';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import { dev } from '$app/env';

import { getDb, getPgliteClient } from './index';

export async function runMigrations() {
	if (!fs.existsSync('./drizzle')) {
		console.log('[db:migrate] No migrations folder found, skipping.');
		return;
	}

	const isDev = dev || process.env.NODE_ENV === 'development';
	let dbUrl = process.env.DATABASE_URL;
	if (!dbUrl && fs.existsSync('./.env')) {
		const match = fs.readFileSync('./.env', 'utf8').match(/^DATABASE_URL=(.+)$/m);
		if (match) dbUrl = match[1].trim();
	}
	const usePglite = process.env.USE_PGLITE === 'true' || !dbUrl;

	try {
		if (usePglite) {
			if (isDev) {
				console.log('[db:migrate] Local PGlite environment detected. Skipping auto-migration on boot.');
				return;
			}
			console.log('[db:migrate] Running local PGlite migrations...');
			const db = getDb();
			const client = getPgliteClient() || new PGlite(process.env.PGLITE_DATA_DIR || './.pglite_data');
			const migDb = drizzlePglite(client);
			await migratePglite(migDb, { migrationsFolder: './drizzle' });
			console.log('[db:migrate] PGlite migrations completed.');
		} else {
			if (!dbUrl) {
				throw new Error(
					'[db:migrate] DATABASE_URL is not set. PGlite is only allowed in local development.'
				);
			}

			console.log('[db:migrate] Connecting to Postgres for migrations...');
			const migrationClient = postgres(dbUrl, { max: 1 });
			const db = drizzlePostgres(migrationClient);

			console.log('[db:migrate] Running Drizzle migrations...');
			await migratePostgres(db, { migrationsFolder: './drizzle' });
			console.log('[db:migrate] Migrations completed successfully.');
			await migrationClient.end();
		}
	} catch (error) {
		console.error('[db:migrate] Migration error:', error);
		if (!isDev) {
			throw error;
		}
	}
}
