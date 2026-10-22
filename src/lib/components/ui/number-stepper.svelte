<script lang="ts">
	import { Button } from '#lib/components/ui/button';
	import { Input } from '#lib/components/ui/input';
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import { cn } from '#lib/utils';

	interface Props {
		value?: number | '';
		name?: string;
		id?: string;
		min?: number;
		max?: number;
		step?: number;
		unit?: string;
		placeholder?: string;
		required?: boolean;
		disabled?: boolean;
		class?: string;
		inputClass?: string;
		onchange?: (value: number | '') => void;
	}

	let {
		value = $bindable(''),
		name,
		id,
		min = 0,
		max,
		step = 1,
		unit,
		placeholder = '0',
		required = false,
		disabled = false,
		class: className,
		inputClass = 'w-20',
		onchange
	}: Props = $props();

	function roundValue(val: number): number {
		return Math.round(val * 1000) / 1000;
	}

	function decrement() {
		if (disabled) return;
		if (value === '' || value === null || isNaN(Number(value))) {
			value = min;
			onchange?.(min);
			return;
		}
		const current = Number(value);
		const next = Math.max(min, roundValue(current - step));
		value = next;
		onchange?.(next);
	}

	function increment() {
		if (disabled) return;
		let next: number;
		if (value === '' || value === null || isNaN(Number(value))) {
			// Si está vacío, arranca en el paso (ej. 1 o 50), o en min si min >= step
			next = min >= step ? min : step;
		} else {
			next = roundValue(Number(value) + step);
		}
		if (max !== undefined && next > max) {
			next = max;
		}
		value = next;
		onchange?.(next);
	}
</script>

<div class={cn('flex items-center', className)}>
	<Button
		type="button"
		variant="outline"
		size="icon"
		onclick={decrement}
		disabled={disabled || (typeof value === 'number' && value <= min)}
		class="size-9 rounded-r-none border-r-0 hover:bg-accent active:scale-95 disabled:pointer-events-none disabled:opacity-40"
	>
		<Minus class="size-3.5" />
	</Button>
	<Input
		{id}
		{name}
		type="number"
		step={step ?? 'any'}
		{min}
		{max}
		{required}
		{disabled}
		{placeholder}
		bind:value
		class={cn(
			'h-9 rounded-none text-center font-mono font-bold shadow-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
			inputClass
		)}
	/>
	<Button
		type="button"
		variant="outline"
		size="icon"
		onclick={increment}
		disabled={disabled || (typeof value === 'number' && max !== undefined && value >= max)}
		class="size-9 rounded-l-none border-l-0 hover:bg-accent active:scale-95 disabled:pointer-events-none disabled:opacity-40"
	>
		<Plus class="size-3.5" />
	</Button>
</div>
