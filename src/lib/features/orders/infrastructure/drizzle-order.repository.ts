import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from '#lib/server/db/schema';
import type {
	CreateSalesProductInput,
	Order,
	OrderItem,
	OrderItemFulfillmentType,
	OrderItemStatus,
	OrderStatus,
	OrderWithItems,
	PaymentStatus,
	SalesProduct,
	SalesProductItemRow,
	UpdateSalesProductInput
} from '../domain/order.entity';
import type { IOrderRepository } from '../domain/order.repository';

export class DrizzleOrderRepository implements IOrderRepository {
	constructor(private readonly db: LibSQLDatabase<typeof schema>) {}

	async findSalesProductsByBusiness(businessId: string): Promise<SalesProduct[]> {
		return this.db
			.select()
			.from(schema.salesProducts)
			.where(eq(schema.salesProducts.businessId, businessId))
			.orderBy(asc(schema.salesProducts.code));
	}

	async findSalesProductItemsByProductIds(
		salesProductIds: string[]
	): Promise<SalesProductItemRow[]> {
		if (salesProductIds.length === 0) return [];
		return this.db
			.select()
			.from(schema.salesProductItems)
			.where(inArray(schema.salesProductItems.salesProductId, salesProductIds));
	}

	async findSalesProductById(id: string, businessId: string): Promise<SalesProduct | null> {
		const [row] = await this.db
			.select()
			.from(schema.salesProducts)
			.where(
				and(eq(schema.salesProducts.id, id), eq(schema.salesProducts.businessId, businessId))
			)
			.limit(1);
		return row ?? null;
	}

	async findSalesProductByCode(code: string, businessId: string): Promise<SalesProduct | null> {
		const [row] = await this.db
			.select()
			.from(schema.salesProducts)
			.where(
				and(
					eq(schema.salesProducts.code, code),
					eq(schema.salesProducts.businessId, businessId)
				)
			)
			.limit(1);
		return row ?? null;
	}

	async createSalesProduct(
		input: CreateSalesProductInput & { code: string }
	): Promise<SalesProduct> {
		const [created] = await this.db
			.insert(schema.salesProducts)
			.values({
				businessId: input.businessId,
				code: input.code.trim().toUpperCase(),
				name: input.name.trim(),
				salePrice: input.salePrice >= 0 ? input.salePrice : 0,
				description: input.description?.trim() || null,
				isActive: input.isActive ?? true,
				isShortcut: input.isShortcut ?? false,
				pricingTiers: input.pricingTiers ? JSON.stringify(input.pricingTiers) : null
			})
			.returning();

		for (const comp of input.components) {
			await this.db.insert(schema.salesProductItems).values({
				salesProductId: created.id,
				itemId: comp.itemId,
				quantity: comp.quantity > 0 ? comp.quantity : 1
			});
		}

		return created;
	}

	async updateSalesProduct(
		id: string,
		businessId: string,
		input: UpdateSalesProductInput
	): Promise<SalesProduct | null> {
		const updateData: Partial<typeof schema.salesProducts.$inferInsert> = {};
		if (input.name !== undefined) updateData.name = input.name.trim();
		if (input.salePrice !== undefined) {
			updateData.salePrice = input.salePrice >= 0 ? input.salePrice : 0;
		}
		if (input.description !== undefined) {
			updateData.description = input.description?.trim() || null;
		}
		if (input.isActive !== undefined) updateData.isActive = input.isActive;
		if (input.isShortcut !== undefined) updateData.isShortcut = input.isShortcut;
		if (input.pricingTiers !== undefined) {
			updateData.pricingTiers = input.pricingTiers ? JSON.stringify(input.pricingTiers) : null;
		}

		const [updated] = await this.db
			.update(schema.salesProducts)
			.set(updateData)
			.where(
				and(eq(schema.salesProducts.id, id), eq(schema.salesProducts.businessId, businessId))
			)
			.returning();

		if (!updated) return null;

		if (input.components && input.components.length > 0) {
			await this.db
				.delete(schema.salesProductItems)
				.where(eq(schema.salesProductItems.salesProductId, id));

			for (const comp of input.components) {
				await this.db.insert(schema.salesProductItems).values({
					salesProductId: id,
					itemId: comp.itemId,
					quantity: comp.quantity > 0 ? comp.quantity : 1
				});
			}
		}

		return updated;
	}

	async deleteSalesProduct(id: string, businessId: string): Promise<boolean> {
		const deleted = await this.db
			.delete(schema.salesProducts)
			.where(
				and(eq(schema.salesProducts.id, id), eq(schema.salesProducts.businessId, businessId))
			)
			.returning({ id: schema.salesProducts.id });
		return deleted.length > 0;
	}

	async findOrdersByBusiness(businessId: string): Promise<OrderWithItems[]> {
		const orderRows = await this.db
			.select()
			.from(schema.orders)
			.where(eq(schema.orders.businessId, businessId))
			.orderBy(desc(schema.orders.createdAt));

		if (orderRows.length === 0) return [];

		const orderIds = orderRows.map((o) => o.id);
		const itemRows = await this.db
			.select()
			.from(schema.orderItems)
			.where(inArray(schema.orderItems.orderId, orderIds));

		const itemsByOrder = new Map<string, OrderItem[]>();
		for (const item of itemRows) {
			const list = itemsByOrder.get(item.orderId) ?? [];
			list.push(item);
			itemsByOrder.set(item.orderId, list);
		}

		return orderRows.map((order) => ({
			...order,
			items: itemsByOrder.get(order.id) ?? []
		}));
	}

	async findOrderById(id: string, businessId: string): Promise<OrderWithItems | null> {
		const [order] = await this.db
			.select()
			.from(schema.orders)
			.where(and(eq(schema.orders.id, id), eq(schema.orders.businessId, businessId)))
			.limit(1);

		if (!order) return null;

		const items = await this.db
			.select()
			.from(schema.orderItems)
			.where(eq(schema.orderItems.orderId, order.id));

		return {
			...order,
			items
		};
	}

	async findOrderItemById(lineId: string): Promise<OrderItem | null> {
		const [row] = await this.db
			.select()
			.from(schema.orderItems)
			.where(eq(schema.orderItems.id, lineId))
			.limit(1);
		return row ?? null;
	}

	async createOrderWithItems(
		orderInput: {
			businessId: string;
			orderNumber: string;
			customerName: string;
			status: OrderStatus;
			paymentStatus: PaymentStatus;
			totalAmount: number;
			paidAmount: number;
			deliveryDate: Date | null;
			notes: string | null;
		},
		linesInput: Array<{
			salesProductId: string;
			productName: string;
			quantity: number;
			unitPrice: number;
			fulfillmentType: OrderItemFulfillmentType;
			status: OrderItemStatus;
			notes: string | null;
		}>
	): Promise<OrderWithItems> {
		const [createdOrder] = await this.db
			.insert(schema.orders)
			.values({
				businessId: orderInput.businessId,
				orderNumber: orderInput.orderNumber,
				customerName: orderInput.customerName,
				status: orderInput.status,
				paymentStatus: orderInput.paymentStatus,
				totalAmount: orderInput.totalAmount,
				paidAmount: orderInput.paidAmount,
				deliveryDate: orderInput.deliveryDate,
				notes: orderInput.notes
			})
			.returning();

		const createdItems: OrderItem[] = [];
		for (const line of linesInput) {
			const [createdLine] = await this.db
				.insert(schema.orderItems)
				.values({
					orderId: createdOrder.id,
					salesProductId: line.salesProductId,
					productName: line.productName,
					quantity: line.quantity,
					unitPrice: line.unitPrice,
					fulfillmentType: line.fulfillmentType,
					status: line.status,
					notes: line.notes
				})
				.returning();
			createdItems.push(createdLine);
		}

		return {
			...createdOrder,
			items: createdItems
		};
	}

	async updateOrder(
		id: string,
		businessId: string,
		input: {
			status?: OrderStatus;
			paymentStatus?: PaymentStatus;
			paidAmount?: number;
			deliveryDate?: Date | null;
			notes?: string | null;
		}
	): Promise<Order | null> {
		const updateData: Partial<typeof schema.orders.$inferInsert> = {
			updatedAt: new Date()
		};
		if (input.status !== undefined) updateData.status = input.status;
		if (input.paymentStatus !== undefined) updateData.paymentStatus = input.paymentStatus;
		if (input.paidAmount !== undefined) updateData.paidAmount = input.paidAmount;
		if (input.deliveryDate !== undefined) updateData.deliveryDate = input.deliveryDate;
		if (input.notes !== undefined) updateData.notes = input.notes;

		const [updated] = await this.db
			.update(schema.orders)
			.set(updateData)
			.where(and(eq(schema.orders.id, id), eq(schema.orders.businessId, businessId)))
			.returning();

		return updated ?? null;
	}

	async updateOrderItemStatus(lineId: string, status: OrderItemStatus): Promise<OrderItem | null> {
		const [updated] = await this.db
			.update(schema.orderItems)
			.set({ status })
			.where(eq(schema.orderItems.id, lineId))
			.returning();
		return updated ?? null;
	}
}
