<script lang="ts">
	interface Props {
		checked?: boolean;
		disabled?: boolean;
		onchange?: (checked: boolean) => void;
		onCheckedChange?: (checked: boolean) => void;
		id?: string;
		name?: string;
		class?: string;
		'aria-label'?: string;
		[key: string]: any;
	}

	let {
		checked = $bindable(false),
		disabled = false,
		onchange,
		onCheckedChange,
		id,
		name,
		class: customClass = '',
		...restProps
	}: Props = $props();

	function toggle() {
		if (disabled) return;
		checked = !checked;
		onchange?.(checked);
		onCheckedChange?.(checked);
	}
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	{disabled}
	{id}
	onclick={toggle}
	class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {checked
		? 'bg-primary'
		: 'bg-muted-foreground/30'} {customClass}"
	{...restProps}
>
	{#if name}
		<input type="hidden" {name} value={checked ? 'true' : 'false'} />
	{/if}
	<span
		class="pointer-events-none inline-block size-5 transform rounded-full bg-background shadow-md ring-0 transition duration-200 ease-in-out {checked
			? 'translate-x-5'
			: 'translate-x-0'}"
	></span>
</button>
