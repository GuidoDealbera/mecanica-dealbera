import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Crea la tabla `document`, que lleva la numeración correlativa (por tipo) de
 * los presupuestos y facturas emitidos, junto al snapshot de lo que se entregó.
 *
 * El índice único `(type, number)` es la garantía de que no se repita un número
 * dentro de un mismo tipo, incluso si dos emisiones se solaparan.
 */
export class CreateDocumentTable1700000006000 implements MigrationInterface {
  name = "CreateDocumentTable1700000006000";

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE "document" (
        "id" varchar PRIMARY KEY NOT NULL,
        "type" varchar NOT NULL,
        "number" integer NOT NULL,
        "licensePlate" varchar NOT NULL DEFAULT (''),
        "clientName" varchar NOT NULL DEFAULT (''),
        "total" integer NOT NULL DEFAULT (0),
        "createdAt" datetime NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await qr.query(
      `CREATE UNIQUE INDEX "IDX_document_type_number" ON "document" ("type", "number")`
    );
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP INDEX IF EXISTS "IDX_document_type_number"`);
    await qr.query(`DROP TABLE IF EXISTS "document"`);
  }
}
