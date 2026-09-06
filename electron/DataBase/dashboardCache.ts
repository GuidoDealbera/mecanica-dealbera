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
 * `invalidateDashboardStatsCache()`.
 */
let cachedStats: DashboardStats | null = null;

export function getDashboardStatsCache(): DashboardStats | null {
  return cachedStats;
}

export function setDashboardStatsCache(stats: DashboardStats): void {
  cachedStats = stats;
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
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Avisar es best-effort: que falle un listener no puede hacer fallar la
      // mutación que acaba de guardarse.
    }
  }
}
