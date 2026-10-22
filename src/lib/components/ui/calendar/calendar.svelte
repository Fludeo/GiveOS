<script lang="ts">
	import { Calendar as CalendarPrimitive } from 'bits-ui';
	import type { DateValue } from '@internationalized/date';
	import * as Calendar from './index';
	import { cn } from '#lib/utils';

	let {
		ref = $bindable(null),
		value = $bindable(),
		placeholder = $bindable(),
		class: className,
		weekdayFormat = 'short',
		minValue,
		maxValue,
		disabled = false,
		preventDeselect = false,
		...restProps
	}: {
		ref?: HTMLElement | null;
		value?: DateValue;
		placeholder?: DateValue;
		class?: string;
		weekdayFormat?: 'short' | 'long' | 'narrow';
		minValue?: DateValue;
		maxValue?: DateValue;
		disabled?: boolean;
		preventDeselect?: boolean;
		[key: string]: any;
	} = $props();
</script>

<CalendarPrimitive.Root
	type="single"
	bind:value
	bind:ref
	bind:placeholder
	{weekdayFormat}
	{minValue}
	{maxValue}
	{disabled}
	{preventDeselect}
	class={cn('p-3', className)}
	{...restProps}
>
	{#snippet children({ months, weekdays })}
		<Calendar.Header>
			<Calendar.PrevButton />
			<Calendar.Heading />
			<Calendar.NextButton />
		</Calendar.Header>
		<div class="flex flex-col space-y-4 pt-4 sm:flex-row sm:space-x-4 sm:space-y-0">
			{#each months as month}
				<Calendar.Grid>
					<Calendar.GridHead>
						<Calendar.GridRow class="flex">
							{#each weekdays as weekday}
								<Calendar.HeadCell>
									{weekday.slice(0, 2)}
								</Calendar.HeadCell>
							{/each}
						</Calendar.GridRow>
					</Calendar.GridHead>
					<Calendar.GridBody>
						{#each month.weeks as weekDates}
							<Calendar.GridRow class="mt-2 flex w-full">
								{#each weekDates as date}
									<Calendar.Cell {date} month={month.value}>
										<Calendar.Day />
									</Calendar.Cell>
								{/each}
							</Calendar.GridRow>
						{/each}
					</Calendar.GridBody>
				</Calendar.Grid>
			{/each}
		</div>
	{/snippet}
</CalendarPrimitive.Root>
