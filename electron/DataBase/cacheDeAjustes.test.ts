import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "reflect-metadata";
import type { DataSource } from "typeorm";

/**
 * La configuración de service se lee una vez, no una por fila.
 *
 * `getServiceSettings` hacía un `find` sobre `app_setting` en cada llamada, y en
 * `service:list` se llama una vez directa y **otra por cada recordatorio**,
 * porque `evaluate()` la pide para cada uno: una página de ocho eran nueve
 * consultas a una tabla de cuatro filas. Es configuración que se cambia una vez
 * al año.
 *
 * Que esté cacheada se comprueba por su consecuencia observable: se cambia el
 * valor **por SQL, por detrás**, y la función sigue devolviendo el anterior. Si
 * volviera a la base en cada llamada, vería el cambio.
 */

const stub = vi.hoisted(() => ({
  dir: "",
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
}));

vi.mock("electron", () => ({
  app: { getPath: () => stub.dir, getVersion: () => "2.0.0", isPackaged: true },
  ipcMain: {
    handle: (canal: string, handler: (...args: unknown[]) => unknown) => {
      stub.handlers.set(canal, handler);
    },
  },
  dialog: { showErrorBox: vi.fn(), showMessageBox: vi.fn() },
  shell: { showItemInFolder: vi.fn(), openPath: vi.fn() },
}));

let dir: string;
let ds: DataSource;
let servicio: typeof import("./serviceReminders.service");

/** Cambia un valor sin pasar por `saveServiceSettings`, o sea sin invalidar. */
const escribirPorDetras = (clave: string, valor: string) =>
  ds.query(
    `INSERT INTO app_setting (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [clave, valor]
  );

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-ajustes-"));
  process.env.MECANICA_DATA_DIR = dir;
  stub.dir = dir;
  stub.handlers.clear();
  vi.resetModules();

  const dataSource = await import("./dataSource");
  await dataSource.AppDataSource.initialize();
  await dataSource.applyPendingMigrations();
  servicio = await import("./serviceReminders.service");
  ds = dataSource.AppDataSource;
});

afterEach(async () => {
  if (ds?.isInitialized) await ds.destroy();
  delete process.env.MECANICA_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("la configuración de service", () => {
  it("no vuelve a la base en cada llamada", async () => {
    const primera = await servicio.getServiceSettings(ds.manager);

    await escribirPorDetras("service.intervalMonths", "3");
    const segunda = await servicio.getServiceSettings(ds.manager);

    expect(segunda.intervalMonths).toBe(primera.intervalMonths);
  });

  it("relee después de guardarla", async () => {
    await servicio.getServiceSettings(ds.manager);

    const res = await servicio.saveServiceSettings(
      { intervalMonths: 9 },
      ds.manager
    );

    expect(res.ok).toBe(true);
    // Guardar es el camino normal de cambio: si la caché no se invalidara acá,
    // el usuario guardaría un valor y la aplicación seguiría usando el viejo
    // hasta reiniciar, que es peor que la consulta de más.
    expect((await servicio.getServiceSettings(ds.manager)).intervalMonths).toBe(
      9
    );
  });

  it("relee cuando se la invalida a mano", async () => {
    // Es lo que hace el reemplazo de la base: importar o restaurar deja otra
    // configuración en el archivo.
    await servicio.getServiceSettings(ds.manager);
    await escribirPorDetras("service.soonDays", "45");

    servicio.invalidateServiceSettingsCache();

    expect((await servicio.getServiceSettings(ds.manager)).soonDays).toBe(45);
  });

  it("lo que devuelve no se puede modificar por accidente", async () => {
    // Lo comparten todos los que la piden: un descuido que lo modifique se
    // llevaría puesta la configuración de todo el proceso hasta el reinicio.
    const ajustes = await servicio.getServiceSettings(ds.manager);

    expect(() => {
      (ajustes as { intervalMonths: number }).intervalMonths = 99;
    }).toThrow();
  });
});
