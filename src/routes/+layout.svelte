<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import Toaster from '#lib/components/ui/toast/toaster.svelte';
	import { pwaStore } from '#lib/pwa.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	$effect(() => {
		return pwaStore.init();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<Toaster />
{@render children()}
