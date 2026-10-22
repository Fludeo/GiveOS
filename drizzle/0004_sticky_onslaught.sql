ALTER TABLE "items" ADD COLUMN "batches" jsonb DEFAULT '[]'::jsonb NOT NULL;
