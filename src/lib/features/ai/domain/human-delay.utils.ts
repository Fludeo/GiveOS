/**
 * Utilidades para simular tiempos de respuesta humanos en el bot conversacional.
 * Permite esperar entre 7 y 10 segundos antes de comenzar a responder,
 * acumulando los mensajes que el usuario envíe de forma consecutiva.
 */

/**
 * Genera y devuelve un número de segundos aleatorio entre min y max (por defecto 7 y 10 segundos).
 *
 * @param min Segundos mínimos (por defecto 7)
 * @param max Segundos máximos (por defecto 10)
 * @returns Número en segundos con precisión de dos decimales (ej. 7.35, 8.62, 9.40)
 */
export function getHumanDelaySeconds(min = 7, max = 10): number {
	const raw = Math.random() * (max - min) + min;
	return Number(raw.toFixed(2));
}

/**
 * Devuelve el tiempo de espera aleatorio en milisegundos (entre min*1000 y max*1000 ms).
 *
 * @param min Segundos mínimos (por defecto 7)
 * @param max Segundos máximos (por defecto 10)
 * @returns Milisegundos enteros (ej. 7350, 8620, 9400)
 */
export function getHumanDelayMs(min = 7, max = 10): number {
	return Math.round(getHumanDelaySeconds(min, max) * 1000);
}

/**
 * Pausa asíncrona que espera una cantidad aleatoria de segundos entre min y max.
 * Devuelve la cantidad exacta de segundos que se esperó.
 *
 * @param min Segundos mínimos (por defecto 7)
 * @param max Segundos máximos (por defecto 10)
 * @returns Promesa que resuelve con los segundos esperados
 */
export async function waitHumanDelay(min = 7, max = 10): Promise<number> {
	const delayMs = getHumanDelayMs(min, max);
	await new Promise((resolve) => setTimeout(resolve, delayMs));
	return Number((delayMs / 1000).toFixed(2));
}
