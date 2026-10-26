import { toast } from '#lib/components/ui/toast/toast.svelte';

export interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
	interface Window {
		__deferredPwaPrompt?: BeforeInstallPromptEvent | null;
	}
}

class PwaInstallStore {
	deferredPrompt = $state<BeforeInstallPromptEvent | null>(null);
	isStandalone = $state(false);
	showManualInstructionsModal = $state(false);
	isIos = $state(false);

	init() {
		if (typeof window === 'undefined') return;

		this.isStandalone =
			window.matchMedia('(display-mode: standalone)').matches ||
			(window.navigator as Navigator & { standalone?: boolean }).standalone === true;

		const ua = window.navigator.userAgent.toLowerCase();
		this.isIos = /iphone|ipad|ipod/.test(ua);

		// Recuperar el evento si se disparó en app.html antes de hidratar Svelte
		if (window.__deferredPwaPrompt) {
			this.deferredPrompt = window.__deferredPwaPrompt;
		}

		const handleBeforeInstallPrompt = (e: Event) => {
			e.preventDefault();
			const promptEvent = e as BeforeInstallPromptEvent;
			window.__deferredPwaPrompt = promptEvent;
			this.deferredPrompt = promptEvent;
		};

		const handleAppInstalled = () => {
			window.__deferredPwaPrompt = null;
			this.deferredPrompt = null;
			this.isStandalone = true;
			this.showManualInstructionsModal = false;
			toast.success(
				'¡GiveOS instalada!',
				'Ya puedes abrir la aplicación directamente desde tu pantalla de inicio.'
			);
		};

		window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
		window.addEventListener('appinstalled', handleAppInstalled);

		return () => {
			window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
			window.removeEventListener('appinstalled', handleAppInstalled);
		};
	}

	async triggerInstall() {
		const promptEvent = this.deferredPrompt ?? window.__deferredPwaPrompt ?? null;
		if (promptEvent) {
			await promptEvent.prompt();
			const { outcome } = await promptEvent.userChoice;
			if (outcome === 'accepted') {
				window.__deferredPwaPrompt = null;
				this.deferredPrompt = null;
			}
			return;
		}

		// Si el navegador no soporta beforeinstallprompt (ej. Safari iOS o ya se descartó), abrir guía visual
		this.showManualInstructionsModal = true;
	}
}

export const pwaStore = new PwaInstallStore();
