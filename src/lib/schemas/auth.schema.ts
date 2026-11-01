import { z } from 'zod';

export const loginSchema = z.object({
	email: z.string().email('Ingresa un correo electrónico válido'),
	password: z.string().min(1, 'La contraseña es requerida')
});

export const registerSchema = z
	.object({
		name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
		email: z.string().email('Ingresa un correo electrónico válido'),
		password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
		confirmPassword: z.string().min(1, 'Confirma tu contraseña')
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: 'Las contraseñas no coinciden',
		path: ['confirmPassword']
	});

export type LoginSchema = typeof loginSchema;
export type RegisterSchema = typeof registerSchema;
