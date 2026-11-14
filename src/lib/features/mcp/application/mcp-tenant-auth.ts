import { randomBytes, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Business } from '#lib/features/businesses/domain/business.entity';
import { getServices } from '#lib/server/container';
import { getDb } from '#lib/server/db';
import { businesses } from '#lib/server/db/schema';

/**
 * Formato del token Multi-Tenant:
 * gvos_mcp_<businessId>_<secretHex>
 * Permite buscar el negocio en O(1) por su Primary Key (businessId) y validar el secreto criptográfico.
 */
export function generateMcpApiKey(businessId: string): string {
	return `gvos_mcp_${businessId}_${randomBytes(16).toString('hex')}`;
}

function parseBusinessIdFromMcpKey(key: string): string | null {
	if (!key.startsWith('gvos_mcp_')) return null;
	const rest = key.slice('gvos_mcp_'.length);
	const lastUnderscore = rest.lastIndexOf('_');
	if (lastUnderscore <= 0) return null;
	return rest.slice(0, lastUnderscore);
}

function safeCompareKeys(a: string, b: string): boolean {
	const bufA = Buffer.from(a);
	const bufB = Buffer.from(b);
	if (bufA.length !== bufB.length) return false;
	return timingSafeEqual(bufA, bufB);
}

/**
 * Garantiza que un negocio (tenant) tenga su propia llave MCP generada en settings.integrations.mcp
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
	if (existingKey && parseBusinessIdFromMcpKey(existingKey) === businessId) {
		return existingKey;
	}

	const newKey = generateMcpApiKey(businessId);
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
 * Regenera/rota la llave MCP de un negocio (invalidando la anterior)
 */
export async function rotateBusinessMcpApiKey(businessId: string): Promise<string> {
	const db = getDb();
	const business = await db.query.businesses.findFirst({
		where: eq(businesses.id, businessId)
	});

	if (!business) {
		throw new Error('Negocio no encontrado.');
	}

	const newKey = generateMcpApiKey(businessId);
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
 * Resuelve el negocio (tenant) autenticado en O(1) por Primary Key a partir de la llave:
 * gvos_mcp_<businessId>_<secret>
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
		const extractedBusinessId = parseBusinessIdFromMcpKey(providedKey);

		if (extractedBusinessId) {
			const business = await db.query.businesses.findFirst({
				where: eq(businesses.id, extractedBusinessId)
			});
			const storedKey = business?.settings?.integrations?.mcp?.apiKey;
			const isEnabled = business?.settings?.integrations?.mcp?.enabled !== false;

			if (business && isEnabled && storedKey && safeCompareKeys(storedKey, providedKey)) {
				return business;
			}
		}

		throw new Error(
			'Llave MCP inválida o revocada. Copia la clave vigente desde la sección Asistente & MCP del negocio.'
		);
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
		'Autenticación multi-tenant requerida: proporciona la llave del negocio vía "?apiKey=gvos_mcp_..." en la URL.'
	);
}
