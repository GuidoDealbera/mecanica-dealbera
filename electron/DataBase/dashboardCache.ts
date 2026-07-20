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

export function invalidateDashboardStatsCache(): void {
  cachedStats = null;
}
