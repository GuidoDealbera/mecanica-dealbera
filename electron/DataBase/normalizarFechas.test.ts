import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "reflect-metadata";
import type { DataSource } from "typeorm";

/**
 * La migración que unifica el formato de las fechas de los trabajos.
 *
 * Es de las que **reescriben datos del usuario**, y no tenía prueba. La trampa
 * está documentada en su propio comentario: `strftime` devuelve `NULL` ante un
 * texto que no entiende, y sin el filtro que lo contempla la migración vaciaría
 * una columna `NOT NULL`.
 *
 * Un comentario que dice "ojo con esto" no impide que alguien saque el filtro al
 * refactorizar. Un caso sí.
 */

const stub = vi.hoisted(() => ({ dir: "" }));
vi.mock("electron", () => ({
  app: { getPath: () => stub.dir, getVersion: () => "2.0.0", isPackaged: true },
  dialog: {
    showErrorBox: vi.fn(),
    showMessageBox: vi.fn(),
    showMessageBoxSync: vi.fn(),
  },
}));

let dir: string;
let ds: DataSource;

const insertar = (id: string, createdAt: string, updatedAt: string) =>
  ds.query(
    `INSERT INTO job (id, price, description, isThirdParty, status, parts, createdAt, updatedAt, carId)
     VALUES (?, 1000, 'Trabajo', 0, 'pending', '[]', ?, ?, 'auto-1')`,
    [id, createdAt, updatedAt]
  );

const fechas = async () =>
  Object.fromEntries(
    (
      (await ds.query(
        "SELECT id, createdAt, updatedAt FROM job ORDER BY id"
      )) as { id: string; createdAt: string; updatedAt: string }[]
    ).map((f) => [f.id, f])
  );

const migrar = async () => {
  const { NormalizeJobDates1700000009000 } =
    await import("./Migrations/NormalizeJobDates1700000009000");
  const qr = ds.createQueryRunner();
  await new NormalizeJobDates1700000009000().up(qr);
  await qr.release();
};

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-fechas-"));
  process.env.MECANICA_DATA_DIR = dir;
  stub.dir = dir;
  vi.resetModules();

  const dataSource = await import("./dataSource");
  await dataSource.AppDataSource.initialize();
  await dataSource.applyPendingMigrations();
  ds = dataSource.AppDataSource;

  await ds.query(
    `INSERT INTO client (id, fullname, phone, address, city, isActive, createdAt)
     VALUES ('cli-1','Ana','3515123456','Calle 1','Córdoba',1,'2026-01-01 09:00:00')`
  );
  await ds.query(
    `INSERT INTO car (id, licensePlate, model, brand, year, kilometers, kmHistory, createdAt, updatedAt, ownerId)
     VALUES ('auto-1','AB123CD','GOL','VW',2016,90000,'[]','2026-01-01 09:00:00','2026-01-01 09:00:00','cli-1')`
  );
});

afterEach(async () => {
  if (ds?.isInitialized) await ds.destroy();
  delete process.env.MECANICA_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("unificar el formato de las fechas", () => {
  it("reescribe el ISO en UTC como hora local", async () => {
    // El formato que dejó `NormalizeJobs` al pasar los trabajos del JSON a la
    // tabla. Convive con el que escribe TypeORM, y comparar los dos en SQL es
    // comparar **texto** entre formatos distintos.
    await insertar(
      "viejo",
      "2026-03-26T20:45:17.611Z",
      "2026-03-26T20:45:17.611Z"
    );

    await migrar();

    const { viejo } = await fechas();
    // Sin la T ni la Z, que es lo que hacía que la comparación no significara
    // nada.
    expect(viejo.createdAt).not.toContain("T");
    expect(viejo.createdAt).not.toContain("Z");
    // Y sigue apuntando al mismo instante: la conversión cambia cómo está
    // escrito, no a qué momento apunta.
    expect(new Date(`${viejo.createdAt}`).getTime()).toBe(
      new Date("2026-03-26T20:45:17.611Z").getTime()
    );
  });

  it("no toca lo que ya estaba bien", async () => {
    // Lo que escribe TypeORM. Volver a convertirlo le restaría las horas de la
    // zona otra vez.
    const yaBien = "2026-08-03 20:51:15.174";
    await insertar("nuevo", yaBien, yaBien);

    await migrar();

    const { nuevo } = await fechas();
    expect(nuevo.createdAt).toBe(yaBien);
    expect(nuevo.updatedAt).toBe(yaBien);
  });

  it("deja intacta la fila que no se puede interpretar, en vez de vaciarla", async () => {
    // La trampa: `strftime` devuelve NULL ante un texto que no entiende, y sin
    // el filtro `IS NOT NULL` esta fila quedaría con la columna vacía.
    //
    // La fecha rota tiene que **parecerse** a las que la migración busca —con
    // T y con Z— o el `LIKE` la descarta antes y el caso no prueba nada. Un mes
    // 99 pasa el filtro de forma y no pasa el de contenido, que es justo el
    // hueco que el `IS NOT NULL` tapa.
    const rota = "2026-99-99T99:99:99.000Z";
    await insertar("raro", rota, rota);

    await migrar();

    const { raro } = await fechas();
    // Lo que se cuida es que **no quede vacía**. Sin el filtro, acá la
    // migración revienta entera con `NOT NULL constraint failed`.
    expect(raro.createdAt).toBeTruthy();
    expect(raro.updatedAt).toBeTruthy();
    // El dato que había sigue ahí: la segunda sentencia le cambia la `T` por un
    // espacio —eso es normalizar el formato, no perder información— pero nadie
    // le inventó una fecha.
    expect(raro.createdAt).toContain("2026-99-99");
    expect(raro.createdAt).toContain("99:99:99");
  });

  it("correrla dos veces no cambia nada", async () => {
    // Las migraciones se aplican una sola vez, pero una que no sea idempotente
    // es una bomba para cualquier reintento o restauración.
    await insertar(
      "viejo",
      "2026-03-26T20:45:17.611Z",
      "2026-03-26T20:45:17.611Z"
    );

    await migrar();
    const primera = await fechas();
    await migrar();

    expect(await fechas()).toEqual(primera);
  });

  it("convierte las dos columnas, no sólo una", async () => {
    await insertar(
      "mixto",
      "2026-03-26T20:45:17.611Z",
      "2026-08-03 20:51:15.174"
    );

    await migrar();

    const { mixto } = await fechas();
    expect(mixto.createdAt).not.toContain("T");
    expect(mixto.updatedAt).toBe("2026-08-03 20:51:15.174");
  });
});
