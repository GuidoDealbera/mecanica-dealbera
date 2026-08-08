import { MigrationInterface, QueryRunner } from "typeorm";
import { v4 } from "uuid";
import { logError } from "../../logger";

/**
 * Normaliza los trabajos: pasa de la columna JSON `car.jobs` a una tabla `job`
 * con FK a `car`.
 *
 * `up`:  crea la tabla `job`, transfiere cada trabajo del JSON a una fila
 *        (preservando id, timestamps y parts) y elimina la columna `car.jobs`.
 * `down`: recrea la columna `car.jobs`, la repuebla desde la tabla `job`
 *        (agrupando por auto) y elimina la tabla `job`.
 */

type CarJobsRow = { id: string; jobs: string | null };

type JsonJob = {
  id?: string;
  price?: number;
  description?: string;
  isThirdParty?: boolean;
  status?: string;
  parts?: { name: string; price: number }[];
  createdAt?: string;
  updatedAt?: string;
};

type JobRow = {
  id: string;
  price: number;
  description: string;
  isThirdParty: number;
  status: string;
  parts: string | null;
  createdAt: string;
  updatedAt: string;
  carId: string;
};

// Normaliza un valor de fecha a ISO; si es inválido/ausente usa el fallback.
function toIso(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const d = new Date(value);
  return isNaN(d.getTime()) ? fallback : d.toISOString();
}

export class NormalizeJobs1700000004000 implements MigrationInterface {
  name = "NormalizeJobs1700000004000";

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "job" (
        "id"           VARCHAR   PRIMARY KEY NOT NULL,
        "price"        INTEGER   NOT NULL DEFAULT 0,
        "description"  VARCHAR   NOT NULL DEFAULT '',
        "isThirdParty" BOOLEAN   NOT NULL DEFAULT 0,
        "status"       VARCHAR   NOT NULL DEFAULT 'pending',
        "parts"        TEXT,
        "createdAt"    DATETIME  NOT NULL DEFAULT (datetime('now')),
        "updatedAt"    DATETIME  NOT NULL DEFAULT (datetime('now')),
        "carId"        VARCHAR,
        CONSTRAINT "FK_job_car" FOREIGN KEY ("carId")
          REFERENCES "car" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await qr.query(
      `CREATE INDEX IF NOT EXISTS "IDX_job_car" ON "job" ("carId")`
    );

    // Transferir los trabajos existentes desde el JSON a filas.
    const cars: CarJobsRow[] = await qr.query(
      `SELECT id, jobs FROM car WHERE jobs IS NOT NULL`
    );

    for (const car of cars) {
      let jobs: JsonJob[];
      try {
        jobs = JSON.parse(car.jobs ?? "[]");
      } catch (error) {
        logError("migration:NormalizeJobs:up", error, {
          reason: "jobs corruptos, se omite auto",
          carId: car.id,
        });
        continue;
      }
      if (!Array.isArray(jobs)) continue;

      for (const job of jobs) {
        const now = new Date().toISOString();
        const createdAt = toIso(job.createdAt, now);
        await qr.query(
          `INSERT INTO "job"
            ("id", "price", "description", "isThirdParty", "status", "parts", "createdAt", "updatedAt", "carId")
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            job.id ?? v4(),
            job.price ?? 0,
            job.description ?? "",
            job.isThirdParty ? 1 : 0,
            job.status ?? "pending",
            JSON.stringify(job.parts ?? []),
            createdAt,
            toIso(job.updatedAt, createdAt),
            car.id,
          ]
        );
      }
    }

    // Eliminar la columna JSON ya migrada.
    await qr.query(`ALTER TABLE "car" DROP COLUMN "jobs"`);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE "car" ADD COLUMN "jobs" TEXT`);

    const jobs: JobRow[] = await qr.query(
      `SELECT * FROM "job" ORDER BY "createdAt" ASC`
    );

    const byCar = new Map<string, JsonJob[]>();
    for (const job of jobs) {
      const list = byCar.get(job.carId) ?? [];
      list.push({
        id: job.id,
        price: job.price,
        description: job.description,
        isThirdParty: !!job.isThirdParty,
        status: job.status,
        parts: job.parts ? JSON.parse(job.parts) : [],
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      });
      byCar.set(job.carId, list);
    }

    for (const [carId, list] of byCar) {
      await qr.query(`UPDATE car SET jobs = ? WHERE id = ?`, [
        JSON.stringify(list),
        carId,
      ]);
    }

    await qr.query(`DROP TABLE IF EXISTS "job"`);
  }
}
