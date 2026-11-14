import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAllDraftEntityJsonSchemas } from '#lib/features/drafts/domain/draft-schema-registry';
import { getMcpRegistry } from '#lib/features/mcp/application/mcp-registry.service';
import { getBusinessMcpKeyStatus } from '#lib/features/mcp/application/mcp-tenant-auth';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import { getServices } from '#lib/server/container';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const businessIdParam = url.searchParams.get('business');
	const { activeBusiness, memberships } = await resolveBusinessOrRedirect(
		locals.user.id,
		businessIdParam
	);
	const businesses = memberships.map((m) => ({ ...m.business, role: m.role }));

	const { draftService } = getServices();
	const [initialDraftSummary, mcpKeyStatus] = await Promise.all([
		draftService.getOrCreateActiveDraft(activeBusiness.id),
		getBusinessMcpKeyStatus(activeBusiness.id)
	]);
	const mcpRegistry = getMcpRegistry();

	return {
		user: locals.user,
		activeBusiness,
		businesses,
		initialDraftSummary,
		mcpKeyStatus,
		mcpTools: mcpRegistry.getMcpProtocolToolsList(),
		entitySchemas: getAllDraftEntityJsonSchemas()
	};
};
