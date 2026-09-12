import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "reflect-metadata";
import type { DataSource } from "typeorm";

/**
 * Editar un vehículo.
 *
 * El endpoint recibía `(id, kilometers)` y nada más: marca, modelo y año no se
 * podían corregir desde ningún lado, así que un error de tipeo obligaba a
 * borrar el vehículo —con sus trabajos, su historial de kilometraje y su
 * recordatorio— y volver a cargarlo.
 *
 * Lo que se cuida acá, además de que ahora se puedan editar, son las reglas del
 * kilometraje, que son las que ya existían y no pueden perderse en el camino:
 * no baja, y sólo deja un punto en el historial cuando cambia de verdad.
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

type Respuesta = { status: string; message: string; result?: unknown };

const invocar = async (canal: string, ...args: unknown[]) => {
  const handler = stub.handlers.get(canal);
  if (!handler) throw new Error(`No se registró el canal ${canal}`);
  return (await handler({}, ...args)) as Respuesta;
};

const auto = async () =>
  (
    (await ds.query(
      "SELECT brand, model, year, kilometers, kmHistory FROM car WHERE id = 'auto-1'"
    )) as {
      brand: string;
      model: string;
      year: number;
      kilometers: number;
      kmHistory: string;
    }[]
  )[0];

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-editar-"));
  process.env.MECANICA_DATA_DIR = dir;
  stub.dir = dir;
  stub.handlers.clear();
  vi.resetModules();

  const dataSource = await import("../dataSource");
  await dataSource.AppDataSource.initialize();
  await dataSource.applyPendingMigrations();
  await import("./car.crud.endpoints");
  ds = dataSource.AppDataSource;

  await ds.query(
    `INSERT INTO client (id, fullname, phone, address, city, isActive, createdAt)
     VALUES ('cli-1', 'Ana Gómez', '3515123456', 'Calle 1', 'Córdoba', 1, '2026-01-01 09:00:00')`
  );
  await ds.query(
    `INSERT INTO car (id, licensePlate, model, brand, year, kilometers, kmHistory, createdAt, updatedAt, ownerId)
     VALUES ('auto-1', 'AB123CD', 'GOL', 'Volkswagen', 2016, 90000,
             '[{"km":90000,"date":"2026-01-01T09:00:00.000Z"}]',
             '2026-01-01 09:00:00', '2026-01-01 09:00:00', 'cli-1')`
  );
});

afterEach(async () => {
  if (ds?.isInitialized) await ds.destroy();
  delete process.env.MECANICA_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("car:update", () => {
  it("corrige marca, modelo y año", async () => {
    const res = await invocar("car:update", "auto-1", {
      brand: "Fiat",
      model: "palio",
      year: 2015,
    });

    expect(res.status).toBe("success");
    const guardado = await auto();
    expect(guardado.brand).toBe("Fiat");
    // El modelo se guarda en mayúsculas: lo normaliza la entidad.
    expect(guardado.model).toBe("PALIO");
    expect(guardado.year).toBe(2015);
  });

  it("aplica sólo lo que viene", async () => {
    await invocar("car:update", "auto-1", { model: "Senda" });

    const guardado = await auto();
    expect(guardado.model).toBe("SENDA");
    expect(guardado.brand).toBe("Volkswagen");
    expect(guardado.year).toBe(2016);
    expect(guardado.kilometers).toBe(90000);
  });

  it("rechaza una marca que no existe y un año imposible", async () => {
    const marca = await invocar("car:update", "auto-1", {
      brand: "Marca Inventada",
    });
    expect(marca.status).toBe("failed");

    const futuro = await invocar("car:update", "auto-1", {
      year: new Date().getFullYear() + 1,
    });
    expect(futuro.status).toBe("failed");

    const antiguo = await invocar("car:update", "auto-1", { year: 12 });
    expect(antiguo.status).toBe("failed");

    const vacio = await invocar("car:update", "auto-1", { model: "   " });
    expect(vacio.status).toBe("failed");

    const guardado = await auto();
    expect(guardado.brand).toBe("Volkswagen");
    expect(guardado.year).toBe(2016);
    expect(guardado.model).toBe("GOL");
  });

  it("no deja bajar el kilometraje", async () => {
    const res = await invocar("car:update", "auto-1", { kilometers: 80000 });

    expect(res.status).toBe("failed");
    expect(res.message).toMatch(/bajar/i);
    expect((await auto()).kilometers).toBe(90000);
  });

  it("registra un punto de historial sólo cuando el kilometraje cambia", async () => {
    // El formulario manda el kilometraje siempre, incluso cuando se editó otra
    // cosa. Sin este corte el historial se llenaba de puntos repetidos: tramos
    // planos en el gráfico y eventos duplicados en la ficha.
    await invocar("car:update", "auto-1", {
      kilometers: 90000,
      model: "Senda",
    });
    expect(JSON.parse((await auto()).kmHistory)).toHaveLength(1);

    await invocar("car:update", "auto-1", { kilometers: 95000 });
    const historial = JSON.parse((await auto()).kmHistory);
    expect(historial).toHaveLength(2);
    expect(historial[1].km).toBe(95000);
  });

  it("rechaza un kilometraje que no es un entero", async () => {
    for (const kilometers of ["muchos", -1, 1234.5, null]) {
      const res = await invocar("car:update", "auto-1", { kilometers });
      expect(res.status, JSON.stringify(kilometers)).toBe("failed");
    }
    expect((await auto()).kilometers).toBe(90000);
  });

  it("no toca la patente aunque se la manden", async () => {
    // Es la identidad del vehículo: la usan las rutas, los recordatorios y los
    // documentos ya emitidos. `whitelist` la descarta por no estar en el DTO.
    const res = await invocar("car:update", "auto-1", {
      licensePlate: "ZZ999ZZ",
      model: "Senda",
    });

    expect(res.status).toBe("success");
    const [fila] = (await ds.query(
      "SELECT licensePlate FROM car WHERE id = 'auto-1'"
    )) as { licensePlate: string }[];
    expect(fila.licensePlate).toBe("AB123CD");
  });

  it("avisa si el vehículo no existe", async () => {
    const res = await invocar("car:update", "no-existe", { model: "X" });
    expect(res.status).toBe("failed");
  });
});
