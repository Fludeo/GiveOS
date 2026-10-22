import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import { PGlite } from '@electric-sql/pglite';
import { dev } from '$app/env';
import * as schema from './schema';

export type AppDb = PgDatabase<any, typeof schema, any>;

let _db: AppDb | null = null;
let _pgliteClient: PGlite | null = null;

export function getPgliteClient(): PGlite | null {
	return _pgliteClient;
}

export function getDb(): AppDb {
	if (!_db) {
		const isDev = dev || process.env.NODE_ENV === 'development';
		const dbUrl = process.env.DATABASE_URL;
		const usePglite = process.env.USE_PGLITE === 'true' || (isDev && !dbUrl);

		if (usePglite) {
			const dataDir = process.env.PGLITE_DATA_DIR || './.pglite_data';
			_pgliteClient = new PGlite(dataDir);
			_db = drizzlePglite(_pgliteClient, { schema });
		} else {
			if (!dbUrl || (!dbUrl.startsWith('postgres://') && !dbUrl.startsWith('postgresql://'))) {
				throw new Error(
					'[db] DATABASE_URL is required in non-development environments. PGlite is only allowed in local development.'
				);
			}

			const client = postgres(dbUrl, {
				max: 10,
				idle_timeout: 20,
				connect_timeout: 10
			});
			_db = drizzlePostgres(client, { schema });
		}
	}
	return _db;
}
