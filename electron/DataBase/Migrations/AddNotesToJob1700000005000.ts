import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Agrega la columna `notes` (notas internas del taller) a la tabla `job`.
 * Las filas existentes quedan con `NULL` (sin notas).
 */
export class AddNotesToJob1700000005000 implements MigrationInterface {
  name = "AddNotesToJob1700000005000";

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE "job" ADD COLUMN "notes" TEXT`);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE "job" DROP COLUMN "notes"`);
  }
}
