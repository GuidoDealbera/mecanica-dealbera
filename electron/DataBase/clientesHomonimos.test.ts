import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "reflect-metadata";
import type { DataSource } from "typeorm";

/**
 * Dos clientes pueden llamarse igual, y una familia puede compartir el
 * teléfono.
 *
 * Los dos campos venían con `UNIQUE` desde el esquema inicial. Lo que se prueba
 * acá es que la migración que lo quita **no se lleve puesto nada**: reconstruir
 * la tabla en SQLite obliga a soltar la vieja, y al soltarla se disparan las
 * acciones de las claves foráneas que la apuntan. Con
 * `car.ownerId ... ON DELETE SET NULL`, hacerlo mal deja a todos los autos sin
 * dueño y la base queda "sana" —ninguna restricción se violó—, así que el daño
 * no se nota hasta que alguien abre la ficha de un auto.
 *
 * Hoy no se rompe porque el driver apaga las claves foráneas mientras migra
 * (`beforeMigration`). Este caso está para que eso siga siendo cierto: es una
 * garantía que damos por sentada y que no depende de nuestro código.
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

/** Deja la base en el estado **anterior** a la migración que se está probando. */
const retrocederLaMigracion = async () => {
  const { AppDataSource, applyPendingMigrations } = await cargar();
  await AppDataSource.initialize();
  await applyPendingMigrations();

  const { AllowHomonymClients1700000013000 } =
    await import("./Migrations/AllowHomonymClients1700000013000");
  const qr = AppDataSource.createQueryRunner();
  await new AllowHomonymClients1700000013000().down(qr);
  await qr.release();
  await AppDataSource.query(
    "DELETE FROM migrations WHERE name = 'AllowHomonymClients1700000013000'"
  );
  await AppDataSource.destroy();
};

const insertarCliente = (id: string, fullname: string, phone: string) =>
  ds.query(
    `INSERT INTO client (id, fullname, phone, address, city, isActive, createdAt)
     VALUES (?, ?, ?, 'Calle 1', 'Córdoba', 1, '2026-01-01 09:00:00')`,
    [id, fullname, phone]
  );

const insertarAuto = (id: string, patente: string, ownerId: string) =>
  ds.query(
    `INSERT INTO car (id, licensePlate, model, brand, year, kilometers, kmHistory, createdAt, updatedAt, ownerId)
     VALUES (?, ?, 'GOL', 'Volkswagen', 2016, 90000, '[]', '2026-01-01 09:00:00', '2026-01-01 09:00:00', ?)`,
    [id, patente, ownerId]
  );

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-homonimos-"));
});

afterEach(async () => {
  if (ds?.isInitialized) await ds.destroy();
  delete process.env.MECANICA_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("la migración que quita la unicidad", () => {
  it("deja a cada auto con su dueño", async () => {
    await retrocederLaMigracion();

    {
      const { AppDataSource } = await cargar();
      await AppDataSource.initialize();
      ds = AppDataSource;
      await insertarCliente("cli-1", "Ana Gómez", "3515123456");
      await insertarCliente("cli-2", "Beto Ruiz", "3515123457");
      await insertarAuto("auto-1", "AB123CD", "cli-1");
      await insertarAuto("auto-2", "XY456ZW", "cli-2");
      await ds.destroy();
    }

    const { AppDataSource, applyPendingMigrations } = await cargar();
    await AppDataSource.initialize();
    const migradas = await applyPendingMigrations();
    ds = AppDataSource;

    expect(migradas).toBe(1);

    // Esto es lo que se rompe si la tabla se reconstruye con las claves
    // foráneas activas: los dos autos quedan con `ownerId` en NULL.
    const autos = (await ds.query(
      "SELECT id, ownerId FROM car ORDER BY id"
    )) as { id: string; ownerId: string | null }[];
    expect(autos).toEqual([
      { id: "auto-1", ownerId: "cli-1" },
      { id: "auto-2", ownerId: "cli-2" },
    ]);

    // Y los clientes siguen enteros, con sus datos.
    const clientes = (await ds.query(
      "SELECT id, fullname, phone, city FROM client ORDER BY id"
    )) as Record<string, string>[];
    expect(clientes).toEqual([
      {
        id: "cli-1",
        fullname: "Ana Gómez",
        phone: "3515123456",
        city: "Córdoba",
      },
      {
        id: "cli-2",
        fullname: "Beto Ruiz",
        phone: "3515123457",
        city: "Córdoba",
      },
    ]);
  });

  it("después de migrar, la base acepta homónimos y teléfonos compartidos", async () => {
    const { AppDataSource, applyPendingMigrations } = await cargar();
    await AppDataSource.initialize();
    await applyPendingMigrations();
    ds = AppDataSource;

    await insertarCliente("cli-1", "Ana Gómez", "3515123456");

    // Dos personas que se llaman igual: en un taller de barrio pasa.
    await expect(
      insertarCliente("cli-2", "Ana Gómez", "3515123457")
    ).resolves.toBeDefined();
    // Y una familia que comparte el número.
    await expect(
      insertarCliente("cli-3", "Beto Gómez", "3515123456")
    ).resolves.toBeDefined();
  });

  it("los campos siguen indexados, sólo dejan de ser únicos", async () => {
    const { AppDataSource, applyPendingMigrations } = await cargar();
    await AppDataSource.initialize();
    await applyPendingMigrations();
    ds = AppDataSource;

    // El `UNIQUE` traía su índice: sin reponerlo, ordenar el listado de
    // clientes por nombre y buscar el duplicado por teléfono pasan a recorrer
    // la tabla entera.
    const indices = (await ds.query(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'client' ORDER BY name"
    )) as { name: string }[];
    const nombres = indices.map((i) => i.name);
    expect(nombres).toContain("IDX_client_fullname");
    expect(nombres).toContain("IDX_client_phone");
    expect(nombres.filter((n) => n.startsWith("sqlite_autoindex"))).toEqual([
      // Sólo el de la clave primaria.
      "sqlite_autoindex_client_1",
    ]);
  });
});
