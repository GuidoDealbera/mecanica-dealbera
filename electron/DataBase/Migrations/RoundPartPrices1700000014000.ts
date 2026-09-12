import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Redondea a pesos enteros los precios de repuestos que hayan quedado con
 * decimales.
 *
 * El dinero de esta aplicación son pesos enteros: `job.price` y
 * `document.total` son columnas `integer` y `formatARS` imprime sin decimales.
 * El precio de los repuestos era la excepción, no por decisión sino porque vive
 * dentro de un `simple-json` donde no hay tipo que lo impida.
 *
 * Ahora el DTO lo rechaza, y sin esta migración un trabajo viejo con centavos
 * no se podría volver a guardar: al editarlo, la validación cortaría con "el
 * precio del repuesto tiene que ser un número entero" sobre un dato que el
 * usuario nunca escribió.
 *
 * Se usa `json_extract`/`json_set` en vez de leer y reescribir desde JavaScript
 * porque SQLite trae JSON1 y así el recorrido queda en una sola consulta, sin
 * traerse los trabajos a memoria.
 */
export class RoundPartPrices1700000014000 implements MigrationInterface {
  name = "RoundPartPrices1700000014000";

  public async up(qr: QueryRunner): Promise<void> {
    // Sólo las filas con repuestos y con al menos un precio no entero: tocar
    // las demás reescribiría el JSON sin motivo, cambiando su formato.
    await qr.query(`
      UPDATE "job"
      SET "parts" = (
        SELECT json_group_array(
          json_object(
            'name', json_extract(parte.value, '$.name'),
            'price', CAST(ROUND(COALESCE(json_extract(parte.value, '$.price'), 0)) AS INTEGER)
          )
        )
        FROM json_each("job"."parts") AS parte
      )
      WHERE "parts" IS NOT NULL
        AND json_valid("parts")
        AND json_type("parts") = 'array'
        AND EXISTS (
          SELECT 1 FROM json_each("job"."parts") AS parte
          WHERE json_extract(parte.value, '$.price') IS NOT NULL
            AND json_extract(parte.value, '$.price') <>
                CAST(json_extract(parte.value, '$.price') AS INTEGER)
        )
    `);
  }

  public async down(): Promise<void> {
    // Los centavos no se pueden devolver: no queda registro de cuáles eran.
  }
}
