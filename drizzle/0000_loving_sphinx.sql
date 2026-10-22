CREATE TABLE IF NOT EXISTS "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "businesses" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"whatsapp" text DEFAULT '' NOT NULL,
	"opening_hours" text DEFAULT '' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "items" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'raw_material' NOT NULL,
	"base_unit" text DEFAULT 'g' NOT NULL,
	"reference_cost" double precision DEFAULT 0 NOT NULL,
	"purchase_quantity" double precision DEFAULT 1 NOT NULL,
	"yield_quantity" double precision DEFAULT 1 NOT NULL,
	"prep_time_minutes" integer DEFAULT 0 NOT NULL,
	"current_stock" double precision DEFAULT 0 NOT NULL,
	"min_stock" double precision DEFAULT 0 NOT NULL,
	"notes" text,
	"batches" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"sales_product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"quantity" double precision DEFAULT 1 NOT NULL,
	"unit_price" double precision DEFAULT 0 NOT NULL,
	"fulfillment_type" text DEFAULT 'immediate' NOT NULL,
	"status" text DEFAULT 'delivered' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"order_number" text NOT NULL,
	"customer_name" text DEFAULT 'Cliente Mostrador' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"total_amount" double precision DEFAULT 0 NOT NULL,
	"paid_amount" double precision DEFAULT 0 NOT NULL,
	"delivery_date" timestamp,
	"notes" text,
	"transaction_id" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recipe_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_item_id" text NOT NULL,
	"component_item_id" text NOT NULL,
	"quantity" double precision NOT NULL,
	"unit" text NOT NULL,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales_product_items" (
	"id" text PRIMARY KEY NOT NULL,
	"sales_product_id" text NOT NULL,
	"item_id" text NOT NULL,
	"quantity" double precision DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales_products" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"sale_price" double precision DEFAULT 0 NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_shortcut" boolean DEFAULT false NOT NULL,
	"pricing_tiers" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_businesses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"business_id" text NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_sales_product_id_sales_products_id_fk" FOREIGN KEY ("sales_product_id") REFERENCES "public"."sales_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_parent_item_id_items_id_fk" FOREIGN KEY ("parent_item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_component_item_id_items_id_fk" FOREIGN KEY ("component_item_id") REFERENCES "public"."items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_product_items" ADD CONSTRAINT "sales_product_items_sales_product_id_sales_products_id_fk" FOREIGN KEY ("sales_product_id") REFERENCES "public"."sales_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_product_items" ADD CONSTRAINT "sales_product_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_products" ADD CONSTRAINT "sales_products_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_businesses" ADD CONSTRAINT "user_businesses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_businesses" ADD CONSTRAINT "user_businesses_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "items_business_code_unique" ON "items" USING btree ("business_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_business_number_unique" ON "orders" USING btree ("business_id","order_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sales_products_business_code_unique" ON "sales_products" USING btree ("business_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_businesses_user_business_unique" ON "user_businesses" USING btree ("user_id","business_id");