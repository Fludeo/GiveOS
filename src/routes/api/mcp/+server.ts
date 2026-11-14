import { json, type RequestHandler } from '@sveltejs/kit';
import { getMcpRegistry } from '#lib/features/mcp/application/mcp-registry.service';
import { resolveTenantFromMcpRequest } from '#lib/features/mcp/application/mcp-tenant-auth';

/**
 * GET /api/mcp
 * Devuelve metadatos del servidor MCP multi-tenant y las herramientas disponibles.
 */
export const GET: RequestHandler = async ({ url }) => {
	const registry = getMcpRegistry();
	return json({
		name: 'giveos-mcp-server',
		version: '1.0.0',
		multiTenant: true,
		protocol: 'Model Context Protocol (JSON-RPC 2.0 over Streamable HTTP)',
		endpoint: `${url.origin}/api/mcp`,
		auth: 'Provide tenant key via ?apiKey=gvos_mcp_... or Authorization: Bearer gvos_mcp_...',
		tools: registry.getMcpProtocolToolsList()
	});
};

/**
 * POST /api/mcp
 * Endpoint estándar JSON-RPC 2.0 Multi-Tenant para clientes MCP (Streamable HTTP)
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
			const tenantBusiness = await resolveTenantFromMcpRequest(request, url, locals);
			const sessionId =
				request.headers.get('x-session-id') || url.searchParams.get('sessionId') || null;

			const output = await registry.executeTool(
				toolName,
				{
					businessId: tenantBusiness.id,
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
