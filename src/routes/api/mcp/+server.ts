import { json, type RequestHandler } from '@sveltejs/kit';
import { getMcpRegistry } from '#lib/features/mcp/application/mcp-registry.service';
import { getServices } from '#lib/server/container';
import { getDb } from '#lib/server/db';
import { businesses } from '#lib/server/db/schema';

async function resolveMcpBusinessId(request: Request, url: URL, locals: App.Locals): Promise<string> {
	const explicitId =
		request.headers.get('x-business-id') ||
		url.searchParams.get('businessId') ||
		url.searchParams.get('business');

	if (explicitId?.trim()) {
		return explicitId.trim();
	}

	if (locals.user) {
		const { businessService } = getServices();
		const userBusinesses = await businessService.listUserBusinesses(locals.user.id);
		if (userBusinesses.length > 0) {
			return userBusinesses[0].business.id;
		}
	}

	// En desarrollo local o si se provee MCP_API_KEY válida, tomar el primer negocio disponible
	const isDev = process.env.NODE_ENV !== 'production';
	const configuredKey = process.env.MCP_API_KEY;
	const authHeader = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();

	if (isDev || (configuredKey && authHeader === configuredKey)) {
		const db = getDb();
		const firstBusiness = await db.query.businesses.findFirst();
		if (firstBusiness) {
			return firstBusiness.id;
		}
	}

	throw new Error(
		'No se pudo determinar el businessId. Envía el header "x-business-id" o el parámetro "?businessId=..." en la URL del servidor MCP.'
	);
}

/**
 * GET /api/mcp
 * Devuelve metadatos del servidor MCP y las herramientas disponibles para inspección rápida.
 */
export const GET: RequestHandler = async ({ url }) => {
	const registry = getMcpRegistry();
	return json({
		name: 'giveos-mcp-server',
		version: '1.0.0',
		protocol: 'Model Context Protocol (JSON-RPC 2.0 over HTTP)',
		endpoint: `${url.origin}/api/mcp`,
		tools: registry.getMcpProtocolToolsList()
	});
};

/**
 * POST /api/mcp
 * Endpoint estándar JSON-RPC 2.0 para clientes MCP (Streamable HTTP)
 */
export const POST: RequestHandler = async ({ request, url, locals }) => {
	const registry = getMcpRegistry();
	const body = await request.json().catch(() => null);

	if (!body || typeof body !== 'object') {
		return json(
			{
				jsonrpc: '2.0',
				id: null,
				error: { code: -32700, message: 'Parse error: JSON inválido' }
			},
			{ status: 400 }
		);
	}

	const { id = null, method, params = {} } = body;

	try {
		if (method === 'initialize') {
			return json({
				jsonrpc: '2.0',
				id,
				result: {
					protocolVersion: '2024-11-05',
					capabilities: {
						tools: {
							listChanged: false
						}
					},
					serverInfo: {
						name: 'giveos-mcp-server',
						version: '1.0.0'
					}
				}
			});
		}

		if (method === 'notifications/initialized') {
			return new Response(null, { status: 202 });
		}

		if (method === 'ping') {
			return json({
				jsonrpc: '2.0',
				id,
				result: {}
			});
		}

		if (method === 'tools/list') {
			return json({
				jsonrpc: '2.0',
				id,
				result: {
					tools: registry.getMcpProtocolToolsList()
				}
			});
		}

		if (method === 'tools/call') {
			const toolName = params?.name;
			const toolArgs = params?.arguments ?? {};
			const businessId = await resolveMcpBusinessId(request, url, locals);
			const sessionId =
				request.headers.get('x-session-id') || url.searchParams.get('sessionId') || null;

			const output = await registry.executeTool(
				toolName,
				{
					businessId,
					sessionId,
					userId: locals.user?.id ?? null
				},
				toolArgs
			);

			return json({
				jsonrpc: '2.0',
				id,
				result: {
					content: [
						{
							type: 'text',
							text: JSON.stringify(output, null, 2)
						}
					],
					isError: false
				}
			});
		}

		return json(
			{
				jsonrpc: '2.0',
				id,
				error: {
					code: -32601,
					message: `Method not found: ${method}`
				}
			},
			{ status: 404 }
		);
	} catch (err: any) {
		return json({
			jsonrpc: '2.0',
			id,
			result: {
				content: [
					{
						type: 'text',
						text: JSON.stringify(
							{
								error: true,
								message: err?.message || 'Error ejecutando operación MCP'
							},
							null,
							2
						)
					}
				],
				isError: true
			}
		});
	}
};
