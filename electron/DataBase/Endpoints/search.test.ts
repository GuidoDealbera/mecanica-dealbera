import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "reflect-metadata";
import type { DataSource } from "typeorm";

/**
 * Las búsquedas y los comodines de `LIKE`.
 *
 * `%` y `_` son comodines para SQL, así que un término que los contenga hay que
 * escaparlo o los resultados salen mal. `global:search` no escapaba nada
 * —buscar `_` traía todo— y `client:search` reimplementaba el escape a mano en
 * vez de usar el helper que ya existe.
 *
 * No era inyección: las consultas están parametrizadas. Era peor de detectar,
 * porque el resultado se ve plausible.
 */

const stub = vi.hoisted(() => ({
  dir: "",
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
}));

vi.mock("electron", () => ({
  app: { getPath: () => stub.dir, getVersion: () => "2.0.0" },
  ipcMain: {
    handle: (canal: string, handler: (...args: unknown[]) => unknown) => {
      stub.handlers.set(canal, handler);
    },
  },
  dialog: { showErrorBox: vi.fn() },
  shell: { showItemInFolder: vi.fn(), openPath: vi.fn() },
}));

let dir: string;
let ds: DataSource;

const invocar = async <T>(canal: string, ...args: unknown[]): Promise<T> => {
  const handler = stub.handlers.get(canal);
  if (!handler) throw new Error(`No se registró el canal ${canal}`);
  return (await handler({}, ...args)) as T;
};

type Global = {
  cars: { licensePlate: string; model: string }[];
  clients: { fullname: string }[];
};

const crearCliente = async (id: string, fullname: string, phone: string) => {
  await ds.query(
    `INSERT INTO client (id, fullname, phone, address, city, isActive, createdAt)
     VALUES (?, ?, ?, 'Calle 1', 'Córdoba', 1, '2026-01-01 09:00:00')`,
    [id, fullname, phone]
  );
};

const crearAuto = async (id: string, patente: string, modelo: string) => {
  await ds.query(
    `INSERT INTO car (id, licensePlate, model, brand, year, kilometers, kmHistory, createdAt, updatedAt, ownerId)
     VALUES (?, ?, ?, 'Volkswagen', 2016, 90000, '[]', '2026-01-01 09:00:00', '2026-01-01 09:00:00', 'cli-1')`,
    [id, patente, modelo]
  );
};

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-busqueda-"));
  process.env.MECANICA_DATA_DIR = dir;
  stub.dir = dir;
  stub.handlers.clear();
  vi.resetModules();

  const dataSource = await import("../dataSource");
  await dataSource.AppDataSource.initialize();
  await dataSource.applyPendingMigrations();
  await import("./car.search.endpoints");
  await import("./client.endpoints");
  ds = dataSource.AppDataSource;

  await crearCliente("cli-1", "Ana Gómez", "3515123456");
  await crearCliente("cli-2", "Carlos 100% Bravo", "3515123457");
  await crearAuto("auto-1", "AB123CD", "GOL");
  await crearAuto("auto-2", "XY456ZW", "PALIO");
});

afterEach(async () => {
  if (ds?.isInitialized) await ds.destroy();
  delete process.env.MECANICA_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("global:search", () => {
  it("el guión bajo es texto, no un comodín", async () => {
    // `_` en SQL significa "un carácter cualquiera", así que sin escapar esto
    // devolvía todos los vehículos y todos los clientes.
    const res = await invocar<Global>("global:search", "__");

    expect(res.cars).toHaveLength(0);
    expect(res.clients).toHaveLength(0);
  });

  it("el porcentaje es texto, no un comodín", async () => {
    const res = await invocar<Global>("global:search", "%%");
    expect(res.cars).toHaveLength(0);
    expect(res.clients).toHaveLength(0);

    // Y un porcentaje que sí está en el dato se encuentra.
    const literal = await invocar<Global>("global:search", "100%");
    expect(literal.clients.map((c) => c.fullname)).toEqual([
      "Carlos 100% Bravo",
    ]);
  });

  it("sigue encontrando lo que tiene que encontrar", async () => {
    const porPatente = await invocar<Global>("global:search", "AB123");
    expect(porPatente.cars.map((c) => c.licensePlate)).toEqual(["AB123CD"]);

    const porModelo = await invocar<Global>("global:search", "GOL");
    expect(porModelo.cars.map((c) => c.model)).toEqual(["GOL"]);

    const porNombre = await invocar<Global>("global:search", "Ana");
    expect(porNombre.clients.map((c) => c.fullname)).toEqual(["Ana Gómez"]);

    const porTelefono = await invocar<Global>("global:search", "3515123456");
    expect(porTelefono.clients).toHaveLength(1);
  });

  it("un término de menos de dos caracteres o que no es texto no consulta nada", async () => {
    expect((await invocar<Global>("global:search", "a")).cars).toHaveLength(0);
    // El renderer no debería mandar esto, pero un canal IPC recibe lo que le
    // manden y antes esto reventaba con "cannot read properties of undefined".
    expect(
      (await invocar<Global>("global:search", undefined)).cars
    ).toHaveLength(0);
  });
});

describe("client:search", () => {
  it("escapa los comodines igual que el resto", async () => {
    type Res = { result: { fullname: string }[] };

    const comodin = await invocar<Res>("client:search", "__");
    expect(comodin.result).toHaveLength(0);

    const literal = await invocar<Res>("client:search", "100%");
    expect(literal.result.map((c) => c.fullname)).toEqual([
      "Carlos 100% Bravo",
    ]);

    const normal = await invocar<Res>("client:search", "Ana");
    expect(normal.result.map((c) => c.fullname)).toEqual(["Ana Gómez"]);
  });
});
