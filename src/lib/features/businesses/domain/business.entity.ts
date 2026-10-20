export const BUSINESS_ROLES = ['owner', 'admin', 'member'] as const;
export type BusinessRole = (typeof BUSINESS_ROLES)[number];

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface TimeBlock {
	open: string;
	close: string;
}

export interface DaySchedule {
	day: DayKey;
	label: string;
	shortLabel: string;
	enabled: boolean;
	blocks: TimeBlock[];
}

export interface Business {
	id: string;
	name: string;
	description: string;
	whatsapp: string;
	/** JSON serializado de DaySchedule[] (o texto legible) */
	openingHours: string;
	createdAt: Date;
}

export interface UserBusinessMembership {
	business: Business;
	role: BusinessRole;
	joinedAt: Date;
}

export interface CreateBusinessForUserInput {
	userId: string;
	name: string;
	description: string;
	whatsapp: string;
	openingHours: string;
}

export interface UpdateBusinessInput {
	name?: string;
	description?: string;
	whatsapp?: string;
	openingHours?: string;
}

export function createDefaultWeeklySchedule(): DaySchedule[] {
	return [
		{
			day: 'mon',
			label: 'Lunes',
			shortLabel: 'Lun',
			enabled: true,
			blocks: [{ open: '09:00', close: '18:00' }]
		},
		{
			day: 'tue',
			label: 'Martes',
			shortLabel: 'Mar',
			enabled: true,
			blocks: [{ open: '09:00', close: '18:00' }]
		},
		{
			day: 'wed',
			label: 'Miércoles',
			shortLabel: 'Mié',
			enabled: true,
			blocks: [{ open: '09:00', close: '18:00' }]
		},
		{
			day: 'thu',
			label: 'Jueves',
			shortLabel: 'Jue',
			enabled: true,
			blocks: [{ open: '09:00', close: '18:00' }]
		},
		{
			day: 'fri',
			label: 'Viernes',
			shortLabel: 'Vie',
			enabled: true,
			blocks: [{ open: '09:00', close: '18:00' }]
		},
		{
			day: 'sat',
			label: 'Sábado',
			shortLabel: 'Sáb',
			enabled: true,
			blocks: [{ open: '09:00', close: '13:00' }]
		},
		{
			day: 'sun',
			label: 'Domingo',
			shortLabel: 'Dom',
			enabled: false,
			blocks: [{ open: '09:00', close: '13:00' }]
		}
	];
}

export function validateWeeklySchedule(schedule: DaySchedule[]): string | null {
	const enabledDays = schedule.filter((d) => d.enabled);
	if (enabledDays.length === 0) {
		return 'Debes habilitar al menos un día de atención.';
	}

	for (const day of enabledDays) {
		if (!day.blocks || day.blocks.length === 0) {
			return `El día ${day.label} está abierto pero no tiene bloques horarios configurados.`;
		}
		for (let i = 0; i < day.blocks.length; i++) {
			const block = day.blocks[i];
			if (!block.open || !block.close) {
				return `Completa la hora de inicio y fin en el bloque #${i + 1} de ${day.label}.`;
			}
			if (block.open >= block.close) {
				return `En ${day.label} (bloque #${i + 1}), la hora de cierre (${block.close}) debe ser posterior a la de apertura (${block.open}).`;
			}
		}
	}

	return null;
}

export function parseWeeklySchedule(raw: string): DaySchedule[] | null {
	if (!raw || !raw.trim().startsWith('[')) return null;
	try {
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) return parsed as DaySchedule[];
		return null;
	} catch {
		return null;
	}
}

export function formatWeeklyScheduleSummary(raw: string): string {
	const schedule = parseWeeklySchedule(raw);
	if (!schedule) return raw;

	const enabled = schedule.filter((d) => d.enabled && d.blocks.length > 0);
	if (enabled.length === 0) return 'Sin horarios configurados';

	return enabled
		.map((d) => {
			const ranges = d.blocks.map((b) => `${b.open}–${b.close}`).join(', ');
			return `${d.shortLabel}: ${ranges}`;
		})
		.join(' · ');
}

const JS_DAY_TO_KEY: Record<number, DayKey> = {
	0: 'sun',
	1: 'mon',
	2: 'tue',
	3: 'wed',
	4: 'thu',
	5: 'fri',
	6: 'sat'
};

export function getBusinessOpenStatus(
	rawOpeningHours: string,
	now: Date = new Date()
): {
	isOpen: boolean;
	todayKey: DayKey;
	activeBlock: TimeBlock | null;
} {
	const todayKey = JS_DAY_TO_KEY[now.getDay()] ?? 'mon';
	const schedule = parseWeeklySchedule(rawOpeningHours);
	if (!schedule) {
		return { isOpen: false, todayKey, activeBlock: null };
	}

	const todaySchedule = schedule.find((d) => d.day === todayKey);
	if (!todaySchedule || !todaySchedule.enabled || todaySchedule.blocks.length === 0) {
		return { isOpen: false, todayKey, activeBlock: null };
	}

	const hh = String(now.getHours()).padStart(2, '0');
	const mm = String(now.getMinutes()).padStart(2, '0');
	const currentHm = `${hh}:${mm}`;

	for (const block of todaySchedule.blocks) {
		if (block.open && block.close && currentHm >= block.open && currentHm <= block.close) {
			return { isOpen: true, todayKey, activeBlock: block };
		}
	}

	return { isOpen: false, todayKey, activeBlock: null };
}
