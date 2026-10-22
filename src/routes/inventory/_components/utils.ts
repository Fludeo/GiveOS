import { getDirectUnitCost, type Item } from '#lib/features/items/domain/item.entity';

export function formatCurrency(val: number): string {
	return `$ ${new Intl.NumberFormat('es-AR', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(val)}`;
}

export function formatDate(iso: string): string {
	try {
		const d = new Date(iso);
		return new Intl.DateTimeFormat('es-AR', {
			dateStyle: 'short',
			timeStyle: 'short'
		}).format(d);
	} catch {
		return iso;
	}
}

export function getDaysAgo(iso: string): string {
	try {
		const ms = Date.now() - new Date(iso).getTime();
		const days = Math.floor(ms / (1000 * 60 * 60 * 24));
		if (days <= 0) return 'hoy';
		if (days === 1) return 'hace 1 día';
		return `hace ${days} días`;
	} catch {
		return '';
	}
}

export function getUnitPriceLabel(unit: string): string {
	switch (unit) {
		case 'kg':
			return 'Costo por kilogramo ($ / kg)';
		case 'g':
			return 'Costo por gramo ($ / g)';
		case 'l':
			return 'Costo por litro ($ / l)';
		case 'ml':
			return 'Costo por mililitro ($ / ml)';
		case 'unit':
			return 'Costo por unidad ($ / u)';
		default:
			return `Costo por ${unit} ($)`;
	}
}

export function calculateComponentsRecipeCost(
	comps: { itemId: string; quantity: number }[],
	items: Item[],
	recipeSummaries: Record<string, { estimatedUnitCost: number }>
): number {
	let total = 0;
	for (const comp of comps) {
		const found = items.find((i) => i.id === comp.itemId);
		if (!found) continue;
		const unitCost =
			recipeSummaries[found.id]?.estimatedUnitCost ?? getDirectUnitCost(found);
		const qty = Number(comp.quantity) > 0 ? Number(comp.quantity) : 0;
		total += unitCost * qty;
	}
	return total;
}
