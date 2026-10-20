import { integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// ==========================================
// Better Auth Schema (SQLite)
// ==========================================

export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
	image: text('image'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export const session = sqliteTable('session', {
	id: text('id').primaryKey(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	token: text('token').notNull().unique(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' })
});

export const account = sqliteTable('account', {
	id: text('id').primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
	refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
	scope: text('scope'),
	password: text('password'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export const verification = sqliteTable('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
});

// ==========================================
// Domain Schema: Businesses (Many-to-Many with Users)
// ==========================================

export const BUSINESS_ROLES = ['owner', 'admin', 'member'] as const;
export type BusinessRole = (typeof BUSINESS_ROLES)[number];

export const businesses = sqliteTable('businesses', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	description: text('description').notNull().default(''),
	whatsapp: text('whatsapp').notNull().default(''),
	openingHours: text('opening_hours').notNull().default(''),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const userBusinesses = sqliteTable(
	'user_businesses',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		businessId: text('business_id')
			.notNull()
			.references(() => businesses.id, { onDelete: 'cascade' }),
		role: text('role', { enum: BUSINESS_ROLES }).notNull().default('owner'),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [
		uniqueIndex('user_businesses_user_business_unique').on(table.userId, table.businessId)
	]
);

// ==========================================
// Domain Schema: Items & Multi-level Recipes (Scoped to Business)
// ==========================================

export const ITEM_TYPES = ['raw_material', 'sub_assembly', 'finished_product'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const UNITS_OF_MEASURE = ['g', 'kg', 'ml', 'l', 'unit'] as const;
export type UnitOfMeasure = (typeof UNITS_OF_MEASURE)[number];

export const items = sqliteTable(
	'items',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		businessId: text('business_id')
			.notNull()
			.references(() => businesses.id, { onDelete: 'cascade' }),
		code: text('code').notNull(),
		name: text('name').notNull(),
		type: text('type', { enum: ITEM_TYPES }).notNull().default('raw_material'),
		baseUnit: text('base_unit', { enum: UNITS_OF_MEASURE }).notNull().default('g'),
		/** Costo de referencia por lote/unidad de compra (para materias primas) */
		referenceCost: real('reference_cost').notNull().default(0),
		/** Cantidad a la que corresponde el costo de referencia (ej. 1 kg o 1000 g) */
		purchaseQuantity: real('purchase_quantity').notNull().default(1),
		/** Rendimiento base cuando este ítem se produce mediante una Receta (ej. 1 torta o 1000 g de crema) */
		yieldQuantity: real('yield_quantity').notNull().default(1),
		/** Stock actual en unidad base */
		currentStock: real('current_stock').notNull().default(0),
		/** Stock mínimo de alerta en unidad base */
		minStock: real('min_stock').notNull().default(0),
		notes: text('notes'),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [uniqueIndex('items_business_code_unique').on(table.businessId, table.code)]
);

export const recipeLines = sqliteTable('recipe_lines', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	parentItemId: text('parent_item_id')
		.notNull()
		.references(() => items.id, { onDelete: 'cascade' }),
	componentItemId: text('component_item_id')
		.notNull()
		.references(() => items.id, { onDelete: 'restrict' }),
	quantity: real('quantity').notNull(),
	unit: text('unit', { enum: UNITS_OF_MEASURE }).notNull(),
	notes: text('notes'),
	sortOrder: integer('sort_order').notNull().default(0)
});

// ==========================================
// Domain Schema: Sales Products & Hybrid Orders
// ==========================================

export const salesProducts = sqliteTable(
	'sales_products',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		businessId: text('business_id')
			.notNull()
			.references(() => businesses.id, { onDelete: 'cascade' }),
		code: text('code').notNull(),
		name: text('name').notNull(),
		salePrice: real('sale_price').notNull().default(0),
		description: text('description'),
		isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
		isShortcut: integer('is_shortcut', { mode: 'boolean' }).notNull().default(false),
		pricingTiers: text('pricing_tiers'),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [uniqueIndex('sales_products_business_code_unique').on(table.businessId, table.code)]
);

export const salesProductItems = sqliteTable('sales_product_items', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	salesProductId: text('sales_product_id')
		.notNull()
		.references(() => salesProducts.id, { onDelete: 'cascade' }),
	itemId: text('item_id')
		.notNull()
		.references(() => items.id, { onDelete: 'restrict' }),
	quantity: real('quantity').notNull().default(1)
});

export const ORDER_STATUSES = ['unconfirmed', 'pending', 'completed', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ['pending', 'partially_paid', 'paid'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ORDER_ITEM_FULFILLMENT_TYPES = ['immediate', 'preorder'] as const;
export type OrderItemFulfillmentType = (typeof ORDER_ITEM_FULFILLMENT_TYPES)[number];

export const ORDER_ITEM_STATUSES = ['pending_delivery', 'delivered', 'cancelled'] as const;
export type OrderItemStatus = (typeof ORDER_ITEM_STATUSES)[number];

export const orders = sqliteTable(
	'orders',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		businessId: text('business_id')
			.notNull()
			.references(() => businesses.id, { onDelete: 'cascade' }),
		orderNumber: text('order_number').notNull(),
		customerName: text('customer_name').notNull().default('Cliente Mostrador'),
		status: text('status', { enum: ORDER_STATUSES }).notNull().default('pending'),
		paymentStatus: text('payment_status', { enum: PAYMENT_STATUSES }).notNull().default('pending'),
		totalAmount: real('total_amount').notNull().default(0),
		paidAmount: real('paid_amount').notNull().default(0),
		deliveryDate: integer('delivery_date', { mode: 'timestamp' }),
		notes: text('notes'),
		transactionId: text('transaction_id'),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [uniqueIndex('orders_business_number_unique').on(table.businessId, table.orderNumber)]
);

export const orderItems = sqliteTable('order_items', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	orderId: text('order_id')
		.notNull()
		.references(() => orders.id, { onDelete: 'cascade' }),
	salesProductId: text('sales_product_id')
		.notNull()
		.references(() => salesProducts.id, { onDelete: 'restrict' }),
	productName: text('product_name').notNull(),
	quantity: real('quantity').notNull().default(1),
	unitPrice: real('unit_price').notNull().default(0),
	fulfillmentType: text('fulfillment_type', { enum: ORDER_ITEM_FULFILLMENT_TYPES })
		.notNull()
		.default('immediate'),
	status: text('status', { enum: ORDER_ITEM_STATUSES }).notNull().default('delivered'),
	notes: text('notes')
});
