import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Business } from '#lib/features/businesses/domain/business.entity';
import { getServices } from '#lib/server/container';
import { getDb } from '#lib/server/db';
import { businesses } from '#lib/server/db/schema';

export interface McpKeyStatus {
	enabled: boolean;
	hasKey: boolean;
	isExpired: boolean;
	keyHint: string | null;
	createdAt: string | null;
	expiresAt: string | null;
}

/**
 * Formato del token Multi-Tenant:
 * gvos_mcp_<businessId>_<secretHex>
 * En la base de datos NUNCA se almacena el token en texto plano, sino únicamente su hash SHA-256.
 */
function generateRawMcpApiKey(businessId: string): string {
	return `gvos_mcp_${businessId}_${randomBytes(20).toString('hex')}`;
}

function hashMcpApiKey(rawKey: string): string {
	return createHash('sha256').update(rawKey).digest('hex');
}

function parseBusinessIdFromMcpKey(key: string): string | null {
	if (!key.startsWith('gvos_mcp_')) return null;
	const rest = key.slice('gvos_mcp_'.length);
	const lastUnderscore = rest.lastIndexOf('_');
	if (lastUnderscore <= 0) return null;
	return rest.slice(0, lastUnderscore);
}

function safeCompareHashes(hashA: string, hashB: string): boolean {
	const bufA = Buffer.from(hashA, 'utf8');
	const bufB = Buffer.from(hashB, 'utf8');
	if (bufA.length !== bufB.length) return false;
	return timingSafeEqual(bufA, bufB);
}

export async function getBusinessMcpKeyStatus(businessId: string): Promise<McpKeyStatus> {
	const db = getDb();
	const business = await db.query.businesses.findFirst({
		where: eq(businesses.id, businessId)
	});

	if (!business) {
		throw new Error('Negocio no encontrado.');
	}

	const mcpConfig = business.settings?.integrations?.mcp;
	const hasKey = Boolean(mcpConfig?.keyHash);
	const expiresAt = mcpConfig?.expiresAt ?? null;
	const isExpired = Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());

	return {
		enabled: Boolean(mcpConfig?.enabled && hasKey && !isExpired),
		hasKey,
		isExpired,
		keyHint: mcpConfig?.keyHint ?? null,
		createdAt: mcpConfig?.createdAt ?? null,
		expiresAt
	};
}

/**
 * Genera bajo demanda una nueva llave MCP para el negocio, guarda únicamente su hash SHA-256
 * y su fecha de expiración opcional, y devuelve la clave en texto plano por única vez.
 */
export async function createBusinessMcpApiKey(
	businessId: string,
	durationDays?: number | null
): Promise<{ rawApiKey: string; status: McpKeyStatus }> {
	const db = getDb();
	const business = await db.query.businesses.findFirst({
		where: eq(businesses.id, businessId)
	});

	if (!business) {
		throw new Error('Negocio no encontrado.');
	}

	const rawApiKey = generateRawMcpApiKey(businessId);
	const keyHash = hashMcpApiKey(rawApiKey);
	const keyHint = `...${rawApiKey.slice(-6)}`;
	const createdAt = new Date().toISOString();
	const expiresAt =
		durationDays && durationDays > 0
			? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
			: null;

	const nextSettings = {
		...(business.settings ?? {}),
		integrations: {
			...(business.settings?.integrations ?? {}),
			mcp: {
				enabled: true,
				keyHash,
				keyHint,
				createdAt,
				expiresAt
			}
		}
	};

	await db
		.update(businesses)
		.set({ settings: nextSettings })
		.where(eq(businesses.id, businessId));

	return {
		rawApiKey,
		status: {
			enabled: true,
			hasKey: true,
			isExpired: false,
			keyHint,
			createdAt,
			expiresAt
		}
	};
}

/**
 * Revoca y desactiva inmediatamente la llave MCP del negocio.
 */
export async function revokeBusinessMcpApiKey(businessId: string): Promise<McpKeyStatus> {
	const db = getDb();
	const business = await db.query.businesses.findFirst({
		where: eq(businesses.id, businessId)
	});

	if (!business) {
		throw new Error('Negocio no encontrado.');
	}

	const nextSettings = {
		...(business.settings ?? {}),
		integrations: {
			...(business.settings?.integrations ?? {}),
			mcp: {
				enabled: false,
				keyHash: null,
				keyHint: null,
				createdAt: null,
				expiresAt: null
			}
		}
	};

	await db
		.update(businesses)
		.set({ settings: nextSettings })
		.where(eq(businesses.id, businessId));

	return {
		enabled: false,
		hasKey: false,
		isExpired: false,
		keyHint: null,
		createdAt: null,
		expiresAt: null
	};
}

/**
 * Resuelve el negocio (tenant) autenticado en O(1) por Primary Key y verifica el hash SHA-256 y su expiración.
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

		if (!extractedBusinessId) {
			throw new Error('Formato de llave MCP inválido.');
		}

		const [business] = await db
			.select()
			.from(businesses)
			.where(eq(businesses.id, extractedBusinessId))
			.limit(1);

		const mcpConfig = business?.settings?.integrations?.mcp;
		if (!business || !mcpConfig?.enabled || !mcpConfig?.keyHash) {
			throw new Error(
				'Acceso MCP desactivado o llave revocada para este negocio. Genera una nueva desde la sección Asistente & MCP.'
			);
		}

		if (mcpConfig.expiresAt && new Date(mcpConfig.expiresAt).getTime() <= Date.now()) {
			throw new Error(
				'La llave MCP de este negocio ha expirado. Genera una nueva desde la sección Asistente & MCP.'
			);
		}

		const incomingHash = hashMcpApiKey(providedKey);
		if (!safeCompareHashes(mcpConfig.keyHash, incomingHash)) {
			throw new Error('Llave MCP inválida.');
		}

		return business;
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
		'Autenticación multi-tenant requerida: envía el header "Authorization: Bearer gvos_mcp_..." generado en la sección Asistente & MCP.'
	);
}
