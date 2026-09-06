import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Observación del trabajo **para el cliente**.
 *
 * Las notas que ya existían (`job.notes`) son internas del taller y no se
 * imprimen: fue una decisión explícita y sigue en pie. Pero a veces hace falta
 * que algo llegue al cliente —"se recomienda cambiar las pastillas en el próximo
 * service", "el repuesto es alternativo"— y hasta ahora no había dónde
 * escribirlo.
 *
 * Es un campo **aparte** y no un interruptor sobre las notas internas a
 * propósito: reutilizar `notes` significaría que un descuido imprime algo que se
 * escribió justamente para no mostrarlo.
 */
export class AddClientNoteToJob1700000010000 implements MigrationInterface {
  name = "AddClientNoteToJob1700000010000";

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE "job" ADD COLUMN "clientNote" text`);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE "job" DROP COLUMN "clientNote"`);
  }
}
