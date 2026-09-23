import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * `job.parts` y `job.carId` dejan de admitir `NULL`.
 *
 * **Los repuestos.** "Sin repuestos" tenía dos representaciones, `NULL` y
 * `'[]'`, y cada lector tenía que acordarse de las dos: por eso había un
 * `?? []` en una docena de lugares, y el que se olvidara iba a reventar con
 * `Cannot read properties of null`. Ya no se escribía `NULL` salvo por un
 * camino —un `car:update-job` con `parts: null`, que el DTO dejaba pasar—,
 * pero la base lo seguía aceptando. Ahora hay una sola forma: la lista vacía.
 *
 * También se convierte el texto `'null'`, que `simple-json` lee como `null` y
 * que sería una tercera representación de lo mismo. Todo lo demás se deja como
 * está: un valor que no es una lista es otro problema, y "arreglarlo" acá sería
 * tirar datos que nadie revisó.
 *
 * **El vehículo.** La entidad declara el trabajo como `nullable: false` desde
 * que existe la tabla, pero la columna se creó sin `NOT NULL`. Ningún camino
 * lo deja en `NULL` —la FK borra en cascada, no anula—, así que es la base
 * alcanzando a lo que el código ya suponía. Lo fija
 * `esquemaDeLasEntidades.test.ts`, que es el que encontró la diferencia.
 *
 * ## Una migración no puede fallar por los datos
 *
 * Si falla, la aplicación no abre hasta la versión siguiente. Por eso los
 * trabajos sin vehículo —no debería haber ninguno— no hacen fallar la copia
 * ni se borran: **van a la papelera**, donde se ven y se pueden eliminar. En
 * ninguna pantalla aparecían, porque los trabajos se listan por vehículo, pero
 * sí contaban en los totales del dashboard.
 *
 * ## La papelera guarda filas, y las filas también se migran
 *
 * La papelera conserva las filas tal como estaban en la base, y restaurar es
 * volver a insertarlas. Un trabajo que se borró con `parts` en `NULL` ya no
 * entraría, y el `DEFAULT` no ayuda: SQLite sólo lo aplica cuando la columna no
 * se nombra, no cuando llega un `NULL` explícito. Así que las copias se
 * corrigen igual que la tabla. Vale para cualquier migración futura que
 * restrinja una columna de `job`, `car`, `client` o `service_reminder`.
 *
 * ## Reconstruir la tabla
 *
 * SQLite no puede agregar `NOT NULL` a una columna existente. Nada referencia
 * a `job`, así que soltarla no dispara ninguna cascada; igual corre con las
 * claves foráneas apagadas, porque el `QueryRunner` de better-sqlite3 las apaga
 * en `beforeMigration` (ver AllowHomonymClients).
 *
 * La FK va en una sola línea a propósito: TypeORM saca su nombre del SQL con
 * una expresión regular que espera `) REFERENCES` seguido, y si no lo
 * encuentra, `migration:generate` propone rehacer la tabla para "renombrarla".
 */

type Fila = Record<string, unknown>;

/** Las formas en que se guardó "sin repuestos" además de `'[]'`. */
const sinRepuestos = (valor: unknown) =>
  valor === null || valor === undefined || valor === "null";

const COLUMNAS = [
  "id",
  "price",
  "description",
  "isThirdParty",
  "status",
  "parts",
  "createdAt",
  "updatedAt",
  "carId",
  "notes",
  "clientNote",
  "isService",
]
  .map((c) => `"${c}"`)
  .join(", ");

const INDICES = [
  `CREATE INDEX "IDX_job_car" ON "job" ("carId")`,
  `CREATE INDEX "IDX_job_status_updated" ON "job" ("status", "updatedAt")`,
];

const crearTabla = (nombre: string, { estricta }: { estricta: boolean }) => `
  CREATE TABLE "${nombre}" (
    "id"           VARCHAR   PRIMARY KEY NOT NULL,
    "price"        INTEGER   NOT NULL DEFAULT 0,
    "description"  VARCHAR   NOT NULL DEFAULT '',
    "isThirdParty" BOOLEAN   NOT NULL DEFAULT 0,
    "status"       VARCHAR   NOT NULL DEFAULT 'pending',
    "parts"        TEXT      ${estricta ? "NOT NULL DEFAULT '[]'" : ""},
    "createdAt"    DATETIME  NOT NULL DEFAULT (datetime('now')),
    "updatedAt"    DATETIME  NOT NULL DEFAULT (datetime('now')),
    "carId"        VARCHAR   ${estricta ? "NOT NULL" : ""},
    "notes"        TEXT,
    "clientNote"   TEXT,
    "isService"    BOOLEAN   NOT NULL DEFAULT 0,
    CONSTRAINT "FK_job_car" FOREIGN KEY ("carId") REFERENCES "car" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
  )
`;

/** Reemplaza la tabla `job` por una con el esquema indicado. */
const reconstruir = async (
  qr: QueryRunner,
  estricta: boolean,
  seleccion: string
) => {
  await qr.query(`DROP INDEX IF EXISTS "IDX_job_car"`);
  await qr.query(`DROP INDEX IF EXISTS "IDX_job_status_updated"`);
  await qr.query(crearTabla("job_nueva", { estricta }));
  await qr.query(
    `INSERT INTO "job_nueva" (${COLUMNAS}) SELECT ${seleccion} FROM "job"`
  );
  await qr.query(`DROP TABLE "job"`);
  await qr.query(`ALTER TABLE "job_nueva" RENAME TO "job"`);
  for (const indice of INDICES) await qr.query(indice);
};

export class TightenJobColumns1700000018000 implements MigrationInterface {
  name = "TightenJobColumns1700000018000";

  public async up(qr: QueryRunner): Promise<void> {
    // ── Trabajos sin vehículo: a la papelera ────────────────────────────
    //
    // `NOT IN` cubre también el que apunta a un vehículo que ya no está: con
    // la FK activa no puede pasar, pero es el mismo trabajo invisible.
    const huerfanos = (await qr.query(
      `SELECT * FROM "job"
       WHERE "carId" IS NULL OR "carId" NOT IN (SELECT "id" FROM "car")`
    )) as Fila[];
    if (huerfanos.length > 0) {
      await qr.query(
        `INSERT INTO "deleted_item" ("id", "kind", "label", "payload", "deletedAt")
         VALUES (?, 'car', ?, ?, ?)`,
        [
          crypto.randomUUID(),
          `Trabajos sin vehículo (${huerfanos.length})`,
          JSON.stringify({
            client: [],
            car: [],
            job: huerfanos.map((fila) => ({
              ...fila,
              parts: sinRepuestos(fila.parts) ? "[]" : fila.parts,
            })),
            service_reminder: [],
          }),
          new Date().toISOString(),
        ]
      );
      await qr.query(
        `DELETE FROM "job"
         WHERE "carId" IS NULL OR "carId" NOT IN (SELECT "id" FROM "car")`
      );
    }

    // ── Las copias de la papelera ───────────────────────────────────────
    const copias = (await qr.query(
      `SELECT "id", "payload" FROM "deleted_item"`
    )) as { id: string; payload: string }[];
    for (const copia of copias) {
      let payload: { job?: Fila[] };
      try {
        payload = JSON.parse(copia.payload);
      } catch {
        // Una copia ilegible tampoco se podía restaurar antes: no es asunto de
        // esta migración, y no puede ser motivo para que la aplicación no abra.
        continue;
      }
      const trabajos = Array.isArray(payload.job) ? payload.job : [];
      const aCorregir = trabajos.filter((fila) => sinRepuestos(fila.parts));
      if (aCorregir.length === 0) continue;
      for (const fila of aCorregir) fila.parts = "[]";
      await qr.query(`UPDATE "deleted_item" SET "payload" = ? WHERE "id" = ?`, [
        JSON.stringify(payload),
        copia.id,
      ]);
    }

    // ── La tabla ────────────────────────────────────────────────────────
    await reconstruir(
      qr,
      true,
      COLUMNAS.replace(
        `"parts"`,
        `CASE WHEN "parts" IS NULL OR "parts" = 'null' THEN '[]' ELSE "parts" END`
      )
    );
  }

  public async down(qr: QueryRunner): Promise<void> {
    // Vuelve la forma de las columnas. Los trabajos que se apartaron a la
    // papelera se quedan ahí: no tenían vehículo, y restaurarlos es decisión
    // de quien los mire.
    await reconstruir(qr, false, COLUMNAS);
  }
}
