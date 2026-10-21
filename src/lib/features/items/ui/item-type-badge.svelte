<script lang="ts">
	import {
		ITEM_TYPE_LABELS,
		ITEM_TYPE_CONFIG,
		normalizeItemType,
		type ItemType
	} from '../domain/item.entity';
	import Wheat from '@lucide/svelte/icons/wheat';
	import CakeSlice from '@lucide/svelte/icons/cake-slice';

	let {
		type,
		short = false,
		class: className = ''
	}: {
		type: string;
		short?: boolean;
		class?: string;
	} = $props();

	const normalizedType = $derived(normalizeItemType(type));
	const config = $derived(ITEM_TYPE_CONFIG[normalizedType]);
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap {config.badgeClass} {className}"
>
	{#if normalizedType === 'raw_material'}
		<Wheat class="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
	{:else}
		<CakeSlice class="size-3.5 shrink-0 text-purple-600 dark:text-purple-400" />
	{/if}
	<span>{short ? config.shortLabel : config.label}</span>
</span>
