import { untrack } from 'svelte';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
	id: string;
	variant: ToastVariant;
	title: string;
	description?: string;
	durationMs: number;
}

class ToastStore {
	items = $state<ToastItem[]>([]);

	add(variant: ToastVariant, title: string, description?: string, durationMs = 6000) {
		const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
		const item: ToastItem = { id, variant, title, description, durationMs };

		untrack(() => {
			// Evitar duplicados idénticos consecutivos y limitar a máximo 4 en pantalla
			const filtered = this.items.filter(
				(t) => !(t.variant === variant && t.title === title && t.description === description)
			);
			this.items = [...filtered.slice(-3), item];
		});

		if (durationMs > 0 && typeof window !== 'undefined') {
			setTimeout(() => {
				this.dismiss(id);
			}, durationMs);
		}
		return id;
	}

	success(title: string, description?: string) {
		return this.add('success', title, description, 6000);
	}

	error(title: string, description?: string) {
		return this.add('error', title, description, 9000);
	}

	warning(title: string, description?: string) {
		return this.add('warning', title, description, 7500);
	}

	info(title: string, description?: string) {
		return this.add('info', title, description, 6000);
	}

	dismiss(id: string) {
		untrack(() => {
			this.items = this.items.filter((t) => t.id !== id);
		});
	}
}

export const toast = new ToastStore();
