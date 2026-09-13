import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Índice para el historial de documentos.
 *
 * `document:list` ordena por `createdAt DESC, number DESC` y el único índice de
 * la tabla era el único compuesto `(type, number)`, que no sirve para ese orden:
 * cada consulta recorría la tabla entera y ordenaba en memoria.
 *
 * Importa porque esta tabla **sólo crece**: se agrega una fila por cada
 * presupuesto o factura emitida y no se borra ninguna por diseño —el correlativo
 * es el punto—.
 *
 * Medido con 20 000 documentos: el listado pasa de 2,1 ms a 0,46 ms. Son
 * milisegundos, pero es un índice sobre una tabla de la que nadie va a borrar
 * nada nunca, y la diferencia se abre con el tiempo.
 *
 * El orden de las columnas es el del `ORDER BY`, y `number` va adentro para que
 * el desempate también salga del índice.
 */
export class AddDocumentDateIndex1700000015000 implements MigrationInterface {
  name = "AddDocumentDateIndex1700000015000";

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(
      `CREATE INDEX IF NOT EXISTS "IDX_document_created" ON "document" ("createdAt", "number")`
    );
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP INDEX IF EXISTS "IDX_document_created"`);
  }
}
