import { json, type RequestHandler } from '@sveltejs/kit';
import { resolveBusinessOrRedirect } from '#lib/server/business-resolver';
import { getServices } from '#lib/server/container';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return json({ error: 'No autorizado' }, { status: 401 });
	}

	const businessId = url.searchParams.get('businessId') || url.searchParams.get('business');
	const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessId);

	const { draftService } = getServices();
	const summary = await draftService.getOrCreateActiveDraft(activeBusiness.id);

	return json({
		success: true,
		summary
	});
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'No autorizado' }, { status: 401 });
	}

	const body = await request.json().catch(() => ({}));
	const { businessId, action, entryId, entries, entry } = body;

	const { activeBusiness } = await resolveBusinessOrRedirect(locals.user.id, businessId);
	const { draftService } = getServices();

	try {
		if (action === 'commit') {
			const commitResult = await draftService.commitDraft(activeBusiness.id);
			const nextSummary = await draftService.getOrCreateActiveDraft(activeBusiness.id);
			return json({
				success: true,
				commitResult,
				summary: nextSummary
			});
		}

		if (action === 'remove_entry') {
			if (!entryId) {
				return json({ error: 'entryId es requerido' }, { status: 400 });
			}
			const summary = await draftService.removeEntry(activeBusiness.id, entryId);
			return json({
				success: true,
				summary
			});
		}

		if (action === 'clear') {
			const summary = await draftService.clearDraft(activeBusiness.id);
			return json({
				success: true,
				summary
			});
		}

		if (action === 'upsert_entry' && entry) {
			const res = await draftService.upsertEntry({
				businessId: activeBusiness.id,
				entryId: entry.entryId,
				entityType: entry.entityType,
				action: entry.action ?? 'create',
				targetId: entry.targetId,
				data: entry.data ?? {},
				merge: entry.merge ?? true
			});
			return json({
				success: true,
				entry: res.entry,
				summary: res.summary
			});
		}

		if (action === 'upsert_batch' && Array.isArray(entries)) {
			let summary = await draftService.getOrCreateActiveDraft(activeBusiness.id);
			for (const item of entries) {
				const res = await draftService.upsertEntry({
					businessId: activeBusiness.id,
					entryId: item.entryId,
					entityType: item.entityType,
					action: item.action ?? 'create',
					targetId: item.targetId,
					data: item.data ?? {},
					merge: true
				});
				summary = res.summary;
			}
			return json({
				success: true,
				summary
			});
		}

		return json({ error: `Acción desconocida: ${action}` }, { status: 400 });
	} catch (err: any) {
		return json(
			{
				error: err?.message || 'Error ejecutando operación en el borrador'
			},
			{ status: 400 }
		);
	}
};
