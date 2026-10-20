<script lang="ts">
	import { ITEM_TYPE_LABELS, type ItemType } from '../domain/item.entity';
	import { Badge } from '#lib/components/ui/badge';
	import Wheat from '@lucide/svelte/icons/wheat';
	import ChefHat from '@lucide/svelte/icons/chef-hat';
	import CakeSlice from '@lucide/svelte/icons/cake-slice';

	let {
		type,
		short = false,
		class: className = ''
	}: {
		type: ItemType;
		short?: boolean;
		class?: string;
	} = $props();

	const SHORT_LABELS: Record<ItemType, string> = {
		raw_material: 'Materia Prima',
		sub_assembly: 'Sub-ensamble',
		finished_product: 'Producto Final'
	};
</script>

<Badge
	variant={type === 'finished_product'
		? 'default'
		: type === 'sub_assembly'
			? 'secondary'
			: 'outline'}
	class="inline-flex items-center gap-1.5 whitespace-nowrap text-xs {className}"
>
	{#if type === 'raw_material'}
		<Wheat class="size-3.5 shrink-0 text-amber-600" />
	{:else if type === 'sub_assembly'}
		<ChefHat class="size-3.5 shrink-0 text-primary" />
	{:else}
		<CakeSlice class="size-3.5 shrink-0" />
	{/if}
	<span>{short ? SHORT_LABELS[type] : ITEM_TYPE_LABELS[type]}</span>
</Badge>
