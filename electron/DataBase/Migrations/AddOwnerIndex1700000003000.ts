import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Agrega un índice sobre la FK `ownerId` de `car`.
 *
 * TypeORM no indexa automáticamente las columnas de relaciones ManyToOne,
 * y esa columna se consulta en los listados de autos por dueño
 * (`where: { owner: { id } }`), en los joins con `owner` y en las
 * operaciones de reasignación/borrado de clientes.
 *
 * `licensePlate`, `fullname` y `phone` NO se indexan aquí: su restricción
 * `UNIQUE` ya crea un índice automáticamente en SQLite.
 */
export class AddOwnerIndex1700000003000 implements MigrationInterface {
  name = "AddOwnerIndex1700000003000";

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(
      `CREATE INDEX IF NOT EXISTS "IDX_car_owner" ON "car" ("ownerId")`
    );
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP INDEX IF EXISTS "IDX_car_owner"`);
  }
}
