import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAllDraftEntityJsonSchemas } from '#lib/features/drafts/domain/draft-schema-registry';
import { getMcpRegistry } from '#lib/features/mcp/application/mcp-registry.service';
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
	const initialDraftSummary = await draftService.getOrCreateActiveDraft(activeBusiness.id);
	const mcpRegistry = getMcpRegistry();

	return {
		user: locals.user,
		activeBusiness,
		businesses,
		initialDraftSummary,
		mcpTools: mcpRegistry.getMcpProtocolToolsList(),
		entitySchemas: getAllDraftEntityJsonSchemas()
	};
};
