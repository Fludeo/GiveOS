CREATE TABLE "chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"business_id" text NOT NULL,
	"from_me" boolean DEFAULT false NOT NULL,
	"sender_name" text DEFAULT '' NOT NULL,
	"text" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"raw_key" jsonb,
	"timestamp" timestamp NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"channel" text DEFAULT 'whatsapp' NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_name" text DEFAULT '' NOT NULL,
	"last_message_text" text DEFAULT '' NOT NULL,
	"last_message_at" timestamp NOT NULL,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_session_idx" ON "chat_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "chat_messages_business_idx" ON "chat_messages" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "chat_messages_timestamp_idx" ON "chat_messages" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "chat_sessions_business_idx" ON "chat_sessions" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_sessions_business_phone_channel_idx" ON "chat_sessions" USING btree ("business_id","customer_phone","channel");