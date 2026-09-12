import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "reflect-metadata";
import type { DataSource } from "typeorm";

/**
 * `service:save`: crear o corregir a mano el próximo service de un vehículo.
 *
 * Es el endpoint que sostiene la invariante del sistema —**un solo recordatorio
 * vigente por vehículo**— y el que la rompía: con un `id` tomaba ese
 * recordatorio sin mirar de qué auto era ni si había otro activo.
 *
 * Que la invariante ya se rompió una vez está en el historial: la migración
 * `SimplifyServiceType` tuvo que recorrer la base real colapsando los múltiples
 * recordatorios activos por vehículo que había.
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
  dialog: {
    showErrorBox: vi.fn(),
    showMessageBox: vi.fn(async () => ({ response: 1 })),
  },
  shell: { showItemInFolder: vi.fn(), openPath: vi.fn() },
}));

let dir: string;
let ds: DataSource;

/** Ver el comentario de `PLAZO` en `applyPendingMigrations.test.ts`. */
const PLAZO = 60_000;

const invocar = async <T>(canal: string, ...args: unknown[]): Promise<T> => {
  const handler = stub.handlers.get(canal);
  if (!handler) throw new Error(`No se registró el canal ${canal}`);
  return (await handler({}, ...args)) as T;
};

type Respuesta = { status: string; message: string; result?: unknown };

/** Arranca una base al día y deja los endpoints de service registrados. */
const preparar = async () => {
  process.env.MECANICA_DATA_DIR = dir;
  stub.dir = dir;
  stub.handlers.clear();
  vi.resetModules();

  const dataSource = await import("../dataSource");
  const cache = await import("../dashboardCache");
  await dataSource.AppDataSource.initialize();
  await dataSource.applyPendingMigrations();
  await import("./service.endpoints");

  ds = dataSource.AppDataSource;
  return { ...dataSource, ...cache };
};

/** Un vehículo con titular, insertado directo para no depender de otro endpoint. */
const crearAuto = async (patente: string, sufijo: string) => {
  await ds.query(
    `INSERT INTO client (id, fullname, phone, address, city, isActive, createdAt)
     VALUES (?, ?, ?, 'Calle 1', 'Córdoba', 1, '2026-01-01 09:00:00')`,
    [`cli-${sufijo}`, `Titular ${sufijo}`, `35100000${sufijo}`]
  );
  await ds.query(
    `INSERT INTO car (id, licensePlate, model, brand, year, kilometers, kmHistory, createdAt, updatedAt, ownerId)
     VALUES (?, ?, 'GOL', 'Volkswagen', 2016, 90000, '[]', '2026-01-01 09:00:00', '2026-01-01 09:00:00', ?)`,
    [`auto-${sufijo}`, patente, `cli-${sufijo}`]
  );
  return `auto-${sufijo}`;
};

/** Recordatorios de un vehículo, con su estado. */
const recordatorios = async (carId: string) =>
  (await ds.query(
    "SELECT id, status FROM service_reminder WHERE carId = ? ORDER BY id",
    [carId]
  )) as { id: string; status: string }[];

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-service-"));
});

afterEach(async () => {
  if (ds?.isInitialized) await ds.destroy();
  delete process.env.MECANICA_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("service:save", () => {
  it(
    "avisa que cambiaron los datos, para que el badge y el dashboard no queden viejos",
    async () => {
      const { onDashboardStatsInvalidated } = await preparar();
      await crearAuto("AB123CD", "1");

      // Es la misma señal por la que el proceso principal manda `data-changed`
      // al renderer: si no se emite, el contador de la barra sigue mostrando el
      // número de antes hasta que otra cosa escriba.
      const avisos = vi.fn();
      onDashboardStatsInvalidated(avisos);

      const res = await invocar<Respuesta>("service:save", {
        licensePlate: "AB123CD",
        dueKm: 100000,
        dueDate: null,
      });

      expect(res.status).toBe("success");
      expect(avisos).toHaveBeenCalled();
    },
    PLAZO
  );

  it(
    "sin id reutiliza el recordatorio vigente en vez de crear otro",
    async () => {
      await preparar();
      const carId = await crearAuto("AB123CD", "1");

      await invocar<Respuesta>("service:save", {
        licensePlate: "AB123CD",
        dueKm: 100000,
      });
      await invocar<Respuesta>("service:save", {
        licensePlate: "AB123CD",
        dueKm: 110000,
      });

      expect(await recordatorios(carId)).toHaveLength(1);
    },
    PLAZO
  );

  it(
    "rechaza los datos que no alcanzan para programar nada",
    async () => {
      await preparar();
      await crearAuto("AB123CD", "1");

      const sinCriterio = await invocar<Respuesta>("service:save", {
        licensePlate: "AB123CD",
        dueDate: null,
        dueKm: null,
      });
      expect(sinCriterio.status).toBe("failed");

      const fechaMala = await invocar<Respuesta>("service:save", {
        licensePlate: "AB123CD",
        dueDate: "no es una fecha",
      });
      expect(fechaMala.status).toBe("failed");

      const kmNegativo = await invocar<Respuesta>("service:save", {
        licensePlate: "AB123CD",
        dueKm: -5,
      });
      expect(kmNegativo.status).toBe("failed");

      const autoInexistente = await invocar<Respuesta>("service:save", {
        licensePlate: "ZZ999ZZ",
        dueKm: 100000,
      });
      expect(autoInexistente.status).toBe("failed");
    },
    PLAZO
  );
});
