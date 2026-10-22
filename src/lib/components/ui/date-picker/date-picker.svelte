<script lang="ts">
	import { DateFormatter, type DateValue, parseDate, getLocalTimeZone, today } from '@internationalized/date';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import * as Popover from '#lib/components/ui/popover';
	import { Calendar } from '#lib/components/ui/calendar';
	import { Button } from '#lib/components/ui/button';
	import { cn } from '#lib/utils';

	let {
		value = $bindable(''),
		min,
		max,
		placeholder = 'Selecciona una fecha',
		class: className,
		onchange
	}: {
		value?: string; // YYYY-MM-DD
		min?: string;   // YYYY-MM-DD
		max?: string;   // YYYY-MM-DD
		placeholder?: string;
		class?: string;
		onchange?: (val: string) => void;
	} = $props();

	let open = $state(false);

	const df = new DateFormatter('es-AR', {
		dateStyle: 'medium'
	});

	let dateValue = $derived.by(() => {
		if (!value) return undefined;
		try {
			return parseDate(value);
		} catch {
			return undefined;
		}
	});

	let minValue = $derived.by(() => {
		if (!min) return undefined;
		try {
			return parseDate(min);
		} catch {
			return undefined;
		}
	});

	let maxValue = $derived.by(() => {
		if (!max) return undefined;
		try {
			return parseDate(max);
		} catch {
			return undefined;
		}
	});

	function handleSelect(val: DateValue | undefined) {
		if (val) {
			const str = val.toString();
			value = str;
			onchange?.(str);
			open = false;
		}
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="outline"
				class={cn(
					'h-10 w-full justify-start text-left font-normal cursor-pointer bg-background',
					!value && 'text-muted-foreground',
					className
				)}
			>
				<CalendarIcon class="mr-2 size-4 opacity-70" />
				{#if dateValue}
					<span class="font-medium text-foreground">
						{df.format(dateValue.toDate(getLocalTimeZone()))}
					</span>
				{:else}
					<span>{placeholder}</span>
				{/if}
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-auto p-0" align="start">
		<Calendar
			value={dateValue}
			onValueChange={handleSelect}
			{minValue}
			{maxValue}
			placeholder={dateValue ?? today(getLocalTimeZone())}
			preventDeselect
		/>
	</Popover.Content>
</Popover.Root>
