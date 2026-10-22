<script lang="ts">
	import { Popover as PopoverPrimitive } from 'bits-ui';
	import { cn } from '#lib/utils';
	import { popoverVariants } from './popover.variants';

	let {
		ref = $bindable(null),
		class: className,
		align = 'start',
		sideOffset = 4,
		children,
		...restProps
	}: PopoverPrimitive.ContentProps = $props();
</script>

<PopoverPrimitive.Portal>
	<PopoverPrimitive.Content
		bind:ref
		{align}
		{sideOffset}
		class={cn(popoverVariants(), className)}
		{...restProps}
	>
		{@render children?.()}
	</PopoverPrimitive.Content>
</PopoverPrimitive.Portal>
