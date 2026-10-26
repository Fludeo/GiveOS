import type { DraftOrderLine, PaymentStatus } from '../domain/order.entity';

export interface DraftOrderStorageData {
	lines: DraftOrderLine[];
	customerName: string;
	paymentStatus: PaymentStatus;
	paidAmount: number;
	deliveryDate: string;
	notes: string;
	transactionId: string;
	createAsUnconfirmed: boolean;
}

const STORAGE_PREFIX = 'giveos_draft_order_';

class DraftOrderStore {
	businessId = $state<string>('');
	lines = $state<DraftOrderLine[]>([]);
	customerName = $state<string>('Cliente Mostrador');
	paymentStatus = $state<PaymentStatus>('paid');
	paidAmount = $state<number>(0);
	deliveryDate = $state<string>('');
	notes = $state<string>('');
	transactionId = $state<string>('');
	createAsUnconfirmed = $state<boolean>(false);
	isLoaded = $state<boolean>(false);

	/** Cantidad de productos diferentes cargados en la orden en borrador */
	count = $derived(this.lines.length);

	/** Cantidad total de unidades físicas de todos los productos */
	totalUnits = $derived(
		this.lines.reduce((acc, l) => acc + (l.quantity > 0 ? l.quantity : 0), 0)
	);

	/** Monto total en dinero de la orden */
	totalAmount = $derived(
		this.lines.reduce(
			(acc, l) => acc + (l.quantity > 0 ? l.quantity : 0) * (l.unitPrice >= 0 ? l.unitPrice : 0),
			0
		)
	);

	private listenerAttached = false;

	init(bId: string) {
		if (typeof window === 'undefined' || !bId) return;

		// Si cambiamos de negocio o aún no cargamos
		if (this.businessId !== bId || !this.isLoaded) {
			this.businessId = bId;
			this.loadFromStorage();
			this.isLoaded = true;
		}

		if (!this.listenerAttached) {
			this.listenerAttached = true;
			window.addEventListener('storage', (e) => {
				if (e.key === `${STORAGE_PREFIX}${this.businessId}`) {
					this.loadFromStorage();
				}
			});
		}
	}

	loadFromStorage() {
		if (typeof window === 'undefined' || !this.businessId) return;
		try {
			const raw = localStorage.getItem(`${STORAGE_PREFIX}${this.businessId}`);
			if (raw) {
				const data = JSON.parse(raw) as Partial<DraftOrderStorageData>;
				this.lines = Array.isArray(data.lines) ? data.lines : [];
				this.customerName = data.customerName ?? 'Cliente Mostrador';
				this.paymentStatus = data.paymentStatus ?? 'paid';
				this.paidAmount = typeof data.paidAmount === 'number' ? data.paidAmount : 0;
				this.deliveryDate = data.deliveryDate ?? '';
				this.notes = data.notes ?? '';
				this.transactionId = data.transactionId ?? '';
				this.createAsUnconfirmed = Boolean(data.createAsUnconfirmed);
			} else {
				this.resetInMemory();
			}
		} catch (e) {
			console.error('Error al recuperar borrador de orden de localStorage:', e);
		}
	}

	save() {
		if (typeof window === 'undefined' || !this.businessId) return;
		try {
			if (this.lines.length === 0) {
				localStorage.removeItem(`${STORAGE_PREFIX}${this.businessId}`);
			} else {
				const payload: DraftOrderStorageData = {
					lines: this.lines,
					customerName: this.customerName,
					paymentStatus: this.paymentStatus,
					paidAmount: this.paidAmount,
					deliveryDate: this.deliveryDate,
					notes: this.notes,
					transactionId: this.transactionId,
					createAsUnconfirmed: this.createAsUnconfirmed
				};
				localStorage.setItem(`${STORAGE_PREFIX}${this.businessId}`, JSON.stringify(payload));
			}
		} catch (e) {
			console.error('Error al guardar borrador de orden en localStorage:', e);
		}
	}

	clear() {
		this.resetInMemory();
		if (typeof window !== 'undefined' && this.businessId) {
			localStorage.removeItem(`${STORAGE_PREFIX}${this.businessId}`);
		}
	}

	updateFromTerminal(data: {
		lines: DraftOrderLine[];
		customerName: string;
		paymentStatus: PaymentStatus;
		paidAmount: number;
		deliveryDate: string;
		notes: string;
		transactionId: string;
		createAsUnconfirmed: boolean;
	}) {
		this.lines = data.lines;
		this.customerName = data.customerName;
		this.paymentStatus = data.paymentStatus;
		this.paidAmount = data.paidAmount;
		this.deliveryDate = data.deliveryDate;
		this.notes = data.notes;
		this.transactionId = data.transactionId;
		this.createAsUnconfirmed = data.createAsUnconfirmed;
		this.save();
	}

	addLine(line: DraftOrderLine) {
		this.lines = [...this.lines, line];
		this.save();
	}

	changeLineQuantity(index: number, delta: number) {
		if (!this.lines[index]) return;
		const next = Math.max(1, Number((this.lines[index].quantity + delta).toFixed(2)));
		this.lines[index].quantity = next;
		this.save();
	}

	removeLine(index: number) {
		this.lines = this.lines.filter((_, idx) => idx !== index);
		this.save();
	}

	private resetInMemory() {
		this.lines = [];
		this.customerName = 'Cliente Mostrador';
		this.paymentStatus = 'paid';
		this.paidAmount = 0;
		this.deliveryDate = '';
		this.notes = '';
		this.transactionId = '';
		this.createAsUnconfirmed = false;
	}
}

export const draftOrderStore = new DraftOrderStore();
