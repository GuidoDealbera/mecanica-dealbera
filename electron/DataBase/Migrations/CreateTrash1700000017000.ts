import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * La papelera: dónde queda lo que se borra.
 *
 * Borrar un vehículo se llevaba sus trabajos, su historial de kilometraje y su
 * recordatorio, y borrar un cliente se llevaba además todos sus vehículos. Era
 * irreversible salvo restaurando un respaldo entero, o sea eligiendo entre
 * perder un dato y perder un día de trabajo.
 *
 * Se guarda una copia de las **filas** borradas, no una marca sobre las que
 * siguen estando. El porqué está en `trash.service.ts`, y en corto: con un
 * borrado lógico los trabajos de un vehículo borrado seguirían contando en seis
 * consultas agregadas que nunca pasan por `car`.
 */
export class CreateTrash1700000017000 implements MigrationInterface {
  name = "CreateTrash1700000017000";

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE "deleted_item" (
        "id"        VARCHAR  PRIMARY KEY NOT NULL,
        "kind"      VARCHAR  NOT NULL,
        "label"     VARCHAR  NOT NULL,
        "payload"   TEXT     NOT NULL,
        "deletedAt" DATETIME NOT NULL
      )
    `);
    // El único orden en que se lee: lo más reciente primero.
    await qr.query(
      `CREATE INDEX "IDX_deleted_item_deleted" ON "deleted_item" ("deletedAt")`
    );
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP INDEX IF EXISTS "IDX_deleted_item_deleted"`);
    await qr.query(`DROP TABLE IF EXISTS "deleted_item"`);
  }
}
