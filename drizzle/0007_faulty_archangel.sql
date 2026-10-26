CREATE TABLE "whatsapp_auth_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whatsapp_auth_keys" ADD CONSTRAINT "whatsapp_auth_keys_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "whatsapp_auth_keys_business_idx" ON "whatsapp_auth_keys" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_auth_keys_business_key_idx" ON "whatsapp_auth_keys" USING btree ("business_id","key");