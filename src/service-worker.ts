/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { immutable, assets } from '$app/manifest';
import { version } from '$app/env';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = `giveos-cache-${version}`;
const ASSETS = [...immutable, ...assets];

sw.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE_NAME);
		await cache.addAll(ASSETS);
	}

	event.waitUntil(addFilesToCache().then(() => sw.skipWaiting()));
});

sw.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE_NAME) {
				await caches.delete(key);
			}
		}
	}

	event.waitUntil(deleteOldCaches().then(() => sw.clients.claim()));
});

sw.addEventListener('fetch', (event) => {
	// No interceptar métodos POST/PUT/DELETE (Form Actions de SvelteKit, login, mutaciones)
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	// Solo manejar peticiones del mismo origen con protocolo http/https
	if (url.origin !== sw.location.origin || !url.protocol.startsWith('http')) return;

	// Evitar cachear rutas de autenticación o health-check
	if (
		url.pathname.startsWith('/login') ||
		url.pathname.startsWith('/register') ||
		url.pathname.startsWith('/health-check')
	) {
		return;
	}

	async function respond(): Promise<Response> {
		const cache = await caches.open(CACHE_NAME);

		// 1. Assets compilados y archivos estáticos: Estrategia Cache-First
		if (ASSETS.includes(url.pathname)) {
			const cachedAsset = await cache.match(url.pathname);
			if (cachedAsset) {
				return cachedAsset;
			}
		}

		// 2. Páginas y datos SSR: Estrategia Network-First (datos frescos siempre que haya red)
		try {
			const response = await fetch(event.request);

			if (response instanceof Response && response.status === 200 && response.type === 'basic') {
				cache.put(event.request, response.clone());
			}

			return response;
		} catch (err) {
			const cachedResponse = await cache.match(event.request);
			if (cachedResponse) {
				return cachedResponse;
			}
			throw err;
		}
	}

	event.respondWith(respond());
});
