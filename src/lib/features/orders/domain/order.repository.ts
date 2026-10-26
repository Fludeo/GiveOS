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
} from './order.entity';

export interface IOrderRepository {
	// Sales Products & Intermediate Table `sales_product_items`
	findSalesProductsByBusiness(businessId: string): Promise<SalesProduct[]>;
	findSalesProductItemsByProductIds(salesProductIds: string[]): Promise<SalesProductItemRow[]>;
	findSalesProductById(id: string, businessId: string): Promise<SalesProduct | null>;
	findSalesProductByCode(code: string, businessId: string): Promise<SalesProduct | null>;
	createSalesProduct(input: CreateSalesProductInput & { code: string }): Promise<SalesProduct>;
	updateSalesProduct(
		id: string,
		businessId: string,
		input: UpdateSalesProductInput
	): Promise<SalesProduct | null>;
	deleteSalesProduct(id: string, businessId: string): Promise<boolean>;

	// Orders
	findOrdersByBusiness(businessId: string): Promise<OrderWithItems[]>;
	findOrderById(id: string, businessId: string): Promise<OrderWithItems | null>;
	findOrderItemById(lineId: string): Promise<OrderItem | null>;
	createOrderWithItems(
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
			transactionId?: string | null;
		},
		linesInput: Array<{
			salesProductId: string;
			productName: string;
			quantity: number;
			unitPrice: number;
			unitCost?: number;
			fulfillmentType: OrderItemFulfillmentType;
			status: OrderItemStatus;
			notes: string | null;
		}>
	): Promise<OrderWithItems>;
	updateOrder(
		id: string,
		businessId: string,
		input: {
			status?: OrderStatus;
			paymentStatus?: PaymentStatus;
			paidAmount?: number;
			deliveryDate?: Date | null;
			notes?: string | null;
			transactionId?: string | null;
		}
	): Promise<Order | null>;
	updateOrderItemStatus(lineId: string, status: OrderItemStatus): Promise<OrderItem | null>;
}
