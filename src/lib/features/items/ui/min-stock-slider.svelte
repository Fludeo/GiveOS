<script lang="ts">
	import type { UnitOfMeasure } from '../domain/item.entity';

	let {
		value = $bindable(0),
		unit = 'unit' as UnitOfMeasure,
		name = 'minStock',
		formId = undefined as string | undefined,
		compact = false
	}: {
		value: number;
		unit?: UnitOfMeasure;
		name?: string;
		formId?: string;
		compact?: boolean;
	} = $props();

	const DEFAULT_STOPS_BY_UNIT: Record<UnitOfMeasure, number[]> = {
		g: [0, 100, 250, 500, 1000, 2000, 5000],
		ml: [0, 100, 250, 500, 1000, 2000, 5000],
		kg: [0, 1, 2, 5, 10, 25, 50],
		l: [0, 1, 2, 5, 10, 20, 50],
		unit: [0, 2, 5, 10, 18, 30, 60]
	};

	const stops = $derived(DEFAULT_STOPS_BY_UNIT[unit] ?? DEFAULT_STOPS_BY_UNIT.unit);
	const maxVal = $derived(Math.max(stops[stops.length - 1], value));
	const stepSize = $derived(unit === 'g' || unit === 'ml' ? 50 : 1);
</script>

<div class="space-y-2 {compact ? 'min-w-[210px]' : 'w-full'}">
	<input type="hidden" {name} {value} form={formId} />

	<div class="flex items-center justify-between gap-2">
		<span class="text-xs font-medium text-muted-foreground">
			Punto de alerta:
		</span>
		<span class="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
			{value} {unit}
		</span>
	</div>

	<!-- Slider continuo con marcas de puntos -->
	<div class="space-y-1.5">
		<input
			type="range"
			min={0}
			max={maxVal}
			step={stepSize}
			bind:value
			aria-label="Seleccionar punto de alerta de stock mínimo"
			class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
		/>

		<!-- Puntos seleccionables rápidos -->
		<div class="flex flex-wrap items-center justify-between gap-1">
			{#each stops as stop (stop)}
				{@const active = value === stop}
				<button
					type="button"
					onclick={() => (value = stop)}
					class="rounded px-1.5 py-0.5 font-mono text-[10px] font-medium transition-colors {active
						? 'bg-primary text-primary-foreground shadow-2xs'
						: 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'}"
					title="Fijar alerta en {stop} {unit}"
				>
					{stop}
				</button>
			{/each}
		</div>
	</div>
</div>
