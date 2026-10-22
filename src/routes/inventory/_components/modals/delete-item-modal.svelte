<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Item } from '#lib/features/items/domain/item.entity';
	import { Button } from '#lib/components/ui/button';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	interface Props {
		open: boolean;
		item: Item | null;
		businessId: string;
		onClose: () => void;
	}

	let { open = $bindable(), item, businessId, onClose }: Props = $props();

	function handleClose() {
		open = false;
		onClose();
	}
</script>

{#if open && item}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[1px]"
		role="dialog"
		aria-modal="true"
	>
		<div class="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
			<div class="space-y-3 p-6">
				<div class="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
					<AlertTriangle class="size-5" />
				</div>
				<div class="space-y-1.5">
					<h2 class="text-lg font-bold text-foreground">
						¿Eliminar "{item.name}"?
					</h2>
					<p class="text-sm text-muted-foreground">
						Estás por eliminar el ítem <strong class="text-foreground">{item.code}</strong> del inventario. Esta acción no se puede deshacer.
					</p>
				</div>
			</div>

			<div class="flex items-center justify-end gap-2.5 border-t border-border bg-muted/20 px-6 py-4">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onclick={handleClose}
				>
					Cancelar
				</Button>
				<form
					method="POST"
					action="?/deleteItem"
					use:enhance={() => {
						return async ({ update }) => {
							await update();
							handleClose();
						};
					}}
				>
					<input type="hidden" name="businessId" value={businessId} />
					<input type="hidden" name="id" value={item.id} />
					<Button type="submit" variant="destructive" size="sm">
						<Trash2 class="size-3.5" />
						<span>Sí, eliminar</span>
					</Button>
				</form>
			</div>
		</div>
	</div>
{/if}
