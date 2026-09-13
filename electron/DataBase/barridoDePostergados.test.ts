import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "reflect-metadata";
import type { DataSource } from "typeorm";

/**
 * Devolver a la bandeja los recordatorios postergados cuyo plazo venció.
 *
 * Esto corría **al principio de cada lectura**: `service:list`, `service:by-car`
 * y `countDueReminders` —y a este último lo llaman el badge de la barra y la
 * notificación de arranque—. O sea que listar recordatorios escribía en la
 * base, casi siempre sin ninguna fila que tocar. Una lectura que escribe toma el
 * bloqueo de escritura, invalida páginas y ensucia el archivo.
 *
 * Ahora lo lanza el proceso principal al arrancar y cada hora. Lo que se fija
 * acá son las dos mitades: que el barrido siga haciendo su trabajo, y que leer
 * ya no escriba.
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

const invocar = async <T>(canal: string, ...args: unknown[]): Promise<T> => {
  const handler = stub.handlers.get(canal);
  if (!handler) throw new Error(`No se registró el canal ${canal}`);
  return (await handler({}, ...args)) as T;
};

const AYER = "2020-01-01 09:00:00";
const MANANA = "2099-01-01 09:00:00";

const insertar = (id: string, estado: string, snoozedUntil: string | null) =>
  ds.query(
    `INSERT INTO service_reminder (id, carId, status, dueDate, dueKm, snoozedUntil, contactedAt, notes, createdAt, updatedAt)
     VALUES (?, 'auto-1', ?, '2026-06-01 00:00:00', NULL, ?, NULL, '', '2026-01-01 09:00:00', '2026-01-01 09:00:00')`,
    [id, estado, snoozedUntil]
  );

const estados = async () =>
  Object.fromEntries(
    (
      (await ds.query(
        "SELECT id, status FROM service_reminder ORDER BY id"
      )) as { id: string; status: string }[]
    ).map((f) => [f.id, f.status])
  );

/** Foto de lo escribible: sirve para probar que una lectura no escribió. */
const foto = async () =>
  JSON.stringify(
    await ds.query(
      "SELECT id, status, snoozedUntil, updatedAt FROM service_reminder ORDER BY id"
    )
  );

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-barrido-"));
  process.env.MECANICA_DATA_DIR = dir;
  stub.dir = dir;
  stub.handlers.clear();
  vi.resetModules();

  const dataSource = await import("./dataSource");
  await dataSource.AppDataSource.initialize();
  await dataSource.applyPendingMigrations();
  await import("./Endpoints/service.endpoints");
  servicio = await import("./serviceReminders.service");
  ds = dataSource.AppDataSource;

  await ds.query(
    `INSERT INTO client (id, fullname, phone, address, city, isActive, createdAt)
     VALUES ('cli-1','Ana Gómez','3515123456','Calle 1','Córdoba',1,'2026-01-01 09:00:00')`
  );
  await ds.query(
    `INSERT INTO car (id, licensePlate, model, brand, year, kilometers, kmHistory, createdAt, updatedAt, ownerId)
     VALUES ('auto-1','AB123CD','GOL','Volkswagen',2016,90000,'[]','2026-01-01 09:00:00','2026-01-01 09:00:00','cli-1')`
  );
});

afterEach(async () => {
  if (ds?.isInitialized) await ds.destroy();
  delete process.env.MECANICA_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("el barrido de postergados", () => {
  it("devuelve el que ya venció y deja el que todavía no", async () => {
    await insertar("vencido", "snoozed", AYER);

    await servicio.reactivateExpiredSnoozes(ds.manager);

    expect(await estados()).toEqual({ vencido: "pending" });
    // Y le limpia la fecha: si quedara, seguiría pareciendo postergado.
    const [fila] = (await ds.query(
      "SELECT snoozedUntil FROM service_reminder WHERE id = 'vencido'"
    )) as { snoozedUntil: string | null }[];
    expect(fila.snoozedUntil).toBeNull();
  });

  it("no toca el postergado con plazo por delante", async () => {
    await insertar("futuro", "snoozed", MANANA);

    await servicio.reactivateExpiredSnoozes(ds.manager);

    expect(await estados()).toEqual({ futuro: "snoozed" });
  });

  it("normaliza el postergado sin fecha, que no tiene forma de volver solo", async () => {
    // Era la segunda de las dos sentencias. Ahora es el otro lado del mismo
    // `OR`, así que hay que comprobar que no se perdió en la unificación.
    await insertar("sinFecha", "snoozed", null);

    await servicio.reactivateExpiredSnoozes(ds.manager);

    expect(await estados()).toEqual({ sinFecha: "pending" });
  });

  it("no toca los que no están postergados", async () => {
    await insertar("hecho", "done", null);
    await insertar("descartado", "dismissed", null);
    await insertar("vigente", "pending", null);

    await servicio.reactivateExpiredSnoozes(ds.manager);

    expect(await estados()).toEqual({
      descartado: "dismissed",
      hecho: "done",
      vigente: "pending",
    });
  });
});

describe("leer recordatorios ya no escribe", () => {
  it("ni listar, ni contar, ni abrir la ficha de un vehículo", async () => {
    // Con un postergado vencido a mano: antes, cualquiera de estas tres
    // lecturas lo reactivaba de paso.
    await insertar("vencido", "snoozed", AYER);
    const antes = await foto();

    await invocar("service:list", { page: 1, pageSize: 10, scope: "all" });
    await invocar("service:count-due");
    await invocar("service:by-car", "AB123CD");

    expect(await foto()).toBe(antes);
  });
});
