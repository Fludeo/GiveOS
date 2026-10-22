import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import { PGlite } from '@electric-sql/pglite';
import { dev } from '$app/env';
import * as schema from './schema';

export type AppDb = PgDatabase<any, typeof schema, any>;

const globalForDb = globalThis as unknown as {
	_db?: AppDb;
	_pgliteClient?: PGlite;
};

export function getPgliteClient(): PGlite | null {
	return globalForDb._pgliteClient ?? null;
}

export function getDb(): AppDb {
	if (!globalForDb._db) {
		const isDev = dev || process.env.NODE_ENV === 'development';
		const dbUrl = process.env.DATABASE_URL;
		const usePglite = process.env.USE_PGLITE === 'true' || (isDev && !dbUrl);

		if (usePglite) {
			const dataDir = process.env.PGLITE_DATA_DIR || './.pglite_data';
			if (!globalForDb._pgliteClient) {
				globalForDb._pgliteClient = new PGlite(dataDir);
			}
			globalForDb._db = drizzlePglite(globalForDb._pgliteClient, { schema });
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
			globalForDb._db = drizzlePostgres(client, { schema });
		}
	}
	return globalForDb._db;
}
