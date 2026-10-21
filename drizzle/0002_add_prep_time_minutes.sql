ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "prep_time_minutes" integer DEFAULT 0 NOT NULL;
