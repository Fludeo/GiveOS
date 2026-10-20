export const INIT_SQL = `
CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified" boolean NOT NULL DEFAULT false,
  "image" text,
  "created_at" timestamp NOT NULL DEFAULT NOW(),
  "updated_at" timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY,
  "expires_at" timestamp NOT NULL,
  "token" text NOT NULL UNIQUE,
  "created_at" timestamp NOT NULL DEFAULT NOW(),
  "updated_at" timestamp NOT NULL DEFAULT NOW(),
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp,
  "refresh_token_expires_at" timestamp,
  "scope" text,
  "password" text,
  "created_at" timestamp NOT NULL DEFAULT NOW(),
  "updated_at" timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT NOW(),
  "updated_at" timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "businesses" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "whatsapp" text NOT NULL DEFAULT '',
  "opening_hours" text NOT NULL DEFAULT '',
  "created_at" timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "user_businesses" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "business_id" text NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,
  "role" text NOT NULL DEFAULT 'owner',
  "created_at" timestamp NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_businesses_user_business_unique" ON "user_businesses"("user_id", "business_id");

CREATE TABLE IF NOT EXISTS "items" (
  "id" text PRIMARY KEY,
  "business_id" text NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "type" text NOT NULL DEFAULT 'raw_material',
  "base_unit" text NOT NULL DEFAULT 'g',
  "reference_cost" double precision NOT NULL DEFAULT 0,
  "purchase_quantity" double precision NOT NULL DEFAULT 1,
  "yield_quantity" double precision NOT NULL DEFAULT 1,
  "current_stock" double precision NOT NULL DEFAULT 0,
  "min_stock" double precision NOT NULL DEFAULT 0,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "items_business_code_unique" ON "items"("business_id", "code");

CREATE TABLE IF NOT EXISTS "recipe_lines" (
  "id" text PRIMARY KEY,
  "parent_item_id" text NOT NULL REFERENCES "items"("id") ON DELETE CASCADE,
  "component_item_id" text NOT NULL REFERENCES "items"("id") ON DELETE RESTRICT,
  "quantity" double precision NOT NULL,
  "unit" text NOT NULL,
  "notes" text,
  "sort_order" integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "sales_products" (
  "id" text PRIMARY KEY,
  "business_id" text NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "sale_price" double precision NOT NULL DEFAULT 0,
  "description" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "is_shortcut" boolean NOT NULL DEFAULT false,
  "pricing_tiers" text,
  "created_at" timestamp NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "sales_products_business_code_unique" ON "sales_products"("business_id", "code");

CREATE TABLE IF NOT EXISTS "sales_product_items" (
  "id" text PRIMARY KEY,
  "sales_product_id" text NOT NULL REFERENCES "sales_products"("id") ON DELETE CASCADE,
  "item_id" text NOT NULL REFERENCES "items"("id") ON DELETE RESTRICT,
  "quantity" double precision NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS "orders" (
  "id" text PRIMARY KEY,
  "business_id" text NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,
  "order_number" text NOT NULL,
  "customer_name" text NOT NULL DEFAULT 'Cliente Mostrador',
  "status" text NOT NULL DEFAULT 'pending',
  "payment_status" text NOT NULL DEFAULT 'pending',
  "total_amount" double precision NOT NULL DEFAULT 0,
  "paid_amount" double precision NOT NULL DEFAULT 0,
  "delivery_date" timestamp,
  "notes" text,
  "transaction_id" text,
  "created_at" timestamp NOT NULL DEFAULT NOW(),
  "updated_at" timestamp NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "orders_business_number_unique" ON "orders"("business_id", "order_number");

CREATE TABLE IF NOT EXISTS "order_items" (
  "id" text PRIMARY KEY,
  "order_id" text NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "sales_product_id" text NOT NULL REFERENCES "sales_products"("id") ON DELETE RESTRICT,
  "product_name" text NOT NULL,
  "quantity" double precision NOT NULL DEFAULT 1,
  "unit_price" double precision NOT NULL DEFAULT 0,
  "fulfillment_type" text NOT NULL DEFAULT 'immediate',
  "status" text NOT NULL DEFAULT 'delivered',
  "notes" text
);
`;
