<script lang="ts">
	import AppShell from '#lib/components/layout/app-shell.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Dashboard — {data.activeBusiness.name}</title>
</svelte:head>

<AppShell
	user={data.user}
	businesses={data.businesses}
	activeBusiness={data.activeBusiness}
	currentSection="dashboard"
	title="Dashboard"
	description="Panel principal de {data.activeBusiness.name}"
>
	<div class="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
		<p class="text-sm">Espacio para el rework del Dashboard</p>
	</div>
</AppShell>
