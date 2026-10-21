<script lang="ts">
	import { enhance } from '$app/forms';
	import type { RecipeTreeNode } from '../domain/recipe.entity';
	import ItemTypeBadge from '#lib/features/items/ui/item-type-badge.svelte';
	import { Button } from '#lib/components/ui/button';
	import CornerDownRight from '@lucide/svelte/icons/corner-down-right';
	import Layers from '@lucide/svelte/icons/layers';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Clock from '@lucide/svelte/icons/clock';

	let {
		node,
		businessId,
		isDirectChild = false,
		onSelectItem
	}: {
		node: RecipeTreeNode;
		businessId: string;
		isDirectChild?: boolean;
		onSelectItem?: (itemId: string) => void;
	} = $props();

	let isExpanded = $state(false);

	function formatCurrency(val: number): string {
		return `$ ${new Intl.NumberFormat('es-AR', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 3
		}).format(val)}`;
	}
</script>

{#snippet renderNode(current: RecipeTreeNode, direct: boolean)}
	<tr
		class="border-b border-border/60 transition-colors hover:bg-muted/30 {current.depth > 0
			? 'bg-muted/15 text-muted-foreground'
			: ''}"
	>
		<td class="py-4 pr-4 pl-5 align-middle">
			<div class="flex items-center gap-2.5" style="padding-left: {current.depth * 1.75}rem;">
				{#if current.depth > 0}
					<CornerDownRight class="size-4 shrink-0 text-muted-foreground/70" />
				{/if}
				<span class="rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-medium text-foreground">
					{current.component.code}
				</span>
				<span class="font-medium {current.depth === 0 ? 'text-foreground' : 'text-foreground/85'}">
					{current.component.name}
				</span>
				{#if current.children.length > 0 || current.component.type !== 'raw_material'}
					<button
						type="button"
						onclick={() => (isExpanded = !isExpanded)}
						class="ml-1 inline-flex items-center gap-1 rounded-md border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-400 hover:bg-purple-500/20 cursor-pointer transition-colors"
						title={isExpanded ? 'Ocultar ingredientes de esta sub-receta' : 'Desplegar ingredientes de esta sub-receta'}
					>
						<Layers class="size-3 text-purple-600" />
						<span>{current.children.length > 0 ? `${current.children.length} ingr.` : 'Sub-receta'}</span>
						<ChevronDown class="size-3.5 transition-transform duration-200 {isExpanded ? 'rotate-180' : ''}" />
					</button>
				{/if}
			</div>
			{#if current.notes}
				<div
					class="mt-1.5 text-xs text-muted-foreground"
					style="padding-left: {current.depth * 1.75 + (current.depth > 0 ? 1.5 : 0)}rem;"
				>
					Nota: {current.notes}
				</div>
			{/if}
		</td>

		<td class="px-4 py-4 align-middle">
			<ItemTypeBadge type={current.component.type} short={true} />
		</td>

		<td class="px-4 py-4 text-right align-middle font-mono text-sm">
			<span class="font-semibold text-foreground">{current.quantity}</span>
			<span class="ml-1 text-xs text-muted-foreground">{current.unit}</span>
		</td>

		<td class="px-4 py-4 text-right align-middle font-mono text-xs text-muted-foreground">
			{formatCurrency(current.componentUnitCost)} / {current.component.baseUnit}
		</td>

		<td class="px-4 py-4 text-right align-middle font-mono text-sm font-medium">
			<span class={current.depth > 0 ? 'text-muted-foreground' : 'text-foreground'}>
				{formatCurrency(current.estimatedLineCost)}
			</span>
			{#if current.depth > 0}
				<span class="mt-0.5 block text-[11px] text-muted-foreground">(incluido en elaboración)</span>
			{/if}
		</td>

		<td class="px-4 py-4 text-center align-middle font-mono text-xs">
			{#if current.component.type === 'prepared' && current.component.prepTimeMinutes > 0}
				<span class="inline-flex items-center gap-1 rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-xs text-purple-700 dark:text-purple-400 font-semibold">
					<Clock class="size-3" />
					{current.component.prepTimeMinutes} min
				</span>
			{:else}
				<span class="text-muted-foreground/40">-</span>
			{/if}
		</td>

		<td class="py-4 pr-5 pl-3 text-right align-middle">
			<div class="flex items-center justify-end gap-1">
				{#if current.children.length > 0 || current.component.type !== 'raw_material'}
					<Button
						type="button"
						variant="ghost"
						size="icon"
						class="size-8 text-purple-600 hover:bg-purple-500/10"
						onclick={() => (isExpanded = !isExpanded)}
						title={isExpanded ? 'Ocultar ingredientes' : 'Desplegar sub-receta'}
					>
						<ChevronDown class="size-4 transition-transform duration-200 {isExpanded ? 'rotate-180' : ''}" />
					</Button>
				{/if}
				{#if direct}
					<form method="POST" action="?/removeRecipeLine" use:enhance>
						<input type="hidden" name="businessId" value={businessId} />
						<input type="hidden" name="lineId" value={current.lineId} />
						<Button
							type="submit"
							variant="ghost"
							size="icon"
							class="size-8 text-muted-foreground hover:text-destructive"
							title="Quitar ingrediente de la receta"
						>
							<Trash2 class="size-4" />
						</Button>
					</form>
				{:else}
					<span class="text-xs text-muted-foreground">Nivel {current.depth + 1}</span>
				{/if}
			</div>
		</td>
	</tr>

	{#if isExpanded}
		{#each current.children as childNode (childNode.lineId + '-' + childNode.depth)}
			{@render renderNode(childNode, false)}
		{/each}
	{/if}
{/snippet}

{@render renderNode(node, isDirectChild)}
