import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import { PGlite } from '@electric-sql/pglite';
import * as schema from './schema';

export type AppDb = PgDatabase<any, typeof schema, any>;

let _db: AppDb | null = null;

export function getDb(): AppDb {
	if (!_db) {
		const dbUrl = process.env.DATABASE_URL;

		if (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
			const client = postgres(dbUrl, {
				max: 10,
				idle_timeout: 20,
				connect_timeout: 10
			});
			_db = drizzlePostgres(client, { schema });
		} else {
			const dataDir = process.env.PGLITE_DATA_DIR || './.pglite_data';
			const client = new PGlite(dataDir);
			_db = drizzlePglite(client, { schema });
		}
	}
	return _db;
}
