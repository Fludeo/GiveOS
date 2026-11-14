CREATE TABLE "drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"session_id" text,
	"title" text DEFAULT 'Borrador activo' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drafts_business_idx" ON "drafts" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "drafts_business_status_idx" ON "drafts" USING btree ("business_id","status");