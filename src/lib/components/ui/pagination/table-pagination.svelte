<script lang="ts">
	import { Button } from '#lib/components/ui/button';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	let {
		currentPage = $bindable(1),
		pageSize = $bindable(10),
		totalItems,
		pageSizeOptions = [5, 10, 25, 50],
		itemLabel = 'ítems',
		compact = false
	}: {
		currentPage: number;
		pageSize?: number;
		totalItems: number;
		pageSizeOptions?: number[];
		itemLabel?: string;
		compact?: boolean;
	} = $props();

	const totalPages = $derived(Math.max(1, Math.ceil(totalItems / pageSize)));
	const startItem = $derived(totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1);
	const endItem = $derived(Math.min(totalItems, currentPage * pageSize));

	$effect(() => {
		if (currentPage > totalPages) {
			currentPage = totalPages;
		} else if (currentPage < 1) {
			currentPage = 1;
		}
	});
</script>

{#if totalItems > 0}
	<div
		class="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground"
	>
		<div class="flex flex-wrap items-center gap-3">
			<span>
				Mostrando <strong class="font-medium text-foreground">{startItem}–{endItem}</strong> de
				<strong class="font-medium text-foreground">{totalItems}</strong>
				{itemLabel}
			</span>

			{#if !compact && pageSizeOptions.length > 1}
				<div class="flex items-center gap-1.5">
					<span>Filas:</span>
					<select
						aria-label="Filas por página"
						bind:value={pageSize}
						onchange={() => (currentPage = 1)}
						class="h-7 rounded-md border border-input bg-background px-2 py-0.5 text-xs font-medium text-foreground shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					>
						{#each pageSizeOptions as opt (opt)}
							<option value={opt}>{opt}</option>
						{/each}
					</select>
				</div>
			{/if}
		</div>

		<div class="flex items-center gap-1.5">
			<Button
				type="button"
				variant="outline"
				size="sm"
				class="h-7 px-2 text-xs"
				disabled={currentPage <= 1}
				onclick={() => (currentPage = Math.max(1, currentPage - 1))}
				title="Página anterior"
			>
				<ChevronLeft class="size-3.5" />
				{#if !compact}
					<span>Anterior</span>
				{/if}
			</Button>

			<span class="px-2 font-mono text-xs font-medium text-foreground">
				{currentPage} / {totalPages}
			</span>

			<Button
				type="button"
				variant="outline"
				size="sm"
				class="h-7 px-2 text-xs"
				disabled={currentPage >= totalPages}
				onclick={() => (currentPage = Math.min(totalPages, currentPage + 1))}
				title="Página siguiente"
			>
				{#if !compact}
					<span>Siguiente</span>
				{/if}
				<ChevronRight class="size-3.5" />
			</Button>
		</div>
	</div>
{/if}
