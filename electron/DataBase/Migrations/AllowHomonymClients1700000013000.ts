import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * El nombre y el teléfono del cliente dejan de ser únicos.
 *
 * Los dos venían con `UNIQUE` desde el esquema inicial, y los dos bloquean
 * situaciones que en un taller de barrio pasan: dos clientes que se llaman
 * igual, y una familia que comparte un número de teléfono. Ninguna de las dos
 * es un error de carga, pero la base las trataba como si lo fueran.
 *
 * Se podía sostener mientras el nombre fuera **la clave** con la que se buscaba
 * al cliente. Ya no lo es: la interfaz lo referencia por `id`, así que la
 * unicidad no está sujetando nada, sólo estorbando. Lo que queda en su lugar es
 * un aviso al cargar un duplicado, que es lo que el usuario necesita para
 * decidir si es la misma persona o no.
 *
 * SQLite no puede quitar un `UNIQUE` declarado en la tabla, así que hay que
 * reconstruirla. La parte delicada es que `car.ownerId` la referencia con
 * `ON DELETE SET NULL`: al soltar la tabla vieja esa acción se dispara y
 * **todos los autos se quedan sin dueño**, sin violar ninguna restricción, así
 * que la base queda "sana" y el daño no se nota hasta que alguien abre la ficha
 * de un auto. Se midió, y también que las dos formas de evitarlo desde adentro
 * no sirven: el `PRAGMA foreign_keys` se ignora dentro de una transacción, y
 * `defer_foreign_keys` demora la comprobación pero no las acciones.
 *
 * Lo que salva a esta migración es que el driver ya hace lo correcto: el
 * `QueryRunner` de better-sqlite3 apaga las claves foráneas en `beforeMigration`
 * y las vuelve a encender en `afterMigration`, que es el procedimiento que
 * documenta SQLite para cambiar de esquema. No hay que agregar nada —se probó a
 * agregarlo y era redundante—, pero **hay que saberlo** antes de escribir otra
 * migración que reconstruya una tabla referenciada, o de mover estas consultas
 * fuera de una migración.
 */
export class AllowHomonymClients1700000013000 implements MigrationInterface {
  name = "AllowHomonymClients1700000013000";

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE "client_sin_unicos" (
        "id"        VARCHAR       PRIMARY KEY NOT NULL,
        "fullname"  VARCHAR       NOT NULL,
        "phone"     VARCHAR       NOT NULL,
        "address"   VARCHAR       NOT NULL,
        "city"      VARCHAR       NOT NULL,
        "email"     VARCHAR,
        "isActive"  BOOLEAN       NOT NULL DEFAULT 1,
        "createdAt" DATETIME      NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await qr.query(`
      INSERT INTO "client_sin_unicos"
        ("id", "fullname", "phone", "address", "city", "email", "isActive", "createdAt")
      SELECT "id", "fullname", "phone", "address", "city", "email", "isActive", "createdAt"
      FROM "client"
    `);
    await qr.query(`DROP TABLE "client"`);
    await qr.query(`ALTER TABLE "client_sin_unicos" RENAME TO "client"`);

    // El `UNIQUE` traía un índice de regalo, y de eso dependían el orden del
    // listado de clientes y la búsqueda del duplicado por teléfono. Se quita la
    // unicidad, no el índice.
    await qr.query(
      `CREATE INDEX "IDX_client_fullname" ON "client" ("fullname")`
    );
    await qr.query(`CREATE INDEX "IDX_client_phone" ON "client" ("phone")`);
  }

  public async down(qr: QueryRunner): Promise<void> {
    // Volver atrás sólo es posible si mientras tanto no se cargó ningún
    // duplicado. Si se cargó, el `INSERT` falla y la migración se revierte
    // entera: es preferible a elegir por cuenta propia cuál de las dos fichas
    // de una persona se tira.
    await qr.query(`DROP INDEX IF EXISTS "IDX_client_fullname"`);
    await qr.query(`DROP INDEX IF EXISTS "IDX_client_phone"`);
    await qr.query(`
      CREATE TABLE "client_con_unicos" (
        "id"        VARCHAR       PRIMARY KEY NOT NULL,
        "fullname"  VARCHAR       NOT NULL UNIQUE,
        "phone"     VARCHAR       NOT NULL UNIQUE,
        "address"   VARCHAR       NOT NULL,
        "city"      VARCHAR       NOT NULL,
        "email"     VARCHAR,
        "isActive"  BOOLEAN       NOT NULL DEFAULT 1,
        "createdAt" DATETIME      NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await qr.query(`
      INSERT INTO "client_con_unicos"
        ("id", "fullname", "phone", "address", "city", "email", "isActive", "createdAt")
      SELECT "id", "fullname", "phone", "address", "city", "email", "isActive", "createdAt"
      FROM "client"
    `);
    await qr.query(`DROP TABLE "client"`);
    await qr.query(`ALTER TABLE "client_con_unicos" RENAME TO "client"`);
  }
}
