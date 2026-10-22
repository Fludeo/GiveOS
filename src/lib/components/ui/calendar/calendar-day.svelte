<script lang="ts">
	import { Calendar as CalendarPrimitive } from 'bits-ui';
	import { buttonVariants } from '#lib/components/ui/button';
	import { cn } from '#lib/utils';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: CalendarPrimitive.DayProps = $props();
</script>

<CalendarPrimitive.Day
	bind:ref
	class={cn(
		buttonVariants({ variant: 'ghost' }),
		'size-9 p-0 font-normal aria-selected:opacity-100 cursor-pointer',
		// Selected
		'data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[selected]:opacity-100 data-[selected]:hover:bg-primary data-[selected]:hover:text-primary-foreground data-[selected]:focus:bg-primary data-[selected]:focus:text-primary-foreground',
		// Today
		'data-[today]:bg-muted data-[today]:text-foreground data-[today]:font-semibold',
		// Outside
		'data-[outside-month]:text-muted-foreground data-[outside-month]:opacity-50 data-[outside-month]:pointer-events-none',
		// Disabled
		'data-[disabled]:text-muted-foreground data-[disabled]:opacity-40 data-[disabled]:line-through data-[disabled]:pointer-events-none',
		// Unavailable
		'data-[unavailable]:text-destructive-foreground data-[unavailable]:line-through',
		className
	)}
	{...restProps}
/>
