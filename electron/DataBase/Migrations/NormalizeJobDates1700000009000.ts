import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Unifica el formato de `job.createdAt` y `job.updatedAt`.
 *
 * La columna tenía **dos formatos conviviendo**:
 *
 * - Lo que escribe TypeORM: `2026-08-03 20:51:15.174`, en hora **local**.
 * - Lo que dejó la migración `NormalizeJobs` al pasar los trabajos del JSON de
 *   `car.jobs` a la tabla `job`: `2026-03-26T20:45:17.611Z`, ISO en **UTC**.
 *
 * Mientras las fechas se leen con `new Date()` da igual, porque JavaScript
 * entiende los dos. El problema es SQL: ahí una comparación entre esas columnas
 * es una comparación de **texto** entre formatos distintos, y el resultado no
 * significa nada. La tarea 8 tuvo que escribir sus filtros por mes con
 * `strftime` justamente para esquivar esto; cualquier consulta futura que use un
 * `>=` contra un datetime se va a equivocar en silencio.
 *
 * Y hay un error de datos concreto: `strftime` lee las filas en `Z` como UTC, así
 * que un trabajo actualizado en las últimas tres horas del mes se contabiliza en
 * el mes siguiente.
 *
 * La conversión toma el instante real y lo reescribe en hora local, así que **no
 * cambia a qué momento apunta cada fecha**, sólo cómo está escrita:
 * `2026-03-26T20:45:17.611Z` → `2026-03-26 17:45:17.611`.
 *
 * Sólo se tocan las filas que están en el formato viejo. Las demás quedan
 * intactas, y por eso volver a correrla no haría nada.
 */
export class NormalizeJobDates1700000009000 implements MigrationInterface {
  name = "NormalizeJobDates1700000009000";

  public async up(qr: QueryRunner): Promise<void> {
    for (const column of ["createdAt", "updatedAt"]) {
      // ISO con `Z`: el instante está en UTC y hay que pasarlo a hora local.
      //
      // La condición `strftime(...) IS NOT NULL` no es decorativa: si el texto
      // no se puede interpretar, `strftime` devuelve NULL, y sin este filtro la
      // migración vaciaría una columna `NOT NULL`. Ante una fila rara es mejor
      // dejarla como está que romperla.
      await qr.query(`
        UPDATE "job"
        SET "${column}" = strftime('%Y-%m-%d %H:%M:%f', "${column}", 'localtime')
        WHERE "${column}" LIKE '%T%Z'
          AND strftime('%Y-%m-%d %H:%M:%f', "${column}", 'localtime') IS NOT NULL
      `);

      // ISO sin zona horaria: ya está en hora local, sólo sobra la `T`. No se
      // vio ninguna fila así, pero convertirla con 'localtime' le restaría tres
      // horas de más.
      await qr.query(`
        UPDATE "job"
        SET "${column}" = replace("${column}", 'T', ' ')
        WHERE "${column}" LIKE '%T%'
      `);
    }
  }

  public async down(): Promise<void> {
    // No se puede deshacer con sentido: una vez unificado el formato, no queda
    // registro de qué filas venían en ISO. Tampoco haría falta —el formato nuevo
    // lo entienden todos los consumidores— y para volver atrás de verdad está la
    // copia previa que se saca antes de migrar.
  }
}
