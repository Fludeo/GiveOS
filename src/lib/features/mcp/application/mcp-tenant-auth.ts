import { randomBytes, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Business } from '#lib/features/businesses/domain/business.entity';
import { getServices } from '#lib/server/container';
import { getDb } from '#lib/server/db';
import { businesses } from '#lib/server/db/schema';

export function generateMcpApiKey(): string {
	return `gvos_mcp_${randomBytes(20).toString('hex')}`;
}

function safeCompareKeys(a: string, b: string): boolean {
	const bufA = Buffer.from(a);
	const bufB = Buffer.from(b);
	if (bufA.length !== bufB.length) return false;
	return timingSafeEqual(bufA, bufB);
}

/**
 * Garantiza que un negocio (tenant) tenga su propia API Key de MCP generada en settings.integrations.mcp
 */
export async function ensureBusinessMcpApiKey(businessId: string): Promise<string> {
	const db = getDb();
	const business = await db.query.businesses.findFirst({
		where: eq(businesses.id, businessId)
	});

	if (!business) {
		throw new Error('Negocio no encontrado.');
	}

	const existingKey = business.settings?.integrations?.mcp?.apiKey;
	if (existingKey && existingKey.startsWith('gvos_mcp_')) {
		return existingKey;
	}

	const newKey = generateMcpApiKey();
	const nextSettings = {
		...(business.settings ?? {}),
		integrations: {
			...(business.settings?.integrations ?? {}),
			mcp: {
				enabled: true,
				apiKey: newKey,
				updatedAt: new Date().toISOString()
			}
		}
	};

	await db
		.update(businesses)
		.set({ settings: nextSettings })
		.where(eq(businesses.id, businessId));

	return newKey;
}

/**
 * Regenera/rota la API Key de MCP de un negocio (invalidando la anterior)
 */
export async function rotateBusinessMcpApiKey(businessId: string): Promise<string> {
	const db = getDb();
	const business = await db.query.businesses.findFirst({
		where: eq(businesses.id, businessId)
	});

	if (!business) {
		throw new Error('Negocio no encontrado.');
	}

	const newKey = generateMcpApiKey();
	const nextSettings = {
		...(business.settings ?? {}),
		integrations: {
			...(business.settings?.integrations ?? {}),
			mcp: {
				enabled: business.settings?.integrations?.mcp?.enabled ?? true,
				apiKey: newKey,
				updatedAt: new Date().toISOString()
			}
		}
	};

	await db
		.update(businesses)
		.set({ settings: nextSettings })
		.where(eq(businesses.id, businessId));

	return newKey;
}

/**
 * Resuelve el negocio (tenant) autenticado a partir de la petición MCP:
 * 1. Por API Key de Tenant (Header Authorization: Bearer gvos_mcp_..., x-mcp-api-key, o query ?apiKey=gvos_mcp_...)
 * 2. O por sesión autenticada de usuario verificando membresía en el negocio
 */
export async function resolveTenantFromMcpRequest(
	request: Request,
	url: URL,
	locals: App.Locals
): Promise<Business> {
	const bearerToken = request.headers
		.get('authorization')
		?.replace(/^Bearer\s+/i, '')
		.trim();
	const headerKey = request.headers.get('x-mcp-api-key')?.trim();
	const queryKey = url.searchParams.get('apiKey')?.trim();

	const providedKey = bearerToken || headerKey || queryKey;

	if (providedKey) {
		const db = getDb();
		const allBusinesses = await db.select().from(businesses);
		const matched = allBusinesses.find((b) => {
			const tenantKey = b.settings?.integrations?.mcp?.apiKey;
			const isEnabled = b.settings?.integrations?.mcp?.enabled !== false;
			return isEnabled && tenantKey && safeCompareKeys(tenantKey, providedKey);
		});

		if (!matched) {
			throw new Error(
				'MCP API Key inválida o revocada. Copia la clave vigente desde la sección Asistente & MCP del negocio.'
			);
		}

		return matched;
	}

	// Si hay sesión web activa del usuario, verificar membresía multi-tenant
	if (locals.user) {
		const { businessService } = getServices();
		const memberships = await businessService.listUserBusinesses(locals.user.id);
		if (memberships.length === 0) {
			throw new Error('El usuario no tiene negocios asociados.');
		}

		const requestedId =
			request.headers.get('x-business-id') ||
			url.searchParams.get('businessId') ||
			url.searchParams.get('business');

		if (requestedId) {
			const found = memberships.find((m) => m.business.id === requestedId);
			if (!found) {
				throw new Error('No tienes permisos para acceder a este negocio (tenant).');
			}
			return found.business;
		}

		return memberships[0].business;
	}

	throw new Error(
		'Autenticación multi-tenant requerida: proporciona la API Key del negocio vía "?apiKey=gvos_mcp_..." en la URL o en el header "Authorization: Bearer gvos_mcp_...".'
	);
}
