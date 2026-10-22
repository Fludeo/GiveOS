<script lang="ts" module>
	import { tv, type VariantProps } from 'tailwind-variants';

	export const badgeVariants = tv({
		base: 'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
		variants: {
			variant: {
				default: 'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
				secondary:
					'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
				destructive:
					'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
				outline: 'text-foreground',
				accent: 'border-lime-500/40 bg-lime-400/20 text-lime-900 dark:text-lime-300 font-semibold',
				yellow: 'border-yellow-500/40 bg-yellow-400/20 text-yellow-900 dark:text-yellow-300 font-semibold',
				success: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-semibold',
				warning: 'border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300 font-semibold',
				muted: 'border-transparent bg-muted text-muted-foreground hover:bg-muted/80'
			}
		},
		defaultVariants: {
			variant: 'default'
		}
	});

	export type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils';

	let {
		class: className,
		variant = 'default',
		children,
		...restProps
	}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant } = $props();
</script>

<span class={cn(badgeVariants({ variant }), className)} {...restProps}>
	{@render children?.()}
</span>
