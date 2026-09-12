import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import "reflect-metadata";

/**
 * Migrar una base que no vino del arranque normal.
 *
 * Es lo que hace falta para que restaurar un respaldo sea seguro: el archivo
 * que entra puede ser de cualquier versión. Antes se lo abría y listo, así que
 * un respaldo viejo dejaba la aplicación contra un esquema sin
 * `service_reminder`, sin `document` y con `job.serviceType`, y cada pantalla
 * que tocara esas columnas reventaba.
 *
 * `integrity_check` no alcanza para detectarlo —mira la estructura del archivo,
 * no si el esquema es el que la aplicación espera— así que estos casos se
 * prueban con bases de verdad, armadas a mano en el esquema viejo.
 */

// `dataSource.ts` importa `app` de Electron para resolver rutas y la versión.
// Acá no hay proceso de Electron; la ruta la decide `MECANICA_DATA_DIR`, que es
// el mismo punto de escape que usan las pruebas manuales contra la app real.
const stub = vi.hoisted(() => ({ dir: "" }));
vi.mock("electron", () => ({
  app: {
    getPath: () => stub.dir,
    getVersion: () => "2.0.0",
  },
  dialog: {
    showErrorBox: vi.fn(),
    showMessageBox: vi.fn(async () => ({ response: 1 })),
    showMessageBoxSync: vi.fn(),
  },
}));

let dir: string;

/**
 * Los 5 segundos por defecto no alcanzan. Cada caso reimporta `dataSource` —que
 * arrastra las entidades y las once migraciones— y la primera vez hay que
 * transformar todo ese árbol. En caliente el archivo entero corre en ~1 s; en
 * frío, que es como corre siempre en CI, la primera pasada se lleva más de 10.
 */
const PLAZO = 60_000;

/**
 * Base tal como la escribía la 1.0.3: sólo `client` y `car`, los trabajos como
 * JSON dentro del vehículo, y **sin tabla `migrations`**.
 */
const crearBaseVieja = (dbPath: string) => {
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
    `INSERT INTO client (id, fullname, phone, address, city, createdAt)
     VALUES ('c1', 'Ana Gómez', '3510000001', 'San Martín 100', 'Córdoba', '2026-01-10 09:00:00')`
  ).run();
  db.prepare(
    `INSERT INTO car (id, licensePlate, model, brand, year, jobs, kilometers, kmHistory, createdAt, updatedAt, ownerId)
     VALUES ('a1', 'AB123CD', 'GOL', 'Volkswagen', 2016, ?, 90000, ?, '2026-01-10 09:00:00', '2026-01-10 09:00:00', 'c1')`
  ).run(
    JSON.stringify([
      {
        id: "j1",
        description: "Cambio de aceite",
        price: 50000,
        status: "Entregado",
        isThirdParty: false,
        createdAt: "2026-02-01T10:00:00.000Z",
      },
    ]),
    JSON.stringify([{ km: 90000, date: "2026-01-10T09:00:00.000Z" }])
  );
  db.close();
};

/** Nombres de las tablas de la base, para comprobar el esquema resultante. */
const tablas = (dbPath: string): string[] => {
  const db = new Database(dbPath, { readonly: true });
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all() as { name: string }[];
  db.close();
  return rows.map((r) => r.name);
};

/** Columnas de una tabla. */
const columnas = (dbPath: string, tabla: string): string[] => {
  const db = new Database(dbPath, { readonly: true });
  const rows = db.pragma(`table_info('${tabla}')`) as { name: string }[];
  db.close();
  return rows.map((r) => r.name);
};

/**
 * Importa `dataSource` con la carpeta de datos apuntando al temporal. Hace
 * falta reimportarlo en cada caso porque `AppDataSource` se construye al cargar
 * el módulo, con la ruta ya resuelta.
 */
const cargarDataSource = async () => {
  process.env.MECANICA_DATA_DIR = dir;
  stub.dir = dir;
  vi.resetModules();
  return await import("./dataSource");
};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-migraciones-"));
});

afterEach(() => {
  delete process.env.MECANICA_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("registro de migraciones", () => {
  it(
    "todas declaran su nombre, que es lo único que sobrevive a la minificación",
    async () => {
      crearBaseVieja(path.join(dir, "taller.db"));
      const { AppDataSource } = await cargarDataSource();
      // `migrations` se puebla al inicializar, no al construir el DataSource.
      await AppDataSource.initialize();

      // El bundle del proceso principal va minificado: ahí `constructor.name`
      // es una letra. Identificar una migración por el nombre de su clase daba
      // por desconocidas a las once propias y no dejaba arrancar la aplicación.
      // Se comprobó corriendo el paquete, no en este test: acá las clases
      // conservan su nombre. Por eso lo que se fija es la causa —que cada
      // migración declare `name`— y no el síntoma.
      const sinNombre = AppDataSource.migrations
        .filter((migration) => !migration.name)
        .map((migration) => migration.constructor.name);
      const total = AppDataSource.migrations.length;
      await AppDataSource.destroy();

      expect(sinNombre).toEqual([]);
      expect(total).toBe(11);
    },
    PLAZO
  );
});

describe("applyPendingMigrations", () => {
  it(
    "pone al día una base del esquema anterior, con sus datos",
    async () => {
      const dbPath = path.join(dir, "taller.db");
      crearBaseVieja(dbPath);

      const { AppDataSource, applyPendingMigrations } =
        await cargarDataSource();
      await AppDataSource.initialize();
      const migradas = await applyPendingMigrations();
      await AppDataSource.destroy();

      expect(migradas).toBe(11);

      // Lo que la aplicación necesita y la base vieja no tenía. Sin esto, cada
      // pantalla que las toque revienta.
      expect(tablas(dbPath)).toEqual(
        expect.arrayContaining(["job", "document", "service_reminder"])
      );
      // El tipo de service pasó a ser un booleano (SimplifyServiceType).
      expect(columnas(dbPath, "job")).toEqual(
        expect.arrayContaining(["isService", "clientNote"])
      );
      expect(columnas(dbPath, "job")).not.toContain("serviceType");

      // Y los datos siguen ahí: el trabajo que era JSON dentro del auto ahora es
      // una fila propia.
      const db = new Database(dbPath, { readonly: true });
      const trabajo = db
        .prepare("SELECT description, price, carId FROM job")
        .get() as { description: string; price: number; carId: string };
      const autos = (
        db.prepare("SELECT COUNT(*) c FROM car").get() as { c: number }
      ).c;
      db.close();

      expect(autos).toBe(1);
      expect(trabajo.description).toBe("Cambio de aceite");
      expect(trabajo.price).toBe(50000);
      expect(trabajo.carId).toBe("a1");
    },
    PLAZO
  );

  it(
    "no hace nada sobre una base que ya está al día",
    async () => {
      const dbPath = path.join(dir, "taller.db");
      crearBaseVieja(dbPath);

      const primera = await cargarDataSource();
      await primera.AppDataSource.initialize();
      await primera.applyPendingMigrations();
      await primera.AppDataSource.destroy();

      const segunda = await cargarDataSource();
      await segunda.AppDataSource.initialize();
      const migradas = await segunda.applyPendingMigrations();
      await segunda.AppDataSource.destroy();

      expect(migradas).toBe(0);
    },
    PLAZO
  );

  it(
    "se planta ante una base escrita por una versión posterior",
    async () => {
      const dbPath = path.join(dir, "taller.db");
      crearBaseVieja(dbPath);

      // Se pone al día y después se le anota una migración del futuro, que es
      // exactamente lo que tendría un respaldo hecho por una versión más nueva.
      const primera = await cargarDataSource();
      await primera.AppDataSource.initialize();
      await primera.applyPendingMigrations();
      await primera.AppDataSource.destroy();

      const db = new Database(dbPath);
      db.prepare(
        "INSERT INTO migrations (timestamp, name) VALUES (1800000000000, 'AlgoDelFuturo1800000000000')"
      ).run();
      db.close();

      const segunda = await cargarDataSource();
      await segunda.AppDataSource.initialize();
      // Para esta versión no hay nada pendiente, así que el corte por
      // "¿faltan migraciones?" la dejaría pasar. Tiene que frenarla el otro.
      await expect(segunda.applyPendingMigrations()).rejects.toBeInstanceOf(
        segunda.DatabaseFromNewerVersionError
      );
      await segunda.AppDataSource.destroy();
    },
    PLAZO
  );
});
