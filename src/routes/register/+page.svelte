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
	import UserPlus from '@lucide/svelte/icons/user-plus';

	let { form }: PageProps = $props();
	let loading = $state(false);
</script>

<svelte:head>
	<title>Crear Cuenta — GiveOS</title>
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
					Registra tu cuenta para administrar recetas, inventario y órdenes • giveo.net
				</p>
			</div>
		</div>

		<Card>
			<CardHeader class="space-y-2 p-6 sm:p-8 sm:pb-4">
				<CardTitle class="text-xl">Crear Cuenta</CardTitle>
				<CardDescription>
					Completa tus datos para comenzar a gestionar tus recetas e inventario
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
					class="space-y-5"
				>
					<div class="space-y-2.5">
						<Label for="name">Nombre completo</Label>
						<Input
							id="name"
							name="name"
							type="text"
							placeholder="Ej. Ana Pastelería"
							value={form?.name ?? ''}
							class="h-10"
							autocomplete="name"
							required
						/>
					</div>

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
						<Label for="password">Contraseña (mínimo 8 caracteres)</Label>
						<Input
							id="password"
							name="password"
							type="password"
							placeholder="••••••••"
							minlength={8}
							class="h-10"
							autocomplete="new-password"
							required
						/>
					</div>

					<div class="space-y-2.5">
						<Label for="confirmPassword">Confirmar contraseña</Label>
						<Input
							id="confirmPassword"
							name="confirmPassword"
							type="password"
							placeholder="••••••••"
							minlength={8}
							class="h-10"
							autocomplete="new-password"
							required
						/>
					</div>

					<div class="pt-1">
						<Button type="submit" class="h-10 w-full" disabled={loading}>
							<UserPlus class="size-4" />
							<span>{loading ? 'Registrando...' : 'Crear Cuenta'}</span>
						</Button>
					</div>
				</form>

				<div class="mt-6 border-t border-border pt-6 text-center text-sm text-muted-foreground">
					¿Ya tienes una cuenta?
					<a href="/login" class="ml-1 font-medium text-primary hover:underline">
						Iniciar sesión
					</a>
				</div>
			</CardContent>
		</Card>
	</div>
</div>
