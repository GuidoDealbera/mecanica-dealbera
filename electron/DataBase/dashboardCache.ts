import type { DashboardStats } from "../../src/Types/types";

/**
 * Caché en memoria de las estadísticas del dashboard.
 *
 * `dashboard:get-stats` recalcula recorriendo todos los autos y sus trabajos:
 * es una operación costosa. Como los datos solo cambian por mutaciones de esta
 * misma app, se cachea el resultado y se invalida ante **cualquier escritura**
 * (alta/baja/edición de autos, clientes o trabajos, e import de backup). Así el
 * dashboard queda siempre fresco sin recalcular en cada visita.
 *
 * Invariante: toda mutación exitosa que pueda afectar las estadísticas llama a
 * `invalidateDashboardStatsCache()`. Y como además dependen de la fecha, lo
 * cacheado sólo vale dentro del mismo día calendario: ver `getDashboardStatsCache`.
 */
let cachedStats: DashboardStats | null = null;
let cachedOn: Date | null = null;

/** El día calendario de una fecha, como texto comparable. */
const dia = (fecha: Date): string =>
  `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;

/**
 * Lo cacheado, si sigue sirviendo.
 *
 * La invalidación por escritura no alcanzaba, porque estas estadísticas no
 * dependen sólo de los datos: `computeDashboardStats` usa `new Date()` para el
 * mes en curso y para los últimos seis meses. Un taller que deja la aplicación
 * abierta —lo normal— cruzaba la medianoche del 31 de diciembre y **seguía
 * viendo diciembre como mes en curso**, con su facturación y su "+3 este mes",
 * hasta que alguien cargara algo.
 *
 * Se compara el día calendario y no un plazo en minutos: lo que invalida el
 * cálculo no es que haya pasado tiempo sino que haya cambiado la fecha, y un
 * plazo fijo puede tanto vencer de más como cruzar la medianoche sin enterarse.
 */
export function getDashboardStatsCache(
  now: Date = new Date()
): DashboardStats | null {
  if (!cachedStats || !cachedOn) return null;
  if (dia(cachedOn) !== dia(now)) return null;
  return cachedStats;
}

export function setDashboardStatsCache(
  stats: DashboardStats,
  now: Date = new Date()
): void {
  cachedStats = stats;
  cachedOn = now;
}

/**
 * Se avisa cada vez que se invalida la caché.
 *
 * Invalidar la caché es exactamente la señal de "algo cambió en los datos", y ya
 * está puesta en cada mutación: en vez de agregar un aviso nuevo en cada
 * endpoint —que alguien va a olvidarse de poner— se engancha acá.
 *
 * El listener lo registra `main.ts`, que es quien tiene la ventana a la que
 * avisarle. Este módulo no importa Electron: sigue siendo lógica de dominio.
 */
type CacheListener = () => void;

const listeners = new Set<CacheListener>();

export function onDashboardStatsInvalidated(listener: CacheListener): void {
  listeners.add(listener);
}

export function invalidateDashboardStatsCache(): void {
  cachedStats = null;
  cachedOn = null;
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Avisar es best-effort: que falle un listener no puede hacer fallar la
      // mutación que acaba de guardarse.
    }
  }
}
