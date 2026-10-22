import type { Item, ItemType, UnitOfMeasure } from '#lib/features/items/domain/item.entity';

export const ORDER_STATUSES = ['unconfirmed', 'pending', 'completed', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
	unconfirmed: 'Por Confirmar',
	pending: 'Confirmada (Con encargos)',
	completed: 'Completada',
	cancelled: 'Cancelada'
};

export const PAYMENT_STATUSES = ['pending', 'partially_paid', 'paid'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
	pending: 'Sin Pagar',
	partially_paid: 'Pago Parcial',
	paid: 'Pagado'
};

export const ORDER_ITEM_FULFILLMENT_TYPES = ['immediate', 'preorder'] as const;
export type OrderItemFulfillmentType = (typeof ORDER_ITEM_FULFILLMENT_TYPES)[number];

export const FULFILLMENT_TYPE_LABELS: Record<OrderItemFulfillmentType, string> = {
	immediate: 'Entrega en el momento',
	preorder: 'Pedido por encargo'
};

export const ORDER_ITEM_STATUSES = ['pending_delivery', 'delivered', 'cancelled'] as const;
export type OrderItemStatus = (typeof ORDER_ITEM_STATUSES)[number];

export const ORDER_ITEM_STATUS_LABELS: Record<OrderItemStatus, string> = {
	pending_delivery: 'Pendiente de entrega',
	delivered: 'Entregado',
	cancelled: 'Cancelado'
};

/**
 * Línea de la tabla intermedia `sales_product_items` que vincula un Producto Comercial
 * con uno o varios ítems de inventario (insumos o elaboraciones) para soportar productos simples y combos.
 */
export interface SalesProductItemRow {
	id: string;
	salesProductId: string;
	itemId: string;
	quantity: number;
}

export interface SalesProductComponentWithItem extends SalesProductItemRow {
	item: Item | null;
	lineRecipeCost: number;
}

/**
 * Escala de precios / descuento por cantidad para un producto comercial.
 */
export interface PriceTier {
	minQuantity: number;
	type: 'percentage' | 'fixed_price';
	value: number;
}

export function calculateEffectiveUnitPrice(
	salePrice: number,
	quantity: number,
	tiers: PriceTier[] = []
): {
	unitPrice: number;
	discountPct: number;
	appliedTier: PriceTier | null;
} {
	if (!tiers || tiers.length === 0 || quantity <= 0) {
		return { unitPrice: salePrice, discountPct: 0, appliedTier: null };
	}

	const eligible = [...tiers]
		.filter((t) => quantity >= t.minQuantity && t.minQuantity > 0)
		.sort((a, b) => b.minQuantity - a.minQuantity);

	if (eligible.length === 0) {
		return { unitPrice: salePrice, discountPct: 0, appliedTier: null };
	}

	const bestTier = eligible[0];
	let unitPrice = salePrice;
	let discountPct = 0;

	if (bestTier.type === 'percentage') {
		discountPct = Math.max(0, Math.min(100, Number(bestTier.value) || 0));
		unitPrice = Number((salePrice * (1 - discountPct / 100)).toFixed(2));
	} else if (bestTier.type === 'fixed_price') {
		unitPrice = Math.max(0, Number(bestTier.value) || 0);
		discountPct = salePrice > 0 ? Number((((salePrice - unitPrice) / salePrice) * 100).toFixed(1)) : 0;
	}

	return { unitPrice, discountPct, appliedTier: bestTier };
}

/**
 * Producto comercial disponible para la venta en Órdenes (simple o combo).
 */
export interface SalesProduct {
	id: string;
	businessId: string;
	code: string;
	name: string;
	salePrice: number;
	description: string | null;
	isActive: boolean;
	isShortcut: boolean;
	pricingTiers?: PriceTier[] | string | null;
	createdAt: Date;
}

export interface SalesProductWithItems extends Omit<SalesProduct, 'pricingTiers'> {
	pricingTiers: PriceTier[];
	components: SalesProductComponentWithItem[];
	estimatedRecipeCost: number;
	isCombo: boolean;
}

export interface SalesProductComponentInput {
	itemId: string;
	quantity: number;
}

export interface CreateSalesProductInput {
	businessId: string;
	code?: string;
	name: string;
	salePrice: number;
	description?: string | null;
	isActive?: boolean;
	isShortcut?: boolean;
	pricingTiers?: PriceTier[];
	components: SalesProductComponentInput[];
}

export interface UpdateSalesProductInput {
	name?: string;
	salePrice?: number;
	description?: string | null;
	isActive?: boolean;
	isShortcut?: boolean;
	pricingTiers?: PriceTier[];
	components?: SalesProductComponentInput[];
}

export interface OrderItem {
	id: string;
	orderId: string;
	salesProductId: string;
	productName: string;
	quantity: number;
	unitPrice: number;
	fulfillmentType: OrderItemFulfillmentType;
	status: OrderItemStatus;
	notes: string | null;
}

export interface Order {
	id: string;
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
	createdAt: Date;
	updatedAt: Date;
}

export interface OrderWithItems extends Order {
	items: OrderItem[];
}

export interface CreateOrderLineInput {
	salesProductId: string;
	quantity: number;
	unitPrice?: number;
	fulfillmentType: OrderItemFulfillmentType;
	notes?: string | null;
}

export interface CreateOrderInput {
	businessId: string;
	customerName?: string;
	status?: OrderStatus;
	paymentStatus?: PaymentStatus;
	paidAmount?: number;
	deliveryDate?: Date | null;
	notes?: string | null;
	transactionId?: string | null;
	lines: CreateOrderLineInput[];
}

export interface PreorderForecastLine {
	itemId: string;
	code: string;
	name: string;
	type: ItemType;
	baseUnit: UnitOfMeasure;
	currentStock: number;
	minStock: number;
	requiredQuantity: number;
	projectedBalance: number;
	deficitQuantity: number;
	isShortage: boolean;
	prepTimeMinutes?: number;
	passiveTimeMinutes?: number;
	isPrepTimeScalable?: boolean;
	yieldQuantity?: number;
	batchesNeededForDeficit?: number;
	laborMinutesForDeficit?: number;
	laborMinutesTotalDemand?: number;
	laborCostForDeficit?: number;
	laborCostTotalDemand?: number;
}

export interface PreorderForecastSummary {
	pendingOrdersCount: number;
	pendingPreorderLinesCount: number;
	productDemands: Array<{
		itemId: string;
		code: string;
		name: string;
		baseUnit: UnitOfMeasure;
		totalOrderedQty: number;
		currentProductStock: number;
		projectedBalance: number;
		deficitQuantity: number;
		isShortage: boolean;
		prepTimeMinutes?: number;
		passiveTimeMinutes?: number;
		isPrepTimeScalable?: boolean;
		yieldQuantity?: number;
		batchesNeededForDeficit?: number;
		laborMinutesForDeficit?: number;
		laborMinutesTotalDemand?: number;
		laborCostForDeficit?: number;
		laborCostTotalDemand?: number;
	}>;
	subAssemblyForecast: PreorderForecastLine[];
	rawMaterialForecast: PreorderForecastLine[];
	totalLaborMinutesForDeficit: number;
	totalLaborMinutesTotalDemand: number;
	totalActiveMinutesForDeficit: number;
	totalPassiveMinutesForDeficit: number;
	criticalPathMinutesForDeficit: number;
	totalLaborCostForDeficit?: number;
	totalLaborCostTotalDemand?: number;
}

export function generateNextSalesProductCode(existingCodes: string[]): string {
	const prefix = 'VTA';
	const regex = /^VTA-(\d+)$/i;
	let maxNumber = 0;

	for (const code of existingCodes) {
		const match = code.trim().match(regex);
		if (match) {
			const num = parseInt(match[1], 10);
			if (Number.isFinite(num) && num > maxNumber) {
				maxNumber = num;
			}
		}
	}

	return `${prefix}-${String(maxNumber + 1).padStart(3, '0')}`;
}

export function generateNextOrderNumber(existingNumbers: string[]): string {
	const prefix = 'ORD';
	const regex = /^ORD-(\d+)$/i;
	let maxNumber = 0;

	for (const numStr of existingNumbers) {
		const match = numStr.trim().match(regex);
		if (match) {
			const num = parseInt(match[1], 10);
			if (Number.isFinite(num) && num > maxNumber) {
				maxNumber = num;
			}
		}
	}

	return `${prefix}-${String(maxNumber + 1).padStart(4, '0')}`;
}

export function computeOrderStatusFromItems(
	items: Array<{ status: OrderItemStatus }>,
	currentStatus?: OrderStatus
): OrderStatus {
	if (currentStatus === 'unconfirmed') return 'unconfirmed';
	if (currentStatus === 'cancelled') return 'cancelled';
	const activeItems = items.filter((i) => i.status !== 'cancelled');
	if (activeItems.length === 0) return 'cancelled';
	const hasPendingDelivery = activeItems.some((i) => i.status === 'pending_delivery');
	return hasPendingDelivery ? 'pending' : 'completed';
}

export function computePaymentStatus(
	totalAmount: number,
	paidAmount: number,
	explicitStatus?: PaymentStatus
): { paymentStatus: PaymentStatus; normalizedPaidAmount: number } {
	if (totalAmount <= 0) {
		return { paymentStatus: 'paid', normalizedPaidAmount: 0 };
	}
	if (explicitStatus === 'paid') {
		return { paymentStatus: 'paid', normalizedPaidAmount: totalAmount };
	}
	if (explicitStatus === 'pending' && (!paidAmount || paidAmount <= 0)) {
		return { paymentStatus: 'pending', normalizedPaidAmount: 0 };
	}
	const clamped = Math.max(0, Math.min(totalAmount, paidAmount));
	if (clamped <= 0) {
		return { paymentStatus: 'pending', normalizedPaidAmount: 0 };
	}
	if (clamped >= totalAmount - 0.009) {
		return { paymentStatus: 'paid', normalizedPaidAmount: totalAmount };
	}
	return { paymentStatus: 'partially_paid', normalizedPaidAmount: clamped };
}
