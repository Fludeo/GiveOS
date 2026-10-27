<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		goto('/messages', { replaceState: true });
	});
</script>

<div class="flex h-screen items-center justify-center p-4">
	<p class="text-sm text-muted-foreground">Redirigiendo a Mensajes...</p>
</div>
