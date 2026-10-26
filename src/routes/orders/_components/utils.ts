import type { OrderItemFulfillmentType } from '#lib/features/orders/domain/order.entity';

export interface DraftOrderLine {
	key: string;
	salesProductId: string;
	productName: string;
	productCode: string;
	isCombo: boolean;
	quantity: number;
	unitPrice: number;
	fulfillmentType: OrderItemFulfillmentType;
	deliveryDate: string;
	notes: string;
}

export function formatCurrency(val: number): string {
	return `$ ${new Intl.NumberFormat('es-AR', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(val)}`;
}

export function formatDateTime(date: Date | string | null): string {
	if (!date) return 'Sin horario pactado';
	const d = typeof date === 'string' ? new Date(date) : date;
	if (Number.isNaN(d.getTime())) return 'Sin horario pactado';
	return new Intl.DateTimeFormat('es-AR', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	}).format(d);
}

export function roundToNext15Minutes(date: Date = new Date()): Date {
	const d = new Date(date);
	d.setSeconds(0, 0);
	const minutes = d.getMinutes();
	const remainder = minutes % 15;
	if (remainder !== 0) {
		d.setMinutes(minutes + (15 - remainder));
	}
	return d;
}

export function toDateString(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toTimeString(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function calculateOrderCost(
	order: { items: Array<{ salesProductId: string; quantity: number; unitCost?: number }> },
	costMap: Map<string, number>
): number {
	return order.items.reduce((acc, item) => {
		const unitCost =
			item.unitCost !== undefined && item.unitCost > 0
				? item.unitCost
				: (costMap.get(item.salesProductId) ?? 0);
		return acc + unitCost * (item.quantity || 0);
	}, 0);
}

export function calculateOrderProfit(
	totalAmount: number,
	cost: number
): { profit: number; marginPct: number } {
	const profit = totalAmount - cost;
	const marginPct = totalAmount > 0 ? Math.round((profit / totalAmount) * 100) : 0;
	return { profit, marginPct };
}


export function toDatetimeLocalString(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Intervalos estrictos cada 15 minutos: 00:00, 00:15, 00:30, ... 23:45
export const time15Slots = Array.from({ length: 96 }, (_, i) => {
	const h = String(Math.floor(i / 4)).padStart(2, '0');
	const m = String((i % 4) * 15).padStart(2, '0');
	return `${h}:${m}`;
});
