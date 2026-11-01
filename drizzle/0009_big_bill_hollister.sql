ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "is_bot" boolean DEFAULT false NOT NULL;
