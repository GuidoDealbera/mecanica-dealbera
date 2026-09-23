import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "reflect-metadata";
import type { DataSource } from "typeorm";

/**
 * Un `null` en un campo de una edición.
 *
 * Los DTO de edición marcan todo con `@IsOptional()` —se aplica sólo lo que
 * viene—, y class-validator saltea esa validación con `undefined` **y también
 * con `null`**. El `null` llegaba entonces hasta el `save` contra una columna
 * `NOT NULL`: en `client:update`, que no ataja el error, al renderer le llegaba
 * el mensaje crudo de SQLite; en los otros dos, un "Error al actualizar"
 * genérico. Y en `job.parts`, que sí admitía `NULL`, se guardaba en silencio
 * una segunda forma de "sin repuestos".
 *
 * `contratoDeEntrada.test.ts` no lo veía porque llama con identificadores que
 * no existen, y así nunca se llega al `save`. Acá hay un vehículo, un trabajo y
 * un cliente de verdad.
 */

const stub = vi.hoisted(() => ({
  dir: "",
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
}));

vi.mock("electron", () => ({
  app: { getPath: () => stub.dir, getVersion: () => "2.1.0", isPackaged: true },
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

type Respuesta = { status: string; message: string };

const invocar = async (canal: string, ...args: unknown[]) => {
  const handler = stub.handlers.get(canal);
  if (!handler) throw new Error(`No se registró el canal ${canal}`);
  return (await handler({}, ...args)) as Respuesta;
};

const fila = async (tabla: string) =>
  (
    (await ds.query(`SELECT * FROM "${tabla}"`)) as Record<string, unknown>[]
  )[0];

let autoId: string;
let trabajoId: string;
let clienteId: string;

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-nulos-"));
  process.env.MECANICA_DATA_DIR = dir;
  stub.dir = dir;
  stub.handlers.clear();
  vi.resetModules();

  const dataSource = await import("../dataSource");
  await dataSource.AppDataSource.initialize();
  await dataSource.applyPendingMigrations();
  await import("./car.crud.endpoints");
  await import("./car.jobs.endpoints");
  await import("./client.endpoints");
  ds = dataSource.AppDataSource;

  await invocar("car:create", {
    licensePlate: "AB123CD",
    brand: "Volkswagen",
    model: "Gol",
    year: 2016,
    kilometers: 90000,
    owner: {
      fullname: "Ana Gómez",
      phone: "3515123456",
      address: "Calle 1",
      city: "Córdoba",
    },
  });
  await invocar("car:add-job", "AB123CD", {
    price: 50000,
    description: "Cambio de aceite",
    isThirdParty: false,
    status: "pending",
    parts: [{ name: "Filtro", price: 12000 }],
  });
  autoId = String((await fila("car")).id);
  trabajoId = String((await fila("job")).id);
  clienteId = String((await fila("client")).id);
});

afterEach(async () => {
  if (ds?.isInitialized) await ds.destroy();
  delete process.env.MECANICA_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * Lo que tiene que pasar con un `null` donde la columna no lo admite: se
 * contesta que no, en castellano, y no se toca nada.
 */
const rechaza = async (
  tabla: string,
  llamar: () => Promise<Respuesta>,
  campo: string
) => {
  const antes = await fila(tabla);
  const res = await llamar();

  expect(res.status, campo).toBe("failed");
  // Ni el mensaje de SQLite, ni el de class-validator —que viene en inglés—,
  // ni el genérico: el que dice que el campo no puede quedar vacío.
  expect(res.message, campo).not.toMatch(/constraint|sqlite|must be|should/i);
  expect(res.message, campo).not.toMatch(/^Error al actualizar/);
  expect(res.message, campo).toMatch(/vac[íi][oa]|falta|nulo/i);
  expect(await fila(tabla), campo).toEqual(antes);
};

describe("un null no se guarda", () => {
  it.each(["brand", "model", "year", "kilometers"])(
    "car:update con %s en null",
    async (campo) => {
      await rechaza(
        "car",
        () => invocar("car:update", autoId, { [campo]: null }),
        campo
      );
    }
  );

  it.each([
    "status",
    "description",
    "isThirdParty",
    "price",
    "parts",
    "isService",
  ])("car:update-job con %s en null", async (campo) => {
    await rechaza(
      "job",
      () => invocar("car:update-job", "AB123CD", trabajoId, { [campo]: null }),
      campo
    );
  });

  it.each(["fullname", "phone", "address", "city"])(
    "client:update con %s en null",
    async (campo) => {
      await rechaza(
        "client",
        () => invocar("client:update", { id: clienteId, [campo]: null }),
        campo
      );
    }
  );
});

describe("donde null significa algo, sigue valiendo", () => {
  it("en los intervalos de service es 'usar los generales'", async () => {
    await invocar("car:update", autoId, { serviceIntervalMonths: 6 });

    const res = await invocar("car:update", autoId, {
      serviceIntervalMonths: null,
    });

    expect(res.status).toBe("success");
    expect((await fila("car")).serviceIntervalMonths).toBeNull();
  });

  it("y omitir un campo sigue siendo 'no lo toques'", async () => {
    const res = await invocar("car:update-job", "AB123CD", trabajoId, {
      price: 60000,
    });

    expect(res.status).toBe("success");
    const trabajo = await fila("job");
    expect(trabajo.price).toBe(60000);
    expect(trabajo.description).toBe("Cambio de aceite");
    expect(JSON.parse(String(trabajo.parts))).toEqual([
      { name: "Filtro", price: 12000 },
    ]);
  });
});
