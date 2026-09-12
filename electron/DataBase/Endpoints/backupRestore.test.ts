import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import "reflect-metadata";

/**
 * Restaurar un respaldo, por el endpoint de verdad.
 *
 * Es el escenario que rompía: el archivo que entra puede ser de una versión
 * anterior, y hasta ahora se lo abría y listo. La aplicación quedaba andando
 * contra un esquema sin `service_reminder`, sin `document` y con
 * `job.serviceType`, y reventaba en la primera pantalla que las tocara.
 *
 * Se ejercita el handler registrado, no una función suelta: lo que importa es
 * que el camino completo —apartar la base actual, copiar la nueva, verificar,
 * migrar— quede cubierto, incluida la vuelta atrás si algo falla.
 */

const stub = vi.hoisted(() => ({
  dir: "",
  /** Handlers que el módulo registra al cargarse, para poder invocarlos. */
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
    showMessageBoxSync: vi.fn(),
    showSaveDialog: vi.fn(async () => ({ filePath: undefined })),
    showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })),
  },
  shell: { showItemInFolder: vi.fn(), openPath: vi.fn() },
}));

let dir: string;

/** Base tal como la escribía la 1.0.3: sin `job`, `document` ni recordatorios. */
const crearBaseVieja = (dbPath: string) => {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE "client" (
      "id" VARCHAR PRIMARY KEY NOT NULL,
      "fullname" VARCHAR NOT NULL UNIQUE,
      "phone" VARCHAR NOT NULL UNIQUE,
      "address" VARCHAR NOT NULL,
      "city" VARCHAR NOT NULL,
      "email" VARCHAR,
      "isActive" BOOLEAN NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE "car" (
      "id" VARCHAR PRIMARY KEY NOT NULL,
      "licensePlate" VARCHAR(7) NOT NULL UNIQUE,
      "model" VARCHAR NOT NULL,
      "brand" VARCHAR NOT NULL,
      "year" INTEGER NOT NULL,
      "jobs" TEXT,
      "kilometers" INTEGER NOT NULL,
      "kmHistory" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
      "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now')),
      "ownerId" VARCHAR,
      CONSTRAINT "FK_car_client" FOREIGN KEY ("ownerId")
        REFERENCES "client" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
    );
  `);
  db.prepare(
    `INSERT INTO client (id, fullname, phone, address, city)
     VALUES ('c-viejo', 'Carlos Bravo', '3510000009', 'Rivadavia 50', 'Córdoba')`
  ).run();
  db.prepare(
    `INSERT INTO car (id, licensePlate, model, brand, year, kilometers, ownerId)
     VALUES ('a-viejo', 'ZZ999ZZ', 'PALIO', 'Fiat', 2010, 150000, 'c-viejo')`
  ).run();
  db.close();
};

const tablas = (dbPath: string): string[] => {
  const db = new Database(dbPath, { readonly: true });
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all() as { name: string }[];
  db.close();
  return rows.map((r) => r.name);
};

/** Carga los endpoints con la carpeta de datos apuntando al temporal. */
const cargarEndpoints = async () => {
  process.env.MECANICA_DATA_DIR = dir;
  stub.dir = dir;
  stub.handlers.clear();
  vi.resetModules();
  const dataSource = await import("../dataSource");
  await import("./backup.endpoints");
  return dataSource;
};

const invocar = async (canal: string, ...args: unknown[]) => {
  const handler = stub.handlers.get(canal);
  if (!handler) throw new Error(`No se registró el canal ${canal}`);
  return (await handler({}, ...args)) as { status: string; message: string };
};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-restore-"));
});

afterEach(() => {
  delete process.env.MECANICA_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("backup:restore", () => {
  it("pone al día un respaldo de una versión anterior", async () => {
    // La base en uso arranca vacía y al día; el respaldo es del esquema viejo.
    crearBaseVieja(path.join(dir, "backups", "taller_2026-01-05.db"));

    const { AppDataSource, applyPendingMigrations } = await cargarEndpoints();
    await AppDataSource.initialize();
    await applyPendingMigrations();

    const res = await invocar("backup:restore", "taller_2026-01-05.db");

    expect(res.status).toBe("success");

    // Esto primero, porque es el síntoma: sin migrar, la base en uso queda
    // sin las tablas que la aplicación da por sentadas y revienta la primera
    // pantalla que las toque.
    const dbPath = path.join(dir, "taller.db");
    expect(tablas(dbPath)).toEqual(
      expect.arrayContaining(["job", "document", "service_reminder"])
    );

    // Y el mensaje avisa que además se actualizó: el usuario tiene que saber
    // que su respaldo ya no es idéntico a lo que quedó restaurado.
    expect(res.message).toMatch(/actualizada/i);

    const db = new Database(dbPath, { readonly: true });
    const patente = (
      db.prepare("SELECT licensePlate FROM car").get() as {
        licensePlate: string;
      }
    ).licensePlate;
    db.close();
    expect(patente).toBe("ZZ999ZZ");

    await AppDataSource.destroy();
  });

  it("un archivo que no es una base deja todo como estaba", async () => {
    const { AppDataSource, applyPendingMigrations } = await cargarEndpoints();
    await AppDataSource.initialize();
    await applyPendingMigrations();

    // Se marca la base en uso para reconocerla después de la vuelta atrás.
    await AppDataSource.query(
      "INSERT INTO app_setting (key, value) VALUES ('marca', 'la-de-antes')"
    );

    const basura = path.join(dir, "backups", "taller_2026-01-06.db");
    fs.mkdirSync(path.dirname(basura), { recursive: true });
    fs.writeFileSync(basura, "esto no es una base de datos");

    const res = await invocar("backup:restore", "taller_2026-01-06.db");
    expect(res.status).toBe("failed");

    // Y la base de antes volvió, con su marca: la vuelta atrás sirve de algo.
    const marca = (
      (await AppDataSource.query(
        "SELECT value FROM app_setting WHERE key = 'marca'"
      )) as { value: string }[]
    )[0];
    expect(marca?.value).toBe("la-de-antes");

    await AppDataSource.destroy();
  });

  it("no se encuentra el respaldo pedido", async () => {
    const { AppDataSource, applyPendingMigrations } = await cargarEndpoints();
    await AppDataSource.initialize();
    await applyPendingMigrations();

    const res = await invocar("backup:restore", "no-existe.db");
    expect(res.status).toBe("failed");
    expect(res.message).toMatch(/no se encontró/i);

    await AppDataSource.destroy();
  });
});
