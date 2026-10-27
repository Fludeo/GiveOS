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
			getDb();
			const existingClient = getPgliteClient();
			if (existingClient) {
				await existingClient
					.exec(
						'ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "unit_cost" double precision DEFAULT 0 NOT NULL;'
					)
					.catch(() => {});

				await existingClient
					.exec(`
						CREATE TABLE IF NOT EXISTS "whatsapp_auth_keys" (
							"id" text PRIMARY KEY NOT NULL,
							"business_id" text NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,
							"key" text NOT NULL,
							"value" text NOT NULL,
							"updated_at" timestamp DEFAULT now() NOT NULL
						);
						CREATE INDEX IF NOT EXISTS "whatsapp_auth_keys_business_idx" ON "whatsapp_auth_keys" ("business_id");
						CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_auth_keys_business_key_idx" ON "whatsapp_auth_keys" ("business_id", "key");

						CREATE TABLE IF NOT EXISTS "chat_sessions" (
							"id" text PRIMARY KEY NOT NULL,
							"business_id" text NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,
							"channel" text DEFAULT 'whatsapp' NOT NULL,
							"customer_phone" text NOT NULL,
							"customer_name" text DEFAULT '' NOT NULL,
							"last_message_text" text DEFAULT '' NOT NULL,
							"last_message_at" timestamp DEFAULT now() NOT NULL,
							"unread_count" integer DEFAULT 0 NOT NULL,
							"created_at" timestamp DEFAULT now() NOT NULL,
							"updated_at" timestamp DEFAULT now() NOT NULL
						);
						CREATE INDEX IF NOT EXISTS "chat_sessions_business_idx" ON "chat_sessions" ("business_id");
						CREATE UNIQUE INDEX IF NOT EXISTS "chat_sessions_business_phone_channel_idx" ON "chat_sessions" ("business_id", "customer_phone", "channel");

						CREATE TABLE IF NOT EXISTS "chat_messages" (
							"id" text PRIMARY KEY NOT NULL,
							"session_id" text NOT NULL REFERENCES "chat_sessions"("id") ON DELETE CASCADE,
							"business_id" text NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,
							"from_me" boolean DEFAULT false NOT NULL,
							"sender_name" text DEFAULT '' NOT NULL,
							"text" text NOT NULL,
							"is_read" boolean DEFAULT false NOT NULL,
							"raw_key" jsonb,
							"timestamp" timestamp DEFAULT now() NOT NULL,
							"created_at" timestamp DEFAULT now() NOT NULL
						);
						CREATE INDEX IF NOT EXISTS "chat_messages_session_idx" ON "chat_messages" ("session_id");
						CREATE INDEX IF NOT EXISTS "chat_messages_business_idx" ON "chat_messages" ("business_id");
						CREATE INDEX IF NOT EXISTS "chat_messages_timestamp_idx" ON "chat_messages" ("timestamp");
					`)
					.catch(() => {});
			}
			if (isDev) {
				console.log('[db:migrate] Local PGlite environment detected. Skipping auto-migration on boot.');
				return;
			}
			console.log('[db:migrate] Running local PGlite migrations...');
			const client = existingClient || new PGlite(process.env.PGLITE_DATA_DIR || './.pglite_data');
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
