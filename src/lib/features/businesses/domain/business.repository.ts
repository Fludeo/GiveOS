import type {
	Business,
	CreateBusinessForUserInput,
	UpdateBusinessInput,
	UserBusinessMembership
} from './business.entity';

export interface IBusinessRepository {
	findBusinessesByUserId(userId: string): Promise<UserBusinessMembership[]>;
	findByIdForUser(businessId: string, userId: string): Promise<UserBusinessMembership | null>;
	createForUser(input: CreateBusinessForUserInput): Promise<UserBusinessMembership>;
	update(businessId: string, input: UpdateBusinessInput): Promise<Business | null>;
}
