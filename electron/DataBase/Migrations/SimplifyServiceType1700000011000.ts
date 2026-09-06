import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Los tipos de service se reducen a un booleano.
 *
 * El modelo soportaba cinco tipos (general, aceite, correa, frenos, otro) y un
 * recordatorio vigente **por tipo y por vehículo**. En la práctica el taller
 * trabaja con un único circuito: todo es "service general". Los otros cuatro
 * nunca se usaron, y la abstracción a medio usar costaba en todos lados —el
 * filtro de la bandeja se tuvo que sacar porque tenía una sola opción real, el
 * formulario pedía elegir un tipo que no significa nada, y la invariante de "uno
 * vigente por tipo" complicaba el código sin comprarle nada a nadie—.
 *
 * **Decisión del usuario (06/09/2026): se reduce a un booleano.**
 *
 * - `job.serviceType` → `job.isService`.
 * - `service_reminder.type` desaparece: la invariante pasa a ser **un
 *   recordatorio vigente por vehículo**.
 */
export class SimplifyServiceType1700000011000 implements MigrationInterface {
  name = "SimplifyServiceType1700000011000";

  public async up(qr: QueryRunner): Promise<void> {
    // ── job: el tipo pasa a ser un sí/no ────────────────────────────────
    await qr.query(
      `ALTER TABLE "job" ADD COLUMN "isService" boolean NOT NULL DEFAULT (0)`
    );
    // Cualquier tipo contaba como "es un service"; `NULL` era "trabajo común".
    await qr.query(
      `UPDATE "job" SET "isService" = 1 WHERE "serviceType" IS NOT NULL`
    );
    await qr.query(`ALTER TABLE "job" DROP COLUMN "serviceType"`);

    // ── service_reminder: colapsar los vigentes de cada vehículo ────────
    //
    // Antes podía haber varios vigentes por vehículo, uno por tipo. Sin tipo,
    // eso serían duplicados. Se conserva **el más urgente** —el que vence
    // antes; los que no tienen fecha van al final— y el resto se descarta.
    //
    // Se descartan en vez de borrarse: son historial, y borrar registros del
    // usuario en una migración es justo lo que no hay que hacer.
    await qr.query(`
      UPDATE "service_reminder"
      SET "status" = 'dismissed',
          "notes" = COALESCE(NULLIF("notes", '') || ' · ', '') ||
                    'Descartado al unificar los tipos de service',
          "updatedAt" = datetime('now')
      WHERE "status" IN ('pending', 'snoozed')
        AND "id" NOT IN (
          SELECT "id" FROM (
            SELECT "id",
                   ROW_NUMBER() OVER (
                     PARTITION BY "carId"
                     ORDER BY ("dueDate" IS NULL) ASC, "dueDate" ASC, "id" ASC
                   ) AS fila
            FROM "service_reminder"
            WHERE "status" IN ('pending', 'snoozed')
          )
          WHERE fila = 1
        )
    `);

    await qr.query(`ALTER TABLE "service_reminder" DROP COLUMN "type"`);
  }

  public async down(qr: QueryRunner): Promise<void> {
    // Se puede recuperar la forma de las columnas, pero no qué tipo tenía cada
    // trabajo: esa información se pierde al unificar. Todo vuelve como
    // "general", que es lo único que se usaba de verdad.
    await qr.query(
      `ALTER TABLE "service_reminder" ADD COLUMN "type" varchar NOT NULL DEFAULT ('general')`
    );
    await qr.query(`ALTER TABLE "job" ADD COLUMN "serviceType" varchar`);
    await qr.query(
      `UPDATE "job" SET "serviceType" = 'general' WHERE "isService" = 1`
    );
    await qr.query(`ALTER TABLE "job" DROP COLUMN "isService"`);
  }
}
