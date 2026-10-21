<script lang="ts">
	import {
		ITEM_TYPE_LABELS,
		ITEM_TYPE_CONFIG,
		type ItemType
	} from '../domain/item.entity';
	import Wheat from '@lucide/svelte/icons/wheat';
	import ChefHat from '@lucide/svelte/icons/chef-hat';

	let {
		type,
		short = false,
		class: className = ''
	}: {
		type: ItemType;
		short?: boolean;
		class?: string;
	} = $props();

	const config = $derived(ITEM_TYPE_CONFIG[type] ?? ITEM_TYPE_CONFIG.raw_material);
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap {config.badgeClass} {className}"
>
	{#if type === 'raw_material'}
		<Wheat class="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
	{:else}
		<ChefHat class="size-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
	{/if}
	<span>{short ? config.shortLabel : config.label}</span>
</span>
