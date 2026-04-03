import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1700000000000 implements MigrationInterface {
    name = "InitialSchema1700000000000"

    public async up(qr: QueryRunner): Promise<void> {
        await qr.query(`
            CREATE TABLE IF NOT EXISTS "client" (
                "id"        VARCHAR       PRIMARY KEY NOT NULL,
                "fullname"  VARCHAR       NOT NULL UNIQUE,
                "phone"     VARCHAR       NOT NULL UNIQUE,
                "address"   VARCHAR       NOT NULL,
                "city"      VARCHAR       NOT NULL,
                "email"     VARCHAR,
                "isActive"  BOOLEAN       NOT NULL DEFAULT 1,
                "createdAt" DATETIME      NOT NULL DEFAULT (datetime('now'))
            )
        `)

        await qr.query(`
            CREATE TABLE IF NOT EXISTS "car" (
                "id"           VARCHAR  PRIMARY KEY NOT NULL,
                "licensePlate" VARCHAR(7) NOT NULL UNIQUE,
                "model"        VARCHAR    NOT NULL,
                "brand"        VARCHAR    NOT NULL,
                "year"         INTEGER    NOT NULL,
                "jobs"         TEXT,
                "kilometers"   INTEGER    NOT NULL,
                "kmHistory"    TEXT,
                "createdAt"    DATETIME   NOT NULL DEFAULT (datetime('now')),
                "updatedAt"    DATETIME   NOT NULL DEFAULT (datetime('now')),
                "ownerId"      VARCHAR,
                CONSTRAINT "FK_car_client" FOREIGN KEY ("ownerId")
                    REFERENCES "client" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
            )
        `);
    }

    public async down(qr: QueryRunner): Promise<void> {
        await qr.query(`DROP TABLE IF EXISTS "car"`)
        await qr.query(`DROP TABLE IF EXISTS "client"`)
    }
}