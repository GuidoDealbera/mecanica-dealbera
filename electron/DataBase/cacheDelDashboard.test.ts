import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardStats } from "../../src/Types/types";

/**
 * Cuándo deja de servir lo que está cacheado.
 *
 * La caché se invalidaba **sólo ante escrituras**, y estas estadísticas no
 * dependen sólo de los datos: `computeDashboardStats` usa `new Date()` para el
 * mes en curso y los últimos seis meses. Un taller que deja la aplicación
 * abierta —lo normal— cruzaba la medianoche del 31 de diciembre y seguía viendo
 * diciembre como mes en curso hasta que alguien cargara algo.
 */

const stats = { totalCars: 3 } as unknown as DashboardStats;

let cache: typeof import("./dashboardCache");

beforeEach(async () => {
  vi.resetModules();
  cache = await import("./dashboardCache");
});

describe("la caché de las estadísticas", () => {
  it("sirve dentro del mismo día", () => {
    const alaManana = new Date("2026-12-31T09:00:00");
    const alaTarde = new Date("2026-12-31T18:30:00");

    cache.setDashboardStatsCache(stats, alaManana);

    expect(cache.getDashboardStatsCache(alaTarde)).toBe(stats);
  });

  it("no sirve después de medianoche", () => {
    // El caso concreto del plan: el 31 de diciembre a la noche pasa a ser 1° de
    // enero y el mes en curso cambia.
    const nocheVieja = new Date("2026-12-31T23:59:00");
    const anioNuevo = new Date("2027-01-01T00:01:00");

    cache.setDashboardStatsCache(stats, nocheVieja);

    expect(cache.getDashboardStatsCache(anioNuevo)).toBeNull();
  });

  it("tampoco sirve un día cualquiera después", () => {
    cache.setDashboardStatsCache(stats, new Date("2026-06-10T22:00:00"));
    expect(
      cache.getDashboardStatsCache(new Date("2026-06-11T07:00:00"))
    ).toBeNull();
  });

  it("sigue invalidándose ante una escritura, como antes", () => {
    const ahora = new Date("2026-06-10T10:00:00");
    cache.setDashboardStatsCache(stats, ahora);

    cache.invalidateDashboardStatsCache();

    expect(cache.getDashboardStatsCache(ahora)).toBeNull();
  });

  it("arranca vacía", () => {
    expect(cache.getDashboardStatsCache(new Date())).toBeNull();
  });
});
