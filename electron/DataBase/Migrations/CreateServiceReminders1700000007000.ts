import { randomUUID } from "node:crypto";
import { MigrationInterface, QueryRunner } from "typeorm";
import {
  DEFAULT_SERVICE_SETTINGS,
  ReminderStatus,
  ServiceType,
} from "../../../src/Types/apiTypes";
import { addMonths } from "../../../src/Utils/serviceReminders";

/**
 * Sistema de recordatorios de service:
 * - tabla `service_reminder` (con estado, para poder posponer/descartar),
 * - tabla `app_setting` (intervalos configurables; va en la base para que viaje
 *   con el backup),
 * - intervalos propios por vehículo en `car`,
 * - `serviceType` en `job`, para marcar qué trabajos son un service.
 *
 * Incluye **backfill**: cada vehículo existente arranca con un recordatorio
 * general vigente, con vencimiento calculado a partir de su último trabajo (o de
 * su fecha de alta si nunca tuvo), replicando el criterio de las alertas
 * anteriores pero ahora como una fecha concreta y accionable.
 *
 * El backfill deja `dueKm` en NULL a propósito: no se sabe con qué kilometraje
 * se hizo el último service, y es preferible no inventar el dato (el
 * vencimiento por km empieza a regir con el primer service registrado).
 */
export class CreateServiceReminders1700000007000 implements MigrationInterface {
  name = "CreateServiceReminders1700000007000";

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE "service_reminder" (
        "id" varchar PRIMARY KEY NOT NULL,
        "carId" varchar NOT NULL,
        "type" varchar NOT NULL DEFAULT ('${ServiceType.GENERAL}'),
        "status" varchar NOT NULL DEFAULT ('${ReminderStatus.PENDING}'),
        "dueDate" datetime,
        "dueKm" integer,
        "snoozedUntil" datetime,
        "contactedAt" datetime,
        "notes" text,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT "FK_service_reminder_car" FOREIGN KEY ("carId")
          REFERENCES "car" ("id") ON DELETE CASCADE
      )
    `);
    await qr.query(
      `CREATE INDEX "IDX_service_reminder_car" ON "service_reminder" ("carId")`
    );
    await qr.query(
      `CREATE INDEX "IDX_service_reminder_status_due" ON "service_reminder" ("status", "dueDate")`
    );

    await qr.query(`
      CREATE TABLE "app_setting" (
        "key" varchar PRIMARY KEY NOT NULL,
        "value" text NOT NULL DEFAULT ('')
      )
    `);

    await qr.query(
      `ALTER TABLE "car" ADD COLUMN "serviceIntervalMonths" integer`
    );
    await qr.query(`ALTER TABLE "car" ADD COLUMN "serviceIntervalKm" integer`);
    await qr.query(`ALTER TABLE "job" ADD COLUMN "serviceType" varchar`);

    // ── Backfill: un recordatorio general por vehículo ──────────────────
    const cars: { id: string; createdAt: string; lastJob: string | null }[] =
      await qr.query(`
        SELECT car."id" AS id,
               car."createdAt" AS createdAt,
               MAX(COALESCE(job."updatedAt", job."createdAt")) AS lastJob
        FROM "car" car
        LEFT JOIN "job" job ON job."carId" = car."id"
        GROUP BY car."id"
      `);

    for (const car of cars) {
      const reference = new Date(car.lastJob ?? car.createdAt);
      const from = Number.isNaN(reference.getTime()) ? new Date() : reference;
      const dueDate = addMonths(from, DEFAULT_SERVICE_SETTINGS.intervalMonths);

      await qr.query(
        `INSERT INTO "service_reminder"
           ("id", "carId", "type", "status", "dueDate", "dueKm")
         VALUES (?, ?, ?, ?, ?, NULL)`,
        [
          randomUUID(),
          car.id,
          ServiceType.GENERAL,
          ReminderStatus.PENDING,
          toSqliteDate(dueDate),
        ]
      );
    }
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP INDEX IF EXISTS "IDX_service_reminder_status_due"`);
    await qr.query(`DROP INDEX IF EXISTS "IDX_service_reminder_car"`);
    await qr.query(`DROP TABLE IF EXISTS "service_reminder"`);
    await qr.query(`DROP TABLE IF EXISTS "app_setting"`);
    await qr.query(`ALTER TABLE "job" DROP COLUMN "serviceType"`);
    await qr.query(`ALTER TABLE "car" DROP COLUMN "serviceIntervalKm"`);
    await qr.query(`ALTER TABLE "car" DROP COLUMN "serviceIntervalMonths"`);
  }
}

/** Fecha en el formato que usa TypeORM para las columnas `datetime` de SQLite. */
const toSqliteDate = (date: Date): string =>
  date.toISOString().slice(0, 19).replace("T", " ");
