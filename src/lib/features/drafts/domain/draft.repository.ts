import type { Draft, DraftPayload, DraftStatus } from './draft.entity';

export interface CreateDraftInput {
	businessId: string;
	sessionId?: string | null;
	title?: string;
	payload?: DraftPayload;
}

export interface UpdateDraftInput {
	title?: string;
	status?: DraftStatus;
	payload?: DraftPayload;
}

export interface IDraftRepository {
	findById(id: string, businessId: string): Promise<Draft | null>;
	findActiveByBusiness(businessId: string, sessionId?: string | null): Promise<Draft | null>;
	findAllByBusiness(businessId: string, status?: DraftStatus): Promise<Draft[]>;
	create(input: CreateDraftInput): Promise<Draft>;
	update(id: string, businessId: string, input: UpdateDraftInput): Promise<Draft | null>;
	delete(id: string, businessId: string): Promise<boolean>;
}
