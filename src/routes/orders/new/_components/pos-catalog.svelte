<script lang="ts">
	import { Badge } from '#lib/components/ui/badge';
	import Search from '@lucide/svelte/icons/search';
	import Star from '@lucide/svelte/icons/star';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import X from '@lucide/svelte/icons/x';
	import {
		getProductAvailableStock,
		type SalesProductWithItems
	} from '#lib/features/orders/domain/order.entity';
	import { formatCurrency } from '../../_components/utils';

	let {
		salesProducts,
		onSelectProduct,
		onToggleShortcut
	}: {
		salesProducts: SalesProductWithItems[];
		onSelectProduct: (product: SalesProductWithItems) => void;
		onToggleShortcut: (product: SalesProductWithItems) => void;
	} = $props();

	let searchQuery = $state('');

	const shortcutProducts = $derived(salesProducts.filter((p) => p.isShortcut));
	const fallbackSuggestedProducts = $derived(
		shortcutProducts.length === 0 ? salesProducts.slice(0, 8) : []
	);

	const searchResults = $derived(
		searchQuery.trim()
			? salesProducts.filter(
					(p) =>
						p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
						p.code.toLowerCase().includes(searchQuery.toLowerCase())
				)
			: []
	);
</script>

<div class="space-y-6">
	<!-- Buscador -->
	<div class="relative">
		<Search class="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
		<input
			type="text"
			bind:value={searchQuery}
			placeholder="Buscar producto por nombre o código (ej: Torta, Mousse, COMBO)..."
			class="flex h-12 w-full rounded-2xl border border-input bg-card pl-10 pr-9 text-sm shadow-xs transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
		/>
		{#if searchQuery}
			<button
				type="button"
				onclick={() => (searchQuery = '')}
				class="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
			>
				<X class="size-4" />
			</button>
		{/if}
	</div>

	<!-- Resultados si hay búsqueda -->
	{#if searchQuery.trim()}
		<div class="rounded-2xl border border-border bg-card p-3 shadow-md space-y-1">
			<h4 class="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
				Resultados ({searchResults.length})
			</h4>
			{#if searchResults.length === 0}
				<p class="p-4 text-center text-xs text-muted-foreground">
					No hay coincidencias para "{searchQuery}"
				</p>
			{:else}
				<div class="max-h-60 overflow-y-auto divide-y divide-border/50">
					{#each searchResults as prod (prod.id)}
						{@const stock = getProductAvailableStock(prod)}
						<button
							type="button"
							onclick={() => onSelectProduct(prod)}
							class="flex w-full items-center justify-between rounded-xl p-3 text-left transition-all hover:bg-primary/10 group cursor-pointer active:scale-[0.99]"
						>
							<div class="min-w-0 pr-3">
								<div class="flex items-center gap-2">
									<span class="font-mono text-xs font-semibold text-muted-foreground">
										[{prod.code}]
									</span>
									<span class="font-bold text-sm text-foreground group-hover:text-primary">
										{prod.name}
									</span>
									{#if prod.isCombo}
										<Badge variant="secondary" class="text-[10px]">Combo</Badge>
									{/if}
								</div>
								<div class="mt-1 flex items-center gap-2">
									{#if stock > 0}
										<span
											class="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700"
										>
											Stock: {stock} u
										</span>
									{:else}
										<span
											class="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
										>
											Sin stock (por encargo)
										</span>
									{/if}
								</div>
							</div>
							<div class="flex items-center gap-2 shrink-0">
								<span class="font-mono text-sm font-bold text-foreground">
									{formatCurrency(prod.salePrice)}
								</span>
								<span class="rounded-lg bg-primary/20 px-2.5 py-1 text-xs font-bold text-primary">
									Seleccionar →
								</span>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Atajos Rápidos de Venta -->
	<div class="space-y-3">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-1.5">
				<Star class="size-4 text-amber-500 fill-amber-500" />
				<h3 class="text-sm font-bold uppercase tracking-wider text-muted-foreground">
					Atajos Rápidos de Venta
				</h3>
			</div>
			<span class="text-xs text-muted-foreground">
				Toca para configurar cantidad y modalidad
			</span>
		</div>

		{#if shortcutProducts.length > 0}
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
				{#each shortcutProducts as prod (prod.id)}
					{@const stock = getProductAvailableStock(prod)}
					<button
						type="button"
						onclick={() => onSelectProduct(prod)}
						class="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-3.5 shadow-2xs transition-all hover:border-primary hover:bg-muted/10 hover:shadow-sm text-left cursor-pointer active:scale-[0.98]"
					>
						<div class="flex flex-1 flex-col pr-6">
							<span class="font-mono text-[10px] text-muted-foreground">{prod.code}</span>
							<h4 class="mt-1 line-clamp-2 text-xs font-bold text-foreground group-hover:text-primary transition-colors">
								{prod.name}
							</h4>
							{#if prod.isCombo}
								<span class="mt-0.5 inline-block text-[9px] font-semibold text-primary">
									Combo
								</span>
							{/if}
							<div class="mt-2 flex items-center justify-between gap-1">
								<span class="font-mono text-sm font-bold text-emerald-600">
									{formatCurrency(prod.salePrice)}
								</span>
								{#if stock > 0}
									<span
										class="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-700"
										title="Stock disponible en mostrador"
									>
										{stock} u
									</span>
								{:else}
									<span
										class="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] font-semibold text-muted-foreground"
										title="Sin stock para venta inmediata"
									>
										0 u
									</span>
								{/if}
							</div>
						</div>
						<span
							role="button"
							tabindex="0"
							title="Quitar de atajos"
							onclick={(e) => {
								e.stopPropagation();
								onToggleShortcut(prod);
							}}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.stopPropagation();
									onToggleShortcut(prod);
								}
							}}
							class="absolute right-2.5 top-2.5 rounded p-1 text-amber-500 hover:bg-muted cursor-pointer z-10 transition-colors"
						>
							<Star class="size-3.5 fill-amber-500" />
						</span>
					</button>
				{/each}
			</div>
		{:else}
			<!-- Fallback sugeridos -->
			<div class="rounded-2xl border border-dashed border-border bg-card p-5 space-y-3">
				<p class="text-xs text-muted-foreground">
					Aún no has fijado atajos favoritos. Toca la estrella ⭐ para guardarlos aquí o elige uno de estos productos sugeridos:
				</p>
				<div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
					{#each fallbackSuggestedProducts as prod (prod.id)}
						{@const stock = getProductAvailableStock(prod)}
						<button
							type="button"
							onclick={() => onSelectProduct(prod)}
							class="group relative flex flex-col justify-between rounded-xl border border-border bg-background p-3 text-left transition-all hover:border-primary hover:bg-muted/10 cursor-pointer active:scale-[0.98]"
						>
							<div class="flex flex-col pr-5">
								<span class="font-mono text-[10px] text-muted-foreground">{prod.code}</span>
								<span class="line-clamp-1 text-xs font-bold text-foreground group-hover:text-primary transition-colors">{prod.name}</span>
								<div class="mt-1 flex items-center justify-between gap-1">
									<span class="font-mono text-xs font-bold text-emerald-600">{formatCurrency(prod.salePrice)}</span>
									{#if stock > 0}
										<span class="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-700">
											{stock} u
										</span>
									{:else}
										<span class="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] font-semibold text-muted-foreground">
											0 u
										</span>
									{/if}
								</div>
							</div>
							<span
								role="button"
								tabindex="0"
								title="Fijar como atajo"
								onclick={(e) => {
									e.stopPropagation();
									onToggleShortcut(prod);
								}}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.stopPropagation();
										onToggleShortcut(prod);
									}
								}}
								class="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:text-amber-500 cursor-pointer z-10 transition-colors"
							>
								<Star class="size-3.5" />
							</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>
