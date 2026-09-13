import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Guarda en el documento la copia de lo que se imprimió.
 *
 * La tabla tenía tipo, número, patente, titular y total, pero **no los
 * renglones**. El historial decía que se emitió `FAC-000007` por $89.000 y no
 * había forma de reproducir ese PDF: si el cliente lo perdía, o si mientras
 * tanto se editaba o se borraba el trabajo, lo que decía el comprobante ya no
 * existía en ningún lado.
 *
 * La columna es `nullable` y se queda así. Los documentos emitidos antes de esta
 * migración no tienen copia y **no hay de dónde sacarla**: reconstruirla desde
 * los trabajos actuales daría un papel distinto del que firmó el cliente, que es
 * peor que no tener ninguno. La pantalla los distingue.
 */
export class AddDocumentSnapshot1700000016000 implements MigrationInterface {
  name = "AddDocumentSnapshot1700000016000";

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE "document" ADD COLUMN "snapshot" text`);
  }

  public async down(qr: QueryRunner): Promise<void> {
    // SQLite soporta DROP COLUMN desde la 3.35, y la versión que trae
    // better-sqlite3 13 está muy por encima.
    await qr.query(`ALTER TABLE "document" DROP COLUMN "snapshot"`);
  }
}
