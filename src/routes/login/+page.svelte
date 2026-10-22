<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { Button } from '#lib/components/ui/button';
	import { Input } from '#lib/components/ui/input';
	import { Label } from '#lib/components/ui/label';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card';
	import ScanFace from '@lucide/svelte/icons/scan-face';
	import LogIn from '@lucide/svelte/icons/log-in';

	let { form }: PageProps = $props();
	let loading = $state(false);
</script>

<svelte:head>
	<title>Iniciar Sesión — GiveOS</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-muted/20 px-6 py-12">
	<div class="w-full max-w-md space-y-8">
		<!-- Marca / Encabezado -->
		<div class="flex flex-col items-center space-y-3 text-center">
			<div class="flex size-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground shadow-sm">
				<ScanFace class="size-6" />
			</div>
			<div class="space-y-1">
				<h1 class="text-2xl font-bold tracking-tight">GiveOS</h1>
				<p class="text-sm text-muted-foreground">
					Gestión de recetas, costos, órdenes e insumos • giveo.net
				</p>
			</div>
		</div>

		<Card>
			<CardHeader class="space-y-2 p-6 sm:p-8 sm:pb-4">
				<CardTitle class="text-xl">Iniciar Sesión</CardTitle>
				<CardDescription>
					Introduce tu correo electrónico y contraseña para continuar
				</CardDescription>
			</CardHeader>

			<CardContent class="p-6 pt-2 sm:p-8 sm:pt-4">
				{#if form?.error}
					<div class="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3.5 text-sm text-destructive">
						{form.error}
					</div>
				{/if}

				<form
					method="POST"
					use:enhance={() => {
						loading = true;
						return async ({ update }) => {
							await update();
							loading = false;
						};
					}}
					class="space-y-6"
				>
					<div class="space-y-2.5">
						<Label for="email">Correo electrónico</Label>
						<Input
							id="email"
							name="email"
							type="email"
							placeholder="pasteleria@ejemplo.com"
							value={form?.email ?? ''}
							class="h-10"
							autocomplete="email"
							required
						/>
					</div>

					<div class="space-y-2.5">
						<Label for="password">Contraseña</Label>
						<Input
							id="password"
							name="password"
							type="password"
							placeholder="••••••••"
							class="h-10"
							autocomplete="current-password"
							required
						/>
					</div>

					<Button type="submit" class="h-10 w-full" disabled={loading}>
						<LogIn class="size-4" />
						<span>{loading ? 'Ingresando...' : 'Iniciar Sesión'}</span>
					</Button>
				</form>

				<div class="mt-6 border-t border-border pt-6 text-center text-sm text-muted-foreground">
					¿Todavía no tienes una cuenta?
					<a href="/register" class="ml-1 font-medium text-primary hover:underline">
						Crear una cuenta
					</a>
				</div>
			</CardContent>
		</Card>
	</div>
</div>
