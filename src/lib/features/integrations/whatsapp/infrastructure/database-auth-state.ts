import {
	initAuthCreds,
	BufferJSON,
	proto,
	type AuthenticationCreds,
	type AuthenticationState,
	type SignalDataSet
} from '@whiskeysockets/baileys';
import { eq, inArray } from 'drizzle-orm';
import { getDb } from '#lib/server/db/index';
import { whatsappAuthKeys } from '#lib/server/db/schema';

export async function useDatabaseAuthState(businessId: string): Promise<{
	state: AuthenticationState;
	saveCreds: () => Promise<void>;
	clearSession: () => Promise<void>;
}> {
	const db = getDb();

	const readData = async (key: string): Promise<any> => {
		try {
			const id = `${businessId}:${key}`;
			const row = await db.query.whatsappAuthKeys.findFirst({
				where: eq(whatsappAuthKeys.id, id)
			});
			if (!row) return null;
			return JSON.parse(row.value, BufferJSON.reviver);
		} catch (error) {
			console.error(`[DatabaseAuthState] Error leyendo clave ${key} para ${businessId}:`, error);
			return null;
		}
	};

	const writeData = async (key: string, data: any): Promise<void> => {
		try {
			const id = `${businessId}:${key}`;
			const value = JSON.stringify(data, BufferJSON.replacer);
			await db
				.insert(whatsappAuthKeys)
				.values({
					id,
					businessId,
					key,
					value,
					updatedAt: new Date()
				})
				.onConflictDoUpdate({
					target: whatsappAuthKeys.id,
					set: {
						value,
						updatedAt: new Date()
					}
				});
		} catch (error) {
			console.error(`[DatabaseAuthState] Error escribiendo clave ${key} para ${businessId}:`, error);
		}
	};

	const removeData = async (key: string): Promise<void> => {
		try {
			const id = `${businessId}:${key}`;
			await db.delete(whatsappAuthKeys).where(eq(whatsappAuthKeys.id, id));
		} catch (error) {
			console.error(`[DatabaseAuthState] Error eliminando clave ${key} para ${businessId}:`, error);
		}
	};

	// 1. Cargar o inicializar credenciales principales de autenticación
	const creds: AuthenticationCreds = (await readData('creds')) || initAuthCreds();

	return {
		state: {
			creds,
			keys: {
				get: async (type, ids) => {
					const data: Record<string, any> = {};
					if (ids.length === 0) return data;

					const targetIds = ids.map((id) => `${businessId}:${type}-${id}`);

					try {
						const rows = await db
							.select()
							.from(whatsappAuthKeys)
							.where(inArray(whatsappAuthKeys.id, targetIds));

						const rowMap = new Map(rows.map((r) => [r.key, r.value]));

						for (const id of ids) {
							const key = `${type}-${id}`;
							const raw = rowMap.get(key);
							if (raw) {
								let value = JSON.parse(raw, BufferJSON.reviver);
								if (type === 'app-state-sync-key' && value) {
									value = proto.Message.AppStateSyncKeyData.fromObject(value);
								}
								data[id] = value;
							} else {
								data[id] = null;
							}
						}
					} catch (err) {
						console.error(`[DatabaseAuthState] Error en keys.get (${type}) para ${businessId}:`, err);
					}

					return data;
				},
				set: async (data: SignalDataSet) => {
					const tasks: Promise<void>[] = [];
					for (const category in data) {
						const categoryData = data[category as keyof SignalDataSet];
						if (!categoryData) continue;

						for (const id in categoryData) {
							const value = categoryData[id];
							const key = `${category}-${id}`;
							if (value) {
								tasks.push(writeData(key, value));
							} else {
								tasks.push(removeData(key));
							}
						}
					}
					await Promise.all(tasks);
				}
			}
		},
		saveCreds: async () => {
			await writeData('creds', creds);
		},
		clearSession: async () => {
			try {
				await db.delete(whatsappAuthKeys).where(eq(whatsappAuthKeys.businessId, businessId));
			} catch (err) {
				console.error(`[DatabaseAuthState] Error limpiando sesión de ${businessId}:`, err);
			}
		}
	};
}

/**
 * Verifica si existen credenciales válidas guardadas en la base de datos para este negocio
 */
export async function hasDatabaseAuthSession(businessId: string): Promise<boolean> {
	try {
		const db = getDb();
		const row = await db.query.whatsappAuthKeys.findFirst({
			where: eq(whatsappAuthKeys.id, `${businessId}:creds`)
		});
		return !!row;
	} catch (err) {
		return false;
	}
}

/**
 * Obtiene el número y nombre guardado en las credenciales de la base de datos
 */
export async function getDatabaseSessionPhone(businessId: string): Promise<{
	phone: string | null;
	pushName: string | null;
}> {
	try {
		const db = getDb();
		const row = await db.query.whatsappAuthKeys.findFirst({
			where: eq(whatsappAuthKeys.id, `${businessId}:creds`)
		});
		if (!row) return { phone: null, pushName: null };

		const creds = JSON.parse(row.value, BufferJSON.reviver);
		if (creds?.me?.id) {
			const phone = creds.me.id.split(':')[0].split('@')[0] || null;
			const pushName = creds.me.name || null;
			return { phone, pushName };
		}
	} catch (err) {
		console.error(`[DatabaseAuthState] Error leyendo creds de DB para ${businessId}:`, err);
	}
	return { phone: null, pushName: null };
}

/**
 * Lista todos los IDs de negocio que poseen credenciales guardadas en PostgreSQL
 */
export async function getAllActiveSessionBusinessIds(): Promise<string[]> {
	try {
		const db = getDb();
		const rows = await db
			.select({ businessId: whatsappAuthKeys.businessId })
			.from(whatsappAuthKeys)
			.where(eq(whatsappAuthKeys.key, 'creds'));
		return rows.map((r) => r.businessId);
	} catch (err) {
		console.error('[DatabaseAuthState] Error obteniendo negocios con sesión:', err);
		return [];
	}
}
