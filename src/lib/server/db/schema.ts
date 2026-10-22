// GiveOS PostgreSQL Schema - Drizzle ORM
import { v7 as uuidv7 } from 'uuid';
import {
	boolean,
	doublePrecision,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';

// ==========================================
// Better Auth Schema (PostgreSQL)
// ==========================================

export const user = pgTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').notNull().default(false),
	image: text('image'),
	createdAt: timestamp('created_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: timestamp('updated_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const session = pgTable('session', {
	id: text('id').primaryKey(),
	expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
	token: text('token').notNull().unique(),
	createdAt: timestamp('created_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: timestamp('updated_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date()),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' })
});

export const account = pgTable('account', {
	id: text('id').primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: timestamp('access_token_expires_at', { mode: 'date' }),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { mode: 'date' }),
	scope: text('scope'),
	password: text('password'),
	createdAt: timestamp('created_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: timestamp('updated_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const verification = pgTable('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
	createdAt: timestamp('created_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: timestamp('updated_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date())
});

// ==========================================
// Domain Schema: Businesses (Many-to-Many with Users)
// ==========================================

export const BUSINESS_ROLES = ['owner', 'admin', 'member'] as const;
export type BusinessRole = (typeof BUSINESS_ROLES)[number];

export const businesses = pgTable('businesses', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => uuidv7()),
	name: text('name').notNull(),
	description: text('description').notNull().default(''),
	whatsapp: text('whatsapp').notNull().default(''),
	openingHours: text('opening_hours').notNull().default(''),
	createdAt: timestamp('created_at', { mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const userBusinesses = pgTable(
	'user_businesses',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => uuidv7()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		businessId: text('business_id')
			.notNull()
			.references(() => businesses.id, { onDelete: 'cascade' }),
		role: text('role').$type<BusinessRole>().notNull().default('owner'),
		createdAt: timestamp('created_at', { mode: 'date' })
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

export const ITEM_TYPES = ['raw_material', 'prepared'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const UNITS_OF_MEASURE = ['g', 'kg', 'ml', 'l', 'unit'] as const;
export type UnitOfMeasure = (typeof UNITS_OF_MEASURE)[number];
import type { ItemStockBatch } from '#lib/features/items/domain/item.entity';

export const items = pgTable(
	'items',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => uuidv7()),
		businessId: text('business_id')
			.notNull()
			.references(() => businesses.id, { onDelete: 'cascade' }),
		code: text('code').notNull(),
		name: text('name').notNull(),
		type: text('type').$type<ItemType>().notNull().default('raw_material'),
		baseUnit: text('base_unit').$type<UnitOfMeasure>().notNull().default('g'),
		/** Costo de referencia por lote/unidad de compra (para materias primas) */
		referenceCost: doublePrecision('reference_cost').notNull().default(0),
		/** Cantidad a la que corresponde el costo de referencia (ej. 1 kg o 1000 g) */
		purchaseQuantity: doublePrecision('purchase_quantity').notNull().default(1),
		/** Rendimiento base cuando este ítem se produce mediante una Receta (ej. 1 torta o 1000 g de crema) */
		yieldQuantity: doublePrecision('yield_quantity').notNull().default(1),
		/** Tiempo estimado de elaboración en minutos */
		prepTimeMinutes: integer('prep_time_minutes').notNull().default(0),
		/** Si el tiempo de preparación es proporcional por unidad producida o fijo por lote completo */
		isPrepTimeScalable: boolean('is_prep_time_scalable').notNull().default(false),
		/** Stock actual en unidad base */
		currentStock: doublePrecision('current_stock').notNull().default(0),
		/** Stock mínimo de alerta en unidad base */
		minStock: doublePrecision('min_stock').notNull().default(0),
		notes: text('notes'),
		batches: jsonb('batches').$type<ItemStockBatch[]>().notNull().default([]),
		createdAt: timestamp('created_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [uniqueIndex('items_business_code_unique').on(table.businessId, table.code)]
);

export const recipeLines = pgTable('recipe_lines', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => uuidv7()),
	parentItemId: text('parent_item_id')
		.notNull()
		.references(() => items.id, { onDelete: 'cascade' }),
	componentItemId: text('component_item_id')
		.notNull()
		.references(() => items.id, { onDelete: 'restrict' }),
	quantity: doublePrecision('quantity').notNull(),
	unit: text('unit').$type<UnitOfMeasure>().notNull(),
	notes: text('notes'),
	sortOrder: integer('sort_order').notNull().default(0)
});

// ==========================================
// Domain Schema: Sales Products & Hybrid Orders
// ==========================================

export const salesProducts = pgTable(
	'sales_products',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => uuidv7()),
		businessId: text('business_id')
			.notNull()
			.references(() => businesses.id, { onDelete: 'cascade' }),
		code: text('code').notNull(),
		name: text('name').notNull(),
		salePrice: doublePrecision('sale_price').notNull().default(0),
		description: text('description'),
		isActive: boolean('is_active').notNull().default(true),
		isShortcut: boolean('is_shortcut').notNull().default(false),
		pricingTiers: text('pricing_tiers'),
		createdAt: timestamp('created_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [uniqueIndex('sales_products_business_code_unique').on(table.businessId, table.code)]
);

export const salesProductItems = pgTable('sales_product_items', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => uuidv7()),
	salesProductId: text('sales_product_id')
		.notNull()
		.references(() => salesProducts.id, { onDelete: 'cascade' }),
	itemId: text('item_id')
		.notNull()
		.references(() => items.id, { onDelete: 'restrict' }),
	quantity: doublePrecision('quantity').notNull().default(1)
});

export const ORDER_STATUSES = ['unconfirmed', 'pending', 'completed', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ['pending', 'partially_paid', 'paid'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ORDER_ITEM_FULFILLMENT_TYPES = ['immediate', 'preorder'] as const;
export type OrderItemFulfillmentType = (typeof ORDER_ITEM_FULFILLMENT_TYPES)[number];

export const ORDER_ITEM_STATUSES = ['pending_delivery', 'delivered', 'cancelled'] as const;
export type OrderItemStatus = (typeof ORDER_ITEM_STATUSES)[number];

export const orders = pgTable(
	'orders',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => uuidv7()),
		businessId: text('business_id')
			.notNull()
			.references(() => businesses.id, { onDelete: 'cascade' }),
		orderNumber: text('order_number').notNull(),
		customerName: text('customer_name').notNull().default('Cliente Mostrador'),
		status: text('status').$type<OrderStatus>().notNull().default('pending'),
		paymentStatus: text('payment_status').$type<PaymentStatus>().notNull().default('pending'),
		totalAmount: doublePrecision('total_amount').notNull().default(0),
		paidAmount: doublePrecision('paid_amount').notNull().default(0),
		deliveryDate: timestamp('delivery_date', { mode: 'date' }),
		notes: text('notes'),
		transactionId: text('transaction_id'),
		createdAt: timestamp('created_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: timestamp('updated_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [uniqueIndex('orders_business_number_unique').on(table.businessId, table.orderNumber)]
);

export const orderItems = pgTable('order_items', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => uuidv7()),
	orderId: text('order_id')
		.notNull()
		.references(() => orders.id, { onDelete: 'cascade' }),
	salesProductId: text('sales_product_id')
		.notNull()
		.references(() => salesProducts.id, { onDelete: 'restrict' }),
	productName: text('product_name').notNull(),
	quantity: doublePrecision('quantity').notNull().default(1),
	unitPrice: doublePrecision('unit_price').notNull().default(0),
	fulfillmentType: text('fulfillment_type')
		.$type<OrderItemFulfillmentType>()
		.notNull()
		.default('immediate'),
	status: text('status').$type<OrderItemStatus>().notNull().default('delivered'),
	notes: text('notes')
});
