<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Item } from '#lib/features/items/domain/item.entity';
	import type { SalesProductWithItems } from '#lib/features/orders/domain/order.entity';
	import ItemTypeBadge from '#lib/features/items/ui/item-type-badge.svelte';
	import TablePagination from '#lib/components/ui/pagination/table-pagination.svelte';
	import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '#lib/components/ui/card';
	import { Button } from '#lib/components/ui/button';
	import { Input } from '#lib/components/ui/input';
	import { Badge } from '#lib/components/ui/badge';
	import Tag from '@lucide/svelte/icons/tag';
	import Search from '@lucide/svelte/icons/search';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import List from '@lucide/svelte/icons/list';
	import Plus from '@lucide/svelte/icons/plus';
	import Star from '@lucide/svelte/icons/star';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Link2 from '@lucide/svelte/icons/link-2';
	import { formatCurrency, formatQuantity } from '../utils';

	interface Props {
		salesProducts: SalesProductWithItems[];
		items: Item[];
		businessId: string;
		onOpenNewProduct: () => void;
		onOpenEditProduct: (p: SalesProductWithItems) => void;
		onOpenDeleteProduct: (p: SalesProductWithItems) => void;
		onSelectCatalogItem: (itemId: string) => void;
	}

	let {
		salesProducts,
		items,
		businessId,
		onOpenNewProduct,
		onOpenEditProduct,
		onOpenDeleteProduct,
		onSelectCatalogItem
	}: Props = $props();

	let salesProductSearch = $state('');
	let salesProductPage = $state(1);
	let salesProductPageSize = $state(8);
	let salesViewMode = $state<'cards' | 'table'>('cards');

	function toggleSalesView(mode: 'cards' | 'table') {
		salesViewMode = mode;
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem('giveos-sales-view-mode', mode);
			} catch {}
		}
	}

	$effect(() => {
		if (typeof window !== 'undefined') {
			try {
				const saved = localStorage.getItem('giveos-sales-view-mode');
				if (saved === 'cards' || saved === 'table') {
					salesViewMode = saved;
				}
			} catch {}
		}
	});

	const filteredSalesProducts = $derived(
		salesProducts.filter((p) => {
			if (!salesProductSearch.trim()) return true;
			const q = salesProductSearch.toLowerCase().trim();
			return (
				p.name.toLowerCase().includes(q) ||
				p.code.toLowerCase().includes(q) ||
				p.components.some(
					(c) =>
						(c.item?.name.toLowerCase().includes(q) ?? false) ||
						(c.item?.code.toLowerCase().includes(q) ?? false)
				)
			);
		})
	);

	$effect(() => {
		void salesProductSearch;
		salesProductPage = 1;
	});

	const paginatedSalesProducts = $derived(
		filteredSalesProducts.slice(
			(salesProductPage - 1) * salesProductPageSize,
			salesProductPage * salesProductPageSize
		)
	);
</script>

<Card>
	<CardHeader class="space-y-4 p-6 sm:p-8 sm:pb-4">
		<div class="flex flex-wrap items-center justify-between gap-4">
			<div class="space-y-1">
				<CardTitle class="flex items-center gap-2 text-lg">
					<Tag class="size-5 text-primary" />
					Productos para Venta
				</CardTitle>
				<CardDescription>
					Catálogo comercial disponible para el módulo de Órdenes.
				</CardDescription>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<div class="relative w-full sm:w-64">
					<Search class="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
					<Input
						type="search"
						placeholder="Buscar producto..."
						bind:value={salesProductSearch}
						class="h-10 pl-9"
					/>
				</div>

				<div class="ml-auto hidden sm:flex items-center gap-1 rounded-xl border border-border bg-muted/30 p-0.5">
					<Button
						type="button"
						variant={salesViewMode === 'cards' ? 'default' : 'ghost'}
						size="sm"
						class="h-7 px-2 text-xs gap-1"
						onclick={() => toggleSalesView('cards')}
						title="Vista de Tarjetas (Móvil)"
					>
						<LayoutGrid class="size-3.5" />
						<span>Tarjetas</span>
					</Button>
					<Button
						type="button"
						variant={salesViewMode === 'table' ? 'default' : 'ghost'}
						size="sm"
						class="h-7 px-2 text-xs gap-1"
						onclick={() => toggleSalesView('table')}
						title="Vista de Tabla"
					>
						<List class="size-3.5" />
						<span>Tabla</span>
					</Button>
				</div>

				<Button variant="secondary" onclick={onOpenNewProduct} class="gap-1.5 font-semibold shadow-xs">
					<Plus class="size-4" />
					<span>Nuevo Producto</span>
				</Button>
			</div>
		</div>
	</CardHeader>

	<CardContent class="p-4 pt-2 sm:p-6 sm:pt-4">
		{#if filteredSalesProducts.length > 0}
			<div class="space-y-4">
				{#if salesViewMode === 'cards'}
					<!-- VISTA DE TARJETAS (MOBILE-FIRST) -->
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{#each paginatedSalesProducts as sp (sp.id)}
							{@const margin = sp.salePrice - sp.estimatedRecipeCost}
							{@const marginPct =
								sp.salePrice > 0 ? Math.round((margin / sp.salePrice) * 100) : 0}
							<div
								class="flex flex-col justify-between rounded-2xl border border-border bg-card p-4 transition-all shadow-2xs hover:border-border/80"
							>
								<div>
									<div class="flex items-center justify-between gap-2">
										<span class="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
											{sp.code}
										</span>
										<div class="flex items-center gap-1.5">
											{#if sp.isShortcut}
												<Badge variant="outline" class="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 text-[10px]">
													<Star class="size-2.5 fill-amber-500 text-amber-500" />
													Atajo
												</Badge>
											{/if}
											{#if sp.isCombo}
												<Badge variant="secondary" class="text-[10px]">
													Combo ({sp.components.length})
												</Badge>
											{/if}
											{#if !sp.isActive}
												<Badge variant="outline" class="text-[10px]">Pausado</Badge>
											{/if}
										</div>
									</div>

									<div class="mt-2.5">
										<h3 class="font-bold text-base text-foreground line-clamp-1">{sp.name}</h3>
										{#if sp.description}
											<p class="mt-0.5 text-xs text-muted-foreground line-clamp-1">{sp.description}</p>
										{/if}
									</div>

									<!-- Componentes que descuenta -->
									<div class="mt-3 flex flex-wrap gap-1.5">
										{#each sp.components as comp (comp.id)}
											{#if comp.item}
												<span class="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-foreground">
													<span class="font-mono text-muted-foreground">[{comp.item.code}]</span>
													<span class="truncate max-w-[120px]">{comp.item.name}</span>
													<span class="font-bold text-primary">×{comp.quantity}</span>
												</span>
											{/if}
										{/each}
									</div>

									<!-- Tarjeta de Precio y Margen -->
									<div class="mt-3.5 grid grid-cols-2 gap-2 rounded-xl border border-border/60 bg-muted/20 p-2.5">
										<div>
											<span class="text-[11px] font-medium text-muted-foreground">Precio Venta</span>
											<p class="font-mono text-lg font-bold text-foreground">
												{formatCurrency(sp.salePrice)}
											</p>
											{#if sp.pricingTiers && sp.pricingTiers.length > 0}
												<div class="mt-1 flex flex-wrap gap-1">
													{#each sp.pricingTiers as tier}
														<span class="rounded bg-sky-500/10 px-1 py-0.2 text-[9px] font-mono text-sky-700">
															≥{tier.minQuantity}u: {tier.type === 'percentage' ? `-${tier.value}%` : formatCurrency(tier.value)}
														</span>
													{/each}
												</div>
											{/if}
										</div>
										<div>
											<span class="text-[11px] font-medium text-muted-foreground">Margen</span>
											<p class="font-mono text-base font-bold {margin >= 0 ? 'text-emerald-600' : 'text-destructive'}">
												{formatCurrency(margin)}
												<span class="text-xs font-normal">({marginPct}%)</span>
											</p>
											<p class="text-[10px] text-muted-foreground">
												Costo: {formatCurrency(sp.estimatedRecipeCost)}
											</p>
										</div>
									</div>
								</div>

								<!-- Footer con Acciones -->
								<div class="mt-3.5 flex items-center justify-between border-t border-border/50 pt-3">
									<form method="POST" action="?/toggleSalesProductShortcut" use:enhance class="inline">
										<input type="hidden" name="businessId" value={businessId} />
										<input type="hidden" name="id" value={sp.id} />
										<button
											type="submit"
											class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
											title={sp.isShortcut ? 'Quitar de atajos rápidos' : 'Marcar como atajo rápido en ventas'}
										>
											<Star class="size-3.5 {sp.isShortcut ? 'fill-amber-500 text-amber-500' : ''}" />
											<span>{sp.isShortcut ? 'En mostrador' : 'Atajo'}</span>
										</button>
									</form>
									<div class="flex items-center gap-1.5">
										<Button
											variant="ghost"
											size="sm"
											class="h-8 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
											onclick={() => onOpenDeleteProduct(sp)}
										>
											<Trash2 class="size-3.5 mr-1" />
											<span>Eliminar</span>
										</Button>
										<Button
											variant="outline"
											size="sm"
											class="h-8 text-xs gap-1"
											onclick={() => onOpenEditProduct(sp)}
										>
											<Pencil class="size-3.5" />
											<span>Editar</span>
										</Button>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<!-- VISTA DE TABLA -->
					<div class="overflow-x-auto rounded-xl border border-border">
						<table class="w-full text-left text-sm">
							<thead class="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
								<tr>
									<th class="py-3.5 pr-4 pl-5 font-semibold">Producto</th>
									<th class="px-4 py-3.5 font-semibold">Composición</th>
									<th class="px-4 py-3.5 text-right font-semibold">Costo Est.</th>
									<th class="px-4 py-3.5 text-right font-semibold">Precio</th>
									<th class="px-4 py-3.5 text-right font-semibold">Margen</th>
									<th class="py-3.5 pr-5 pl-4 text-right font-semibold">Acciones</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border/60">
								{#each paginatedSalesProducts as sp (sp.id)}
									{@const margin = sp.salePrice - sp.estimatedRecipeCost}
									{@const marginPct =
										sp.salePrice > 0 ? Math.round((margin / sp.salePrice) * 100) : 0}
									<tr class="transition-colors hover:bg-muted/20">
										<td class="py-4 pr-4 pl-5 align-middle">
											<div class="flex flex-wrap items-center gap-2">
												<span class="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
													{sp.code}
												</span>
												<span class="font-semibold text-foreground">{sp.name}</span>
												{#if sp.isShortcut}
													<Badge variant="outline" class="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 text-[10px]">
														<Star class="size-2.5 fill-amber-500 text-amber-500" />
														Atajo Rápido
													</Badge>
												{/if}
												{#if sp.isCombo}
													<Badge variant="secondary" class="text-[10px]">
														Combo ({sp.components.length})
													</Badge>
												{/if}
												{#if !sp.isActive}
													<Badge variant="outline" class="text-[10px]">Pausado</Badge>
												{/if}
											</div>
											{#if sp.description}
												<p class="mt-1 text-xs text-muted-foreground">{sp.description}</p>
											{/if}
										</td>

										<td class="px-4 py-4 align-middle">
											{#if sp.components.length > 0}
												<div class="flex flex-col gap-1.5">
													{#each sp.components as comp (comp.id)}
														{#if comp.item}
															<div class="flex flex-wrap items-center gap-2">
																<span class="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-mono text-xs font-medium">
																	<Link2 class="size-3 text-muted-foreground" />
																	{comp.item.code}
																</span>
																<button
																	type="button"
																	onclick={() => onSelectCatalogItem(comp.item!.id)}
																	class="text-xs font-medium text-foreground hover:text-primary hover:underline"
																>
																	{comp.item.name}
																</button>
																<ItemTypeBadge type={comp.item.type} short={true} />
																<span class="font-mono text-xs text-muted-foreground">
																	× {comp.quantity} {comp.item.baseUnit} (Stock: {formatQuantity(comp.item.currentStock)} {comp.item.baseUnit === 'unit' ? 'un' : comp.item.baseUnit})
																</span>
															</div>
														{:else}
															<span class="text-xs text-destructive">Ítem eliminado</span>
														{/if}
													{/each}
												</div>
											{:else}
												<span class="text-xs text-destructive">Sin productos asociados</span>
											{/if}
										</td>

										<td class="px-4 py-4 text-right align-middle font-mono text-xs text-muted-foreground">
											{formatCurrency(sp.estimatedRecipeCost)}
										</td>

										<td class="px-4 py-4 text-right align-middle">
											<span class="font-mono text-sm font-bold text-foreground block">
												{formatCurrency(sp.salePrice)}
											</span>
											{#if sp.pricingTiers && sp.pricingTiers.length > 0}
												<div class="mt-1 flex flex-wrap justify-end gap-1">
													{#each sp.pricingTiers as tier}
														<span class="rounded bg-sky-500/10 px-1.5 py-0.2 text-[10px] font-mono font-medium text-sky-700" title="Escala por cantidad">
															≥{tier.minQuantity}u: {tier.type === 'percentage' ? `-${tier.value}%` : formatCurrency(tier.value)}
														</span>
													{/each}
												</div>
											{/if}
										</td>

										<td class="px-4 py-4 text-right align-middle font-mono text-xs">
											<span class={margin >= 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-destructive'}>
												{formatCurrency(margin)} ({marginPct}%)
											</span>
										</td>

										<td class="py-4 pr-5 pl-4 text-right align-middle whitespace-nowrap">
											<div class="inline-flex items-center justify-end gap-1">
												<form method="POST" action="?/toggleSalesProductShortcut" use:enhance class="inline">
													<input type="hidden" name="businessId" value={businessId} />
													<input type="hidden" name="id" value={sp.id} />
													<button
														type="submit"
														class="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted {sp.isShortcut ? 'text-amber-500' : 'text-muted-foreground/40 hover:text-muted-foreground'}"
														title={sp.isShortcut ? 'Quitar de atajos rápidos' : 'Marcar como atajo rápido en ventas'}
													>
														<Star class="size-4 {sp.isShortcut ? 'fill-amber-500' : ''}" />
													</button>
												</form>
												<Button
													href="/inventory/products/{sp.id}/edit"
													size="icon"
													variant="ghost"
													class="size-8 text-muted-foreground hover:text-foreground"
													title="Editar producto de venta (Pantalla Completa)"
												>
													<Pencil class="size-4" />
												</Button>
												<Button
													type="button"
													size="icon"
													variant="ghost"
													class="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
													title="Eliminar producto de venta"
													onclick={() => onOpenDeleteProduct(sp)}
												>
													<Trash2 class="size-4" />
												</Button>
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}

				<TablePagination
					bind:currentPage={salesProductPage}
					bind:pageSize={salesProductPageSize}
					totalItems={filteredSalesProducts.length}
					itemLabel="productos de venta"
				/>
			</div>
		{:else}
			<div class="rounded-xl border border-dashed border-border p-12 text-center">
				<Tag class="mx-auto size-10 text-muted-foreground/60" />
				<p class="mt-3 text-base font-semibold text-foreground">
					Sin productos de venta
				</p>
				<p class="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
					Crea productos o combos comerciales para vender en el mostrador.
				</p>
				<Button variant="secondary" class="mt-4" onclick={onOpenNewProduct}>
					<Plus class="size-4" />
					<span>Nuevo Producto</span>
				</Button>
			</div>
		{/if}
	</CardContent>
</Card>
