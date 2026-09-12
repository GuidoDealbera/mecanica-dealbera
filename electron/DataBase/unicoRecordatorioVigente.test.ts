import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import "reflect-metadata";
import type { DataSource } from "typeorm";

/**
 * "Un solo recordatorio vigente por vehículo", ahora garantizado por la base.
 *
 * Era una regla que sostenían los endpoints a mano, y no alcanzó: la migración
 * `SimplifyServiceType` tuvo que colapsar los duplicados que ya había en la
 * base real, y después `service:save` volvió a poder crearlos.
 *
 * Lo que se prueba acá es lo que hace que el bug **deje de poder ocurrir**, que
 * es distinto de arreglarlo: que la base rechace el segundo vigente aunque el
 * código se equivoque.
 */

const stub = vi.hoisted(() => ({ dir: "" }));
vi.mock("electron", () => ({
  app: { getPath: () => stub.dir, getVersion: () => "2.0.0" },
  dialog: {
    showErrorBox: vi.fn(),
    showMessageBox: vi.fn(async () => ({ response: 1 })),
    showMessageBoxSync: vi.fn(),
  },
}));

let dir: string;
let ds: DataSource;

const cargar = async () => {
  process.env.MECANICA_DATA_DIR = dir;
  stub.dir = dir;
  vi.resetModules();
  return await import("./dataSource");
};

/** Base al día, con un vehículo y sin recordatorios. */
const prepararAlDia = async () => {
  const { AppDataSource, applyPendingMigrations } = await cargar();
  await AppDataSource.initialize();
  await applyPendingMigrations();
  ds = AppDataSource;
  await ds.query(
    `INSERT INTO client (id, fullname, phone, address, city, isActive, createdAt)
     VALUES ('cli-1', 'Ana Gómez', '3515123456', 'Calle 1', 'Córdoba', 1, '2026-01-01 09:00:00')`
  );
  await ds.query(
    `INSERT INTO car (id, licensePlate, model, brand, year, kilometers, kmHistory, createdAt, updatedAt, ownerId)
     VALUES ('auto-1', 'AB123CD', 'GOL', 'Volkswagen', 2016, 90000, '[]', '2026-01-01 09:00:00', '2026-01-01 09:00:00', 'cli-1')`
  );
};

const insertarRecordatorio = (
  id: string,
  estado: string,
  dueDate: string | null
) =>
  ds.query(
    `INSERT INTO service_reminder (id, carId, status, dueDate, dueKm, snoozedUntil, contactedAt, notes, createdAt, updatedAt)
     VALUES (?, 'auto-1', ?, ?, NULL, NULL, NULL, '', '2026-01-01 09:00:00', '2026-01-01 09:00:00')`,
    [id, estado, dueDate]
  );

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-unico-"));
});

afterEach(async () => {
  if (ds?.isInitialized) await ds.destroy();
  delete process.env.MECANICA_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("un solo recordatorio vigente por vehículo", () => {
  it("la base rechaza un segundo vigente", async () => {
    await prepararAlDia();
    await insertarRecordatorio("r1", "pending", "2026-06-01 00:00:00");

    // Esto es lo que el código ya no hace, pero la base tiene que impedir
    // igual: la garantía no puede depender de que nadie se equivoque.
    await expect(
      insertarRecordatorio("r2", "pending", "2026-07-01 00:00:00")
    ).rejects.toThrow(/UNIQUE/i);

    // Y también con el otro estado vigente.
    await expect(
      insertarRecordatorio("r3", "snoozed", "2026-07-01 00:00:00")
    ).rejects.toThrow(/UNIQUE/i);
  });

  it("deja tener todo el historial que haga falta", async () => {
    await prepararAlDia();
    await insertarRecordatorio("r1", "done", "2026-01-01 00:00:00");
    await insertarRecordatorio("r2", "done", "2026-02-01 00:00:00");
    await insertarRecordatorio("r3", "dismissed", "2026-03-01 00:00:00");
    await insertarRecordatorio("r4", "pending", "2026-06-01 00:00:00");

    // Los cerrados son el historial del vehículo: la restricción no los toca.
    const filas = (await ds.query(
      "SELECT COUNT(*) c FROM service_reminder WHERE carId = 'auto-1'"
    )) as { c: number }[];
    expect(Number(filas[0].c)).toBe(4);
  });

  it("otro vehículo puede tener el suyo", async () => {
    await prepararAlDia();
    await insertarRecordatorio("r1", "pending", "2026-06-01 00:00:00");
    await ds.query(
      `INSERT INTO car (id, licensePlate, model, brand, year, kilometers, kmHistory, createdAt, updatedAt, ownerId)
       VALUES ('auto-2', 'XY456ZW', 'PALIO', 'Fiat', 2010, 10000, '[]', '2026-01-01 09:00:00', '2026-01-01 09:00:00', 'cli-1')`
    );

    await expect(
      ds.query(
        `INSERT INTO service_reminder (id, carId, status, dueDate, dueKm, snoozedUntil, contactedAt, notes, createdAt, updatedAt)
         VALUES ('r2', 'auto-2', 'pending', '2026-06-01 00:00:00', NULL, NULL, NULL, '', '2026-01-01 09:00:00', '2026-01-01 09:00:00')`
      )
    ).resolves.toBeDefined();
  });

  it("la migración colapsa los duplicados que ya estaban", async () => {
    // Se arma la base con el esquema **anterior** al índice, se le meten dos
    // vigentes —como los que había en la base real— y recién ahí se migra.
    const dbPath = path.join(dir, "taller.db");
    {
      const { AppDataSource, applyPendingMigrations } = await cargar();
      await AppDataSource.initialize();
      await applyPendingMigrations();
      await AppDataSource.query(
        `DROP INDEX "IDX_service_reminder_vigente_por_auto"`
      );
      await AppDataSource.query(
        "DELETE FROM migrations WHERE name = 'UniqueActiveReminder1700000012000'"
      );
      await AppDataSource.destroy();
    }

    const db = new Database(dbPath);
    db.exec(`
      INSERT INTO client (id, fullname, phone, address, city, isActive, createdAt)
      VALUES ('cli-1', 'Ana Gómez', '3515123456', 'Calle 1', 'Córdoba', 1, '2026-01-01 09:00:00');
      INSERT INTO car (id, licensePlate, model, brand, year, kilometers, kmHistory, createdAt, updatedAt, ownerId)
      VALUES ('auto-1', 'AB123CD', 'GOL', 'Volkswagen', 2016, 90000, '[]', '2026-01-01 09:00:00', '2026-01-01 09:00:00', 'cli-1');
      INSERT INTO service_reminder (id, carId, status, dueDate, dueKm, snoozedUntil, contactedAt, notes, createdAt, updatedAt)
      VALUES ('tarde', 'auto-1', 'pending', '2026-09-01 00:00:00', NULL, NULL, NULL, '', '2026-01-01 09:00:00', '2026-01-01 09:00:00'),
             ('temprano', 'auto-1', 'pending', '2026-03-01 00:00:00', NULL, NULL, NULL, '', '2026-01-01 09:00:00', '2026-01-01 09:00:00'),
             ('sin-fecha', 'auto-1', 'snoozed', NULL, NULL, NULL, NULL, '', '2026-01-01 09:00:00', '2026-01-01 09:00:00');
    `);
    db.close();

    const { AppDataSource, applyPendingMigrations } = await cargar();
    await AppDataSource.initialize();
    const migradas = await applyPendingMigrations();
    ds = AppDataSource;

    expect(migradas).toBe(1);

    const filas = (await ds.query(
      "SELECT id, status, notes FROM service_reminder ORDER BY id"
    )) as { id: string; status: string; notes: string }[];

    // Sobrevive el más urgente, no el primero que se insertó.
    const vigentes = filas.filter((f) =>
      ["pending", "snoozed"].includes(f.status)
    );
    expect(vigentes.map((f) => f.id)).toEqual(["temprano"]);

    // Y los otros dos quedan como historial con el motivo escrito, no borrados.
    expect(filas).toHaveLength(3);
    const descartado = filas.find((f) => f.id === "tarde")!;
    expect(descartado.status).toBe("dismissed");
    expect(descartado.notes).toMatch(/un solo recordatorio vigente/i);
  });
});
