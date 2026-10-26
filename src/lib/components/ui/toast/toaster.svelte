<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { fly, fade } from 'svelte/transition';
	import { toast } from './toast.svelte';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Info from '@lucide/svelte/icons/info';
	import X from '@lucide/svelte/icons/x';

	// Referencia NO reactiva para comparar la identidad exacta de page.form sin crear proxies ni ciclos
	let lastProcessedFormRef: unknown = null;

	$effect(() => {
		const currentForm = page.form as
			| { success?: boolean; message?: string; error?: string }
			| null
			| undefined;

		if (!currentForm || currentForm === lastProcessedFormRef) return;
		lastProcessedFormRef = currentForm;

		untrack(() => {
			if (currentForm.error) {
				toast.error('No se pudo completar la acción', currentForm.error);
			} else if (currentForm.message) {
				toast.success('Acción completada', currentForm.message);
			}
		});
	});
</script>

<div
	class="pointer-events-none fixed top-3 inset-x-0 mx-auto z-[100] flex w-full max-w-[calc(100vw-1.5rem)] sm:max-w-sm flex-col gap-1.5 sm:gap-2.5 px-0 sm:top-5 sm:right-5 sm:left-auto sm:inset-x-auto"
	aria-live="polite"
>
	{#each toast.items as item (item.id)}
		<div
			in:fly={{ y: -16, duration: 200 }}
			out:fade={{ duration: 150 }}
			role={item.variant === 'error' ? 'alert' : 'status'}
			class="pointer-events-auto flex items-center sm:items-start gap-2.5 sm:gap-3 rounded-xl border bg-card/95 backdrop-blur-md p-2.5 sm:p-3.5 text-card-foreground shadow-lg ring-1 ring-black/5 transition-all {item.variant ===
			'success'
				? 'border-l-4 border-border border-l-emerald-500'
				: item.variant === 'error'
					? 'border-l-4 border-border border-l-red-500'
					: item.variant === 'warning'
						? 'border-l-4 border-border border-l-amber-500'
						: 'border-l-4 border-border border-l-primary'}"
		>
			<div
				class="flex size-6 sm:size-7 shrink-0 items-center justify-center rounded-lg {item.variant ===
				'success'
					? 'bg-emerald-500/10 text-emerald-600'
					: item.variant === 'error'
						? 'bg-red-500/10 text-red-600'
						: item.variant === 'warning'
							? 'bg-amber-500/10 text-amber-600'
							: 'bg-primary/10 text-primary'}"
			>
				{#if item.variant === 'success'}
					<CircleCheck class="size-3.5 sm:size-4" />
				{:else if item.variant === 'error'}
					<CircleAlert class="size-3.5 sm:size-4" />
				{:else if item.variant === 'warning'}
					<TriangleAlert class="size-3.5 sm:size-4" />
				{:else}
					<Info class="size-3.5 sm:size-4" />
				{/if}
			</div>

			<div class="min-w-0 flex-1 space-y-0.5">
				<p class="text-xs sm:text-sm font-semibold leading-tight text-foreground truncate sm:whitespace-normal">
					{item.title}
				</p>
				{#if item.description}
					<p class="text-[11px] sm:text-xs leading-tight text-muted-foreground line-clamp-2 mt-0.5">
						{item.description}
					</p>
				{/if}
			</div>

			<button
				type="button"
				onclick={() => toast.dismiss(item.id)}
				class="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				aria-label="Cerrar notificación"
			>
				<X class="size-3.5 sm:size-4" />
			</button>
		</div>
	{/each}
</div>
