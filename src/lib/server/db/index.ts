import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { DATABASE_URL } from '$app/env/private';

let _db: LibSQLDatabase<typeof schema> | null = null;

export function getDb(): LibSQLDatabase<typeof schema> {
	if (!_db) {
		if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');
		const client = createClient({ url: DATABASE_URL });
		_db = drizzle(client, { schema });
	}
	return _db;
}
