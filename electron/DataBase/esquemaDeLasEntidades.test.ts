import { afterEach, beforeEach, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import "reflect-metadata";
import { DataSource } from "typeorm";

/**
 * Las entidades describen la base que arman las migraciones.
 *
 * Con `synchronize: false` nadie lo comprobaba: las entidades se escriben a
 * mano, las migraciones también, y lo único que las unía era la costumbre de
 * copiar de una a la otra. Cuando se escribió este test había cinco
 * diferencias, y dos no eran de forma:
 *
 * - `car.owner` es `ON DELETE SET NULL` en la base, y la entidad no lo decía:
 *   describía una FK `NO ACTION`. Un `migration:generate` la habría "corregido"
 *   así, y borrar un cliente habría empezado a fallar.
 * - `job.carId` admitía `NULL` en la base, aunque la entidad dijera
 *   `nullable: false` desde el principio.
 *
 * ## Por qué no alcanza con `createSchemaBuilder().log()`
 *
 * Es lo primero que se prueba, y da una lista enorme aun con las entidades
 * corregidas. TypeORM saca el nombre de cada FK del SQL de la tabla con una
 * expresión regular que espera `) REFERENCES` seguido, y las migraciones viejas
 * lo escribieron en dos renglones: no lo encuentra y propone reconstruir tres
 * tablas para "renombrar" restricciones que ya tienen el nombre correcto. Por
 * un salto de línea no vale reconstruir `car`, de la que cuelga todo.
 *
 * Así que se compara lo que importa, y no el texto: se arma una base con las
 * migraciones y otra con `synchronize` desde las entidades —que es el esquema
 * que TypeORM cree que hay— y se comparan columnas, tipos, nulos, valores por
 * defecto, claves foráneas con sus acciones e índices, tal como los informa
 * SQLite. Queda afuera lo que SQLite no informa por `PRAGMA`: los nombres de
 * las FK y los `CHECK`.
 */

const stub = vi.hoisted(() => ({ dir: "" }));
vi.mock("electron", () => ({
  app: { getPath: () => stub.dir, getVersion: () => "2.1.0" },
  dialog: {
    showErrorBox: vi.fn(),
    showMessageBox: vi.fn(async () => ({ response: 1 })),
    showMessageBoxSync: vi.fn(),
  },
}));

let dir: string;
const abiertas: DataSource[] = [];

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-esquema-"));
  stub.dir = dir;
  process.env.MECANICA_DATA_DIR = dir;
});

afterEach(async () => {
  for (const ds of abiertas.splice(0)) if (ds.isInitialized) await ds.destroy();
  delete process.env.MECANICA_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

interface Columna {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}
interface ClaveForanea {
  from: string;
  table: string;
  to: string;
  on_update: string;
  on_delete: string;
}
interface Indice {
  name: string;
  unique: number;
  origin: string;
  partial: number;
}

/**
 * El esquema de cada tabla, en una forma que se puede comparar: cada cosa como
 * un renglón de texto y ordenada, porque el orden de las columnas no importa y
 * sí difiere —`ADD COLUMN` agrega al final—.
 *
 * Los tipos van en minúscula: la migración escribe `VARCHAR` y TypeORM
 * `varchar`, y para SQLite son lo mismo.
 */
const esquemaDe = (archivo: string, tablas: string[]) => {
  const db = new Database(archivo, { readonly: true });
  const lista = <T>(sql: string) => db.prepare(sql).all() as T[];

  const esquema = Object.fromEntries(
    tablas.map((tabla) => [
      tabla,
      {
        columnas: lista<Columna>(`PRAGMA table_info("${tabla}")`)
          .map(
            (c) =>
              `${c.name} ${c.type.toLowerCase()}` +
              `${c.notnull ? " NOT NULL" : ""}` +
              `${c.dflt_value === null ? "" : ` DEFAULT ${c.dflt_value}`}` +
              `${c.pk ? " PK" : ""}`
          )
          .sort(),
        clavesForaneas: lista<ClaveForanea>(
          `PRAGMA foreign_key_list("${tabla}")`
        )
          .map(
            (f) =>
              `${f.from} → ${f.table}.${f.to} ` +
              `ON DELETE ${f.on_delete} ON UPDATE ${f.on_update}`
          )
          .sort(),
        // Los índices automáticos de un `UNIQUE` o de la PK se nombran por
        // posición (`sqlite_autoindex_car_1`): se identifican por sus columnas.
        indices: lista<Indice>(`PRAGMA index_list("${tabla}")`)
          .map((i) => {
            const columnas = lista<{ name: string }>(
              `PRAGMA index_info("${i.name}")`
            )
              .map((c) => c.name)
              .join(", ");
            const nombre = i.name.startsWith("sqlite_autoindex_")
              ? `(${i.origin})`
              : i.name;
            return (
              `${nombre} (${columnas})` +
              `${i.unique ? " UNIQUE" : ""}${i.partial ? " PARCIAL" : ""}`
            );
          })
          .sort(),
      },
    ])
  );
  db.close();
  return esquema;
};

it("las entidades describen el esquema que arman las migraciones", async () => {
  vi.resetModules();
  const { AppDataSource, applyPendingMigrations } =
    await import("./dataSource");
  await AppDataSource.initialize();
  abiertas.push(AppDataSource);
  await applyPendingMigrations();

  const desdeEntidades = new DataSource({
    type: "better-sqlite3",
    database: path.join(dir, "desde-entidades.db"),
    entities: AppDataSource.options.entities,
    synchronize: true,
  });
  await desdeEntidades.initialize();
  abiertas.push(desdeEntidades);

  // Las tablas de las entidades. `migrations` es de TypeORM y `deleted_item`
  // no tiene entidad —la papelera la maneja con SQL crudo—.
  const tablas = desdeEntidades.entityMetadatas.map((m) => m.tableName).sort();

  expect(esquemaDe(AppDataSource.options.database as string, tablas)).toEqual(
    esquemaDe(desdeEntidades.options.database as string, tablas)
  );
});
