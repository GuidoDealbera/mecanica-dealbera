import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * La invariante "un solo recordatorio vigente por vehículo" pasa a estar en la
 * base.
 *
 * Hasta ahora la sostenían los endpoints a mano, y **no alcanzó**: la migración
 * `SimplifyServiceType` tuvo que recorrer la base real colapsando los vigentes
 * repetidos que ya había. El código volvió a poder romperla —`service:save`
 * tomaba un recordatorio por `id` sin mirar si el vehículo ya tenía otro
 * activo— y eso se arregló, pero un arreglo en el código es algo que hay que
 * acordarse de no deshacer.
 *
 * Con un índice único parcial el bug deja de poder ocurrir. SQLite los soporta
 * desde la 3.8: el `WHERE` hace que la restricción valga sólo para los estados
 * vigentes, así que un vehículo puede tener todos los `done` y `dismissed` que
 * quiera —son su historial— pero un solo `pending` o `snoozed`.
 */
export class UniqueActiveReminder1700000012000 implements MigrationInterface {
  name = "UniqueActiveReminder1700000012000";

  public async up(qr: QueryRunner): Promise<void> {
    // Primero limpiar, o el índice no se puede crear. Mismo criterio que usó
    // `SimplifyServiceType`: se conserva **el más urgente** —el que vence
    // antes, y los que no tienen fecha van al final— y el resto se descarta.
    //
    // Se descartan en vez de borrarse: son historial, y borrar registros del
    // usuario en una migración es justo lo que no hay que hacer.
    await qr.query(`
      UPDATE "service_reminder"
      SET "status" = 'dismissed',
          "notes" = COALESCE(NULLIF("notes", '') || ' · ', '') ||
                    'Descartado al dejar un solo recordatorio vigente por vehículo',
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

    await qr.query(`
      CREATE UNIQUE INDEX "IDX_service_reminder_vigente_por_auto"
        ON "service_reminder" ("carId")
        WHERE "status" IN ('pending', 'snoozed')
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    // Los recordatorios que se descartaron para poder crear el índice no se
    // recuperan: no queda registro de cuáles eran, y adivinarlos sería peor.
    await qr.query(
      `DROP INDEX IF EXISTS "IDX_service_reminder_vigente_por_auto"`
    );
  }
}
