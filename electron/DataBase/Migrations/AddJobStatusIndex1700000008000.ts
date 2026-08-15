import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Índice compuesto `(status, updatedAt)` sobre `job`.
 *
 * Todo lo que consulta la tabla por estado hoy hace un scan completo: el badge
 * de trabajos activos de la barra de navegación (`car:active-jobs-count`) y las
 * cinco consultas del dashboard.
 *
 * Es compuesto y no sólo `(status)` porque los listados de "trabajos recientes"
 * son `WHERE status = ? ORDER BY updatedAt DESC LIMIT 6`: con la segunda columna
 * el índice ya entrega las filas ordenadas y SQLite corta a las seis, en vez de
 * ordenar en memoria todo el subconjunto del estado. `status` sigue siendo el
 * prefijo, así que las consultas que sólo filtran por estado lo aprovechan igual.
 *
 * Medido sobre una copia de la base inflada a 20.000 trabajos:
 *
 * | consulta                          | antes    | después |
 * | --------------------------------- | -------- | ------- |
 * | badge de trabajos activos         |  3,9 ms  | 0,5 ms  |
 * | dashboard: conteo por estado      |  6,9 ms  | 1,1 ms  |
 * | dashboard: cerrados del mes       |  6,6 ms  | 3,2 ms  |
 * | dashboard: 6 recientes por estado | 38,9 ms  | 0,2 ms  |
 *
 * Cuesta ~825 KB de índice cada 20.000 trabajos y una escritura más por alta o
 * modificación de trabajo: barato para una tabla que se lee mucho más de lo que
 * se escribe.
 */
export class AddJobStatusIndex1700000008000 implements MigrationInterface {
  name = "AddJobStatusIndex1700000008000";

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(
      `CREATE INDEX IF NOT EXISTS "IDX_job_status_updated" ON "job" ("status", "updatedAt")`
    );
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP INDEX IF EXISTS "IDX_job_status_updated"`);
  }
}
