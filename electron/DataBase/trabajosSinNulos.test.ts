import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "reflect-metadata";
import type { DataSource } from "typeorm";

/**
 * `job.parts` y `job.carId` dejan de admitir `NULL`: la migración
 * TightenJobColumns.
 *
 * Los casos arrancan del esquema **anterior** a la migración —se deshace, se
 * cargan los datos crudos y se vuelve a aplicar—, porque es ahí donde puede
 * haber lo que la migración tiene que resolver. Después de ella, la base ya no
 * deja escribirlo.
 */

const stub = vi.hoisted(() => ({
  dir: "",
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
}));

vi.mock("electron", () => ({
  app: { getPath: () => stub.dir, getVersion: () => "2.1.0", isPackaged: true },
  ipcMain: {
    handle: (canal: string, handler: (...args: unknown[]) => unknown) => {
      stub.handlers.set(canal, handler);
    },
  },
  dialog: { showErrorBox: vi.fn(), showMessageBox: vi.fn() },
  shell: { showItemInFolder: vi.fn(), openPath: vi.fn() },
}));

let dir: string;
let ds: DataSource;
/** El vehículo que carga cada caso: los trabajos crudos cuelgan de él. */
let autoId: string;

const invocar = async <T>(canal: string, ...args: unknown[]): Promise<T> => {
  const handler = stub.handlers.get(canal);
  if (!handler) throw new Error(`No se registró el canal ${canal}`);
  return (await handler({}, ...args)) as T;
};

type Respuesta = { status: string; message: string };

const migracion = async () => {
  const { TightenJobColumns1700000018000 } =
    await import("./Migrations/TightenJobColumns1700000018000");
  return new TightenJobColumns1700000018000();
};

/** Corre `up` o `down` como lo corre TypeORM: con su propio query runner. */
const correr = async (sentido: "up" | "down") => {
  const m = await migracion();
  const qr = ds.createQueryRunner();
  try {
    await m[sentido](qr);
  } finally {
    await qr.release();
  }
};

const insertarTrabajo = (
  id: string,
  parts: string | null,
  carId: string | null = autoId
) =>
  ds.query(
    `INSERT INTO job (id, price, description, isThirdParty, status, parts, createdAt, updatedAt, carId)
     VALUES (?, 1000, 'Trabajo', 0, 'pending', ?, '2026-01-01 09:00:00', '2026-01-01 09:00:00', ?)`,
    [id, parts, carId]
  );

const partsDe = async (id: string) =>
  (
    (await ds.query(`SELECT parts FROM job WHERE id = ?`, [id])) as {
      parts: string | null;
    }[]
  )[0]?.parts;

const papelera = async () =>
  (await ds.query(
    `SELECT "id", "label", "payload" FROM "deleted_item" ORDER BY "deletedAt"`
  )) as { id: string; label: string; payload: string }[];

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-sin-nulos-"));
  process.env.MECANICA_DATA_DIR = dir;
  stub.dir = dir;
  stub.handlers.clear();
  vi.resetModules();

  const dataSource = await import("./dataSource");
  await dataSource.AppDataSource.initialize();
  await dataSource.applyPendingMigrations();
  await import("./Endpoints/car.crud.endpoints");
  await import("./Endpoints/car.jobs.endpoints");
  await import("./Endpoints/trash.endpoints");
  ds = dataSource.AppDataSource;

  await invocar("car:create", {
    licensePlate: "AB123CD",
    brand: "Volkswagen",
    model: "Gol",
    year: 2016,
    kilometers: 90000,
    owner: {
      fullname: "Ana Gómez",
      phone: "3515123456",
      address: "Calle 1",
      city: "Córdoba",
    },
  });
  const [auto] = (await ds.query(`SELECT id FROM car`)) as { id: string }[];
  autoId = auto.id;

  // Al esquema de antes de la migración, que es donde puede haber nulos.
  await correr("down");
});

afterEach(async () => {
  if (ds?.isInitialized) await ds.destroy();
  delete process.env.MECANICA_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("los repuestos", () => {
  it("un NULL, o el texto 'null', pasan a ser la lista vacía", async () => {
    await insertarTrabajo("nulo", null);
    await insertarTrabajo("texto-null", "null");

    await correr("up");

    expect(await partsDe("nulo")).toBe("[]");
    expect(await partsDe("texto-null")).toBe("[]");
  });

  it("lo demás queda como estaba, también lo que no es una lista", async () => {
    // Se compara el texto: reescribir un JSON que está bien le cambiaría el
    // formato, y "arreglar" uno que no es una lista sería tirar un dato que
    // nadie revisó.
    const conRepuestos = JSON.stringify([{ name: "Filtro", price: 12000 }]);
    await insertarTrabajo("con-repuestos", conRepuestos);
    await insertarTrabajo("raro", `{"name":"Filtro"}`);

    await correr("up");

    expect(await partsDe("con-repuestos")).toBe(conRepuestos);
    expect(await partsDe("raro")).toBe(`{"name":"Filtro"}`);
  });

  it("después, la base no admite un NULL y usa la lista vacía por defecto", async () => {
    await correr("up");

    await expect(insertarTrabajo("nulo", null)).rejects.toThrow(
      /NOT NULL constraint failed: job\.parts/
    );

    await ds.query(
      `INSERT INTO job (id, price, description, isThirdParty, status, createdAt, updatedAt, carId)
       VALUES ('sin-columna', 1000, 'Trabajo', 0, 'pending', '2026-01-01 09:00:00', '2026-01-01 09:00:00', ?)`,
      [autoId]
    );
    expect(await partsDe("sin-columna")).toBe("[]");
  });
});

describe("los trabajos sin vehículo", () => {
  it("van a la papelera en vez de hacer fallar la migración", async () => {
    await insertarTrabajo("sin-auto", null, null);
    // Uno que apunta a un vehículo que ya no está: con las FK activas no se
    // puede escribir, así que se apagan sólo para prepararlo.
    await ds.query(`PRAGMA foreign_keys = OFF`);
    await insertarTrabajo("auto-inexistente", "[]", "auto-borrado");
    await ds.query(`PRAGMA foreign_keys = ON`);
    await insertarTrabajo("normal", "[]");

    await expect(correr("up")).resolves.toBeUndefined();

    const quedan = (await ds.query(`SELECT id FROM job ORDER BY id`)) as {
      id: string;
    }[];
    expect(quedan.map((j) => j.id)).toEqual(["normal"]);

    const [item] = await papelera();
    expect(item.label).toBe("Trabajos sin vehículo (2)");
    const payload = JSON.parse(item.payload) as {
      job: { id: string; parts: string }[];
    };
    expect(payload.job.map((j) => j.id).sort()).toEqual([
      "auto-inexistente",
      "sin-auto",
    ]);
    // Van ya con la forma nueva, o no se podrían ni mirar.
    expect(payload.job.every((j) => j.parts === "[]")).toBe(true);
  });

  it("no se pueden restaurar, y lo dicen; sí se pueden eliminar", async () => {
    await insertarTrabajo("sin-auto", null, null);
    await correr("up");
    const [item] = await papelera();

    const restaurar = await invocar<Respuesta>("trash:restore", item.id);
    expect(restaurar.status).toBe("failed");
    expect(restaurar.message).toMatch(/no tienen un vehículo al que volver/);

    const eliminar = await invocar<Respuesta>("trash:purge", item.id);
    expect(eliminar.status).toBe("success");
    expect(await papelera()).toHaveLength(0);
  });

  it("después, la base no admite un trabajo sin vehículo", async () => {
    await correr("up");

    await expect(insertarTrabajo("sin-auto", "[]", null)).rejects.toThrow(
      /NOT NULL constraint failed: job\.carId/
    );
  });
});

describe("la papelera", () => {
  it("lo que se borró con los repuestos en NULL se sigue pudiendo restaurar", async () => {
    // Un vehículo borrado antes de la migración: su trabajo quedó copiado en
    // la papelera tal como estaba, con `parts` en NULL.
    await insertarTrabajo("viejo", null);
    const borrar = await invocar<Respuesta>("car:delete", "AB123CD");
    expect(borrar.status).toBe("success");

    await correr("up");

    const [item] = await papelera();
    const restaurar = await invocar<Respuesta>("trash:restore", item.id);
    expect(restaurar.status).toBe("success");
    expect(await partsDe("viejo")).toBe("[]");
  });
});

describe("la tabla reconstruida", () => {
  it("conserva los índices y el borrado en cascada", async () => {
    await insertarTrabajo("uno", "[]");
    await correr("up");

    const indices = (await ds.query(`PRAGMA index_list("job")`)) as {
      name: string;
    }[];
    expect(indices.map((i) => i.name).sort()).toEqual(
      expect.arrayContaining(["IDX_job_car", "IDX_job_status_updated"])
    );

    expect(await ds.query(`PRAGMA foreign_key_check`)).toEqual([]);

    // La FK es la que se lleva los trabajos al borrar el vehículo: si la
    // reconstrucción la hubiera perdido, el trabajo quedaría huérfano.
    await ds.query(`DELETE FROM car WHERE id = ?`, [autoId]);
    expect(await partsDe("uno")).toBeUndefined();
  });

  it("volver atrás deja las columnas como estaban", async () => {
    await correr("up");
    await correr("down");

    const columnas = (await ds.query(`PRAGMA table_info("job")`)) as {
      name: string;
      notnull: number;
    }[];
    const admiteNulo = (nombre: string) =>
      columnas.find((c) => c.name === nombre)?.notnull === 0;
    expect(admiteNulo("parts")).toBe(true);
    expect(admiteNulo("carId")).toBe(true);
  });
});
