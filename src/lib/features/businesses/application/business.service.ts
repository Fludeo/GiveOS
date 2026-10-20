import {
	parseWeeklySchedule,
	validateWeeklySchedule,
	type Business,
	type CreateBusinessForUserInput,
	type UpdateBusinessInput,
	type UserBusinessMembership
} from '../domain/business.entity';
import type { IBusinessRepository } from '../domain/business.repository';

export class BusinessService {
	constructor(private readonly businessRepo: IBusinessRepository) {}

	async listUserBusinesses(userId: string): Promise<UserBusinessMembership[]> {
		return this.businessRepo.findBusinessesByUserId(userId);
	}

	async getActiveBusinessForUser(
		userId: string,
		requestedBusinessId?: string | null
	): Promise<Business | null> {
		const memberships = await this.businessRepo.findBusinessesByUserId(userId);
		if (memberships.length === 0) return null;

		if (requestedBusinessId) {
			const match = memberships.find((m) => m.business.id === requestedBusinessId);
			if (match) return match.business;
		}

		return memberships[0].business;
	}

	async createBusinessForUser(input: CreateBusinessForUserInput): Promise<UserBusinessMembership> {
		if (!input.name.trim()) {
			throw new Error('El nombre del negocio es obligatorio.');
		}
		if (!input.description.trim()) {
			throw new Error('La descripción del negocio es obligatoria.');
		}
		if (!input.whatsapp.trim()) {
			throw new Error('El número de WhatsApp es obligatorio.');
		}
		if (!input.openingHours.trim()) {
			throw new Error('Los horarios de atención son obligatorios.');
		}

		const parsedSchedule = parseWeeklySchedule(input.openingHours);
		if (parsedSchedule) {
			const scheduleError = validateWeeklySchedule(parsedSchedule);
			if (scheduleError) {
				throw new Error(scheduleError);
			}
		}

		return this.businessRepo.createForUser(input);
	}

	async updateBusinessForUser(
		userId: string,
		businessId: string,
		input: UpdateBusinessInput
	): Promise<Business> {
		const membership = await this.businessRepo.findByIdForUser(businessId, userId);
		if (!membership) {
			throw new Error('No tienes permiso para editar este negocio.');
		}

		if (input.name !== undefined && !input.name.trim()) {
			throw new Error('El nombre del negocio es obligatorio.');
		}
		if (input.description !== undefined && !input.description.trim()) {
			throw new Error('La descripción del negocio es obligatoria.');
		}
		if (input.whatsapp !== undefined && !input.whatsapp.trim()) {
			throw new Error('El número de WhatsApp es obligatorio.');
		}
		if (input.openingHours !== undefined) {
			if (!input.openingHours.trim()) {
				throw new Error('Los horarios de atención son obligatorios.');
			}
			const parsedSchedule = parseWeeklySchedule(input.openingHours);
			if (parsedSchedule) {
				const scheduleError = validateWeeklySchedule(parsedSchedule);
				if (scheduleError) {
					throw new Error(scheduleError);
				}
			}
		}

		const updated = await this.businessRepo.update(businessId, input);
		if (!updated) {
			throw new Error('No se pudo actualizar el negocio.');
		}
		return updated;
	}
}
