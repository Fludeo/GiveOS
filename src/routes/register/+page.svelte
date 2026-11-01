<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
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

	let { data, form: actionForm }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, message } = superForm(data.form);
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
				{#if $message || (actionForm && typeof actionForm === 'object' && 'error' in actionForm ? (actionForm as any).error : null)}
					<div class="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3.5 text-sm text-destructive">
						{$message || (actionForm && typeof actionForm === 'object' && 'error' in actionForm ? (actionForm as any).error : null)}
					</div>
				{/if}

				<form
					method="POST"
					use:enhance
					class="space-y-5"
				>
					<div class="space-y-2.5">
						<Label for="name">Nombre completo</Label>
						<Input
							id="name"
							name="name"
							type="text"
							placeholder="Ej. Ana Pastelería"
							bind:value={$form.name}
							class="h-10"
							autocomplete="name"
							required
						/>
						{#if $errors.name}
							<p class="text-xs text-destructive">{$errors.name}</p>
						{/if}
					</div>

					<div class="space-y-2.5">
						<Label for="email">Correo electrónico</Label>
						<Input
							id="email"
							name="email"
							type="email"
							placeholder="pasteleria@ejemplo.com"
							bind:value={$form.email}
							class="h-10"
							autocomplete="email"
							required
						/>
						{#if $errors.email}
							<p class="text-xs text-destructive">{$errors.email}</p>
						{/if}
					</div>

					<div class="space-y-2.5">
						<Label for="password">Contraseña</Label>
						<Input
							id="password"
							name="password"
							type="password"
							placeholder="Mínimo 8 caracteres"
							bind:value={$form.password}
							class="h-10"
							autocomplete="new-password"
							required
						/>
						{#if $errors.password}
							<p class="text-xs text-destructive">{$errors.password}</p>
						{/if}
					</div>

					<div class="space-y-2.5">
						<Label for="confirmPassword">Confirmar contraseña</Label>
						<Input
							id="confirmPassword"
							name="confirmPassword"
							type="password"
							placeholder="Repite la contraseña"
							bind:value={$form.confirmPassword}
							class="h-10"
							autocomplete="new-password"
							required
						/>
						{#if $errors.confirmPassword}
							<p class="text-xs text-destructive">{$errors.confirmPassword}</p>
						{/if}
					</div>

					<Button
						type="submit"
						class="w-full h-10 gap-2 font-semibold"
						disabled={$delayed}
					>
						<UserPlus class="size-4" />
						<span>{$delayed ? 'Creando cuenta...' : 'Crear Cuenta y Continuar'}</span>
					</Button>
				</form>
			</CardContent>
		</Card>

		<!-- Pie -->
		<p class="text-center text-sm text-muted-foreground">
			¿Ya tienes una cuenta registrada?
			<a
				href="/login"
				class="font-semibold text-foreground underline-offset-4 hover:underline"
			>
				Iniciar sesión
			</a>
		</p>
	</div>
</div>
