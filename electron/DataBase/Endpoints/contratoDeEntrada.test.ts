import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "reflect-metadata";
import type { DataSource } from "typeorm";

/**
 * El contrato de entrada, para **todos** los canales de IPC a la vez.
 *
 * La regla del proyecto es que las reglas de negocio se validan en el backend,
 * porque un canal de IPC recibe lo que le manden. Pero eso estaba repartido:
 * algunos endpoints validaban con un DTO, otros con comprobaciones a mano, y
 * otros no validaban nada. No había un lugar donde se viera el criterio, y por
 * eso se pudieron olvidar tres endpoints enteros.
 *
 * Este archivo es ese lugar. Lo que fija es una sola cosa, y vale para todos:
 *
 * > **Un cuerpo inválido se contesta, no se revienta.**
 *
 * Si un handler lanza, `handleIpc` lo relanza y al renderer le llega una promesa
 * rechazada con el mensaje técnico crudo —`SQLITE_CONSTRAINT: UNIQUE constraint
 * failed`, `cannot read properties of undefined`— que es lo que termina viendo
 * el usuario. Devolver `{ status: "failed", message }` es el contrato.
 *
 * **Los canales no se enumeran a mano**: se toman de los que quedan registrados
 * al importar los módulos. Un endpoint nuevo entra solo a esta prueba, que es lo
 * único que evita que la lista se desactualice como se desactualizó la anterior.
 */

const stub = vi.hoisted(() => ({
  dir: "",
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
}));

vi.mock("electron", () => ({
  app: { getPath: () => stub.dir, getVersion: () => "2.0.0" },
  ipcMain: {
    handle: (canal: string, handler: (...args: unknown[]) => unknown) => {
      stub.handlers.set(canal, handler);
    },
  },
  dialog: {
    showErrorBox: vi.fn(),
    showMessageBox: vi.fn(async () => ({ response: 0 })),
    showMessageBoxSync: vi.fn(() => 0),
    // Cancelados: estos canales abren un selector de archivos y lo que se está
    // probando es lo que pasa **antes**, con el cuerpo que llega.
    showSaveDialog: vi.fn(async () => ({ filePath: undefined })),
    showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })),
  },
  shell: { showItemInFolder: vi.fn(), openPath: vi.fn() },
}));

let dir: string;
let ds: DataSource;

/** Cuerpos que un renderer roto —o un canal usado mal— puede llegar a mandar. */
const CUERPOS_INVALIDOS: unknown[] = [
  undefined,
  null,
  "",
  "texto suelto",
  0,
  -1,
  [],
  {},
  { campoInventado: true },
  { type: "nada", total: "mucho", price: "caro", status: "inventado" },
];

/**
 * Canales que **escriben** y por eso además tienen que dejar la base igual
 * cuando el cuerpo no sirve. Los de lectura pueden devolver vacío tranquilos.
 */
const TABLAS = ["car", "client", "job", "document", "service_reminder"];

const foto = async () => {
  const filas: Record<string, number> = {};
  for (const tabla of TABLAS) {
    filas[tabla] = Number(
      (
        (await ds.query(`SELECT COUNT(*) c FROM "${tabla}"`)) as {
          c: number;
        }[]
      )[0].c
    );
  }
  return filas;
};

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-contrato-"));
  process.env.MECANICA_DATA_DIR = dir;
  stub.dir = dir;
  stub.handlers.clear();
  vi.resetModules();

  const dataSource = await import("../dataSource");
  await dataSource.AppDataSource.initialize();
  await dataSource.applyPendingMigrations();

  await import("./car.crud.endpoints");
  await import("./car.jobs.endpoints");
  await import("./car.search.endpoints");
  await import("./client.endpoints");
  await import("./dashboard.endpoints");
  await import("./document.endpoints");
  await import("./service.endpoints");
  await import("./backup.endpoints");

  ds = dataSource.AppDataSource;

  // Algo cargado, para que los canales que buscan por patente o por id tengan
  // contra qué trabajar y no salgan por el atajo de "no encontrado".
  await ds.query(
    `INSERT INTO client (id, fullname, phone, address, city, isActive, createdAt)
     VALUES ('cli-1', 'Ana Gómez', '3515123456', 'Calle 1', 'Córdoba', 1, '2026-01-01 09:00:00')`
  );
  await ds.query(
    `INSERT INTO car (id, licensePlate, model, brand, year, kilometers, kmHistory, createdAt, updatedAt, ownerId)
     VALUES ('auto-1', 'AB123CD', 'GOL', 'Volkswagen', 2016, 90000, '[]', '2026-01-01 09:00:00', '2026-01-01 09:00:00', 'cli-1')`
  );
});

afterEach(async () => {
  if (ds?.isInitialized) await ds.destroy();
  delete process.env.MECANICA_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("contrato de entrada de los canales IPC", () => {
  it("hay canales registrados, o esta prueba no está probando nada", () => {
    // Sin esto, un cambio en cómo se registran los handlers dejaría el archivo
    // pasando en verde sin recorrer un solo canal.
    expect(stub.handlers.size).toBeGreaterThanOrEqual(25);
  });

  it("ningún canal revienta ante un cuerpo inválido", async () => {
    const antes = await foto();
    const explotaron: string[] = [];

    for (const [canal, handler] of stub.handlers) {
      for (const cuerpo of CUERPOS_INVALIDOS) {
        try {
          // Se manda el mismo cuerpo en las tres posiciones que usan los
          // canales del proyecto: `(cuerpo)`, `(id, cuerpo)` y
          // `(patente, id, cuerpo)`.
          //
          // Los identificadores son **inexistentes a propósito**. Con los de
          // verdad, `car:delete` hacía su trabajo y borraba el vehículo: el
          // test terminaba probando que un borrado borra, que no es lo que
          // está en discusión acá. Los endpoints que validan el cuerpo lo hacen
          // antes de ir a buscar nada, así que el camino que interesa se
          // recorre igual.
          await handler({}, cuerpo);
          await handler({}, "ZZ999ZZ", cuerpo);
          await handler({}, "ZZ999ZZ", "id-que-no-existe", cuerpo);
        } catch (error) {
          explotaron.push(
            `${canal} con ${JSON.stringify(cuerpo)}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    }

    // Se juntan todos y se reportan de una: así el mensaje del fallo dice qué
    // canales hay que arreglar, en vez de sólo el primero.
    expect(explotaron).toEqual([]);

    // Y nada de todo eso escribió en la base.
    expect(await foto()).toEqual(antes);
  });

  it("todos los canales contestan con el mismo envelope", async () => {
    // El contrato de **salida**, que es el otro medio del mismo problema.
    //
    // Nueve canales devolvían el dato pelado: un `Paginated`, un número, un
    // arreglo. Con eso `ensureSuccess` no se podía usar en la mitad de las
    // llamadas, así que cada pantalla se inventaba su manejo de error, y una
    // lectura que fallaba de verdad llegaba al renderer como una promesa
    // rechazada con el mensaje de TypeORM.
    //
    // Se recorre la lista registrada por el mismo motivo que arriba: un canal
    // nuevo entra solo, que es lo único que evita que esto se desactualice.
    const ESTADOS = ["success", "failed", "cancelled"];
    const fuera: string[] = [];

    for (const [canal, handler] of stub.handlers) {
      let respuesta: unknown;
      try {
        respuesta = await handler({}, "ZZ999ZZ");
      } catch {
        // Que no lance ya lo cubre el caso anterior; acá sólo interesa la forma
        // de lo que devuelve cuando devuelve.
        continue;
      }
      const estado = (respuesta as { status?: unknown } | null)?.status;
      if (typeof estado !== "string" || !ESTADOS.includes(estado)) {
        fuera.push(`${canal}: ${JSON.stringify(respuesta)?.slice(0, 80)}`);
      }
    }

    expect(fuera).toEqual([]);
  });
});
