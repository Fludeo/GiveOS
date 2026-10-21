<script lang="ts">
	import { onMount } from 'svelte';
	import Sun from '@lucide/svelte/icons/sun';
	import Moon from '@lucide/svelte/icons/moon';
	import { Button } from '#lib/components/ui/button';

	let { class: className = '' }: { class?: string } = $props();

	let isDark = $state(false);

	onMount(() => {
		isDark = document.documentElement.classList.contains('dark');
	});

	function toggleTheme() {
		isDark = !isDark;
		if (isDark) {
			document.documentElement.classList.add('dark');
			localStorage.setItem('theme', 'dark');
		} else {
			document.documentElement.classList.remove('dark');
			localStorage.setItem('theme', 'light');
		}
	}
</script>

<Button
	type="button"
	variant="ghost"
	size="icon"
	onclick={toggleTheme}
	title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
	aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
	class="size-9 rounded-xl text-muted-foreground hover:text-foreground cursor-pointer {className}"
>
	{#if isDark}
		<Sun class="size-4.5 text-amber-400 transition-all rotate-0 scale-100" />
	{:else}
		<Moon class="size-4.5 text-zinc-600 dark:text-zinc-300 transition-all rotate-0 scale-100" />
	{/if}
</Button>
