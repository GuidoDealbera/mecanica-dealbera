import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "reflect-metadata";
import type { DataSource } from "typeorm";

/**
 * El día de trabajo completo, de punta a punta.
 *
 * No es una prueba de extremo a extremo de verdad —no hay ventana ni clics— y
 * conviene decirlo: recorre los **canales IPC** contra una base SQLite real, que
 * es donde vive la lógica. Lo que agrega sobre los tests de cada endpoint es lo
 * que ninguno de ellos ve: que las piezas encajen entre sí.
 *
 * Los tests por endpoint prueban que `car:add-job` guarde un trabajo. Éste
 * prueba que cargar un auto lo meta al circuito de service, que cerrarle un
 * service programe el próximo, que emitir un presupuesto tome el número que
 * corresponde y que borrar el auto se lleve todo y lo deje recuperable. Son las
 * costuras, y son las que nadie estaba ejercitando.
 */

const stub = vi.hoisted(() => ({
  dir: "",
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  destino: null as string | null,
}));

vi.mock("electron", () => ({
  app: { getPath: () => stub.dir, getVersion: () => "2.0.0", isPackaged: true },
  ipcMain: {
    handle: (canal: string, handler: (...args: unknown[]) => unknown) => {
      stub.handlers.set(canal, handler);
    },
  },
  dialog: {
    showSaveDialog: vi.fn(async () => ({
      filePath: stub.destino ?? undefined,
    })),
    showErrorBox: vi.fn(),
    showMessageBox: vi.fn(),
  },
  shell: { showItemInFolder: vi.fn(), openPath: vi.fn() },
}));

let dir: string;
let ds: DataSource;

const invocar = async <T>(canal: string, ...args: unknown[]): Promise<T> => {
  const handler = stub.handlers.get(canal);
  if (!handler) throw new Error(`No se registró el canal ${canal}`);
  return (await handler({}, ...args)) as T;
};

type Respuesta<T = unknown> = { status: string; message: string; result: T };

const contar = async (tabla: string) =>
  Number(
    (
      (await ds.query(`SELECT COUNT(*) c FROM "${tabla}"`)) as { c: number }[]
    )[0].c
  );

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-recorrido-"));
  process.env.MECANICA_DATA_DIR = dir;
  stub.dir = dir;
  stub.destino = null;
  stub.handlers.clear();
  vi.resetModules();

  const dataSource = await import("./dataSource");
  await dataSource.AppDataSource.initialize();
  await dataSource.applyPendingMigrations();
  await import("./Endpoints/car.crud.endpoints");
  await import("./Endpoints/car.jobs.endpoints");
  await import("./Endpoints/client.endpoints");
  await import("./Endpoints/service.endpoints");
  await import("./Endpoints/document.endpoints");
  await import("./Endpoints/trash.endpoints");
  ds = dataSource.AppDataSource;
});

afterEach(async () => {
  if (ds?.isInitialized) await ds.destroy();
  delete process.env.MECANICA_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("un vehículo, de que entra al taller hasta que se lo borra", () => {
  it("recorre el circuito entero", async () => {
    // 1. Entra el auto. El titular se crea con él y el vehículo queda en el
    //    circuito de service desde el primer día.
    const alta = await invocar<Respuesta>("car:create", {
      licensePlate: "AB123CD",
      brand: "Volkswagen",
      model: "Gol",
      year: 2016,
      kilometers: 90_000,
      owner: {
        fullname: "Ana Gómez",
        phone: "3515123456",
        address: "San Martín 100",
        city: "Córdoba",
      },
    });
    expect(alta.status).toBe("success");

    const vigentes = await invocar<Respuesta<{ id: string }[]>>(
      "service:by-car",
      "AB123CD"
    );
    expect(vigentes.result).toHaveLength(1);

    // 2. Se le carga un trabajo que es un service, todavía sin cerrar.
    const trabajo = await invocar<Respuesta<{ id: string }>>(
      "car:add-job",
      "AB123CD",
      {
        price: 85_000,
        description: "Service completo",
        isThirdParty: false,
        status: "pending",
        parts: [{ name: "Filtro de aceite", price: 12_000 }],
        isService: true,
      }
    );
    expect(trabajo.status).toBe("success");

    // 3. Se emite el presupuesto. El número lo asigna la base, y la copia de lo
    //    impreso queda guardada para poder reimprimirlo.
    const emitido = await invocar<Respuesta<{ id: string; formatted: string }>>(
      "document:issue",
      {
        type: "budget",
        licensePlate: "AB123CD",
        clientName: "Ana Gómez",
        total: 97_000,
        snapshot: {
          title: "Presupuesto de Trabajo",
          car: {
            licensePlate: "AB123CD",
            brand: "Volkswagen",
            model: "Gol",
            year: 2016,
            kilometers: 90_000,
            owner: {
              fullname: "Ana Gómez",
              phone: "3515123456",
              address: "San Martín 100",
              city: "Córdoba",
            },
          },
          jobs: [
            {
              id: trabajo.result.id,
              description: "Service completo",
              price: 85_000,
              isThirdParty: false,
              parts: [{ name: "Filtro de aceite", price: 12_000 }],
            },
          ],
          totals: {
            laborTotal: 85_000,
            partsGrandTotal: 12_000,
            thirdPartyTotal: 0,
            ownTotal: 97_000,
            total: 97_000,
          },
        },
      }
    );
    expect(emitido.result.formatted).toBe("PRE-000001");

    // Y se puede volver a buscar con su copia, que es lo que permite
    // reimprimirlo si el cliente lo pierde.
    const traido = await invocar<Respuesta<{ snapshot: unknown }>>(
      "document:get",
      emitido.result.id
    );
    expect(traido.result.snapshot).toBeTruthy();

    // 4. Se cierra el trabajo. Al ser un service, se programa el próximo: el
    //    recordatorio viejo pasa a hecho y aparece uno nuevo.
    const cierre = await invocar<Respuesta>(
      "car:update-job",
      "AB123CD",
      trabajo.result.id,
      { status: "delivered" }
    );
    expect(cierre.status).toBe("success");

    const despues = await invocar<Respuesta<{ id: string }[]>>(
      "service:by-car",
      "AB123CD"
    );
    expect(despues.result).toHaveLength(1);
    // Es **otro** recordatorio, no el mismo: el anterior se cerró.
    expect(despues.result[0].id).not.toBe(vigentes.result[0].id);

    // 5. Se borra el auto. Se lleva su trabajo y su recordatorio, y queda
    //    recuperable.
    const borrado = await invocar<Respuesta>("car:delete", "AB123CD");
    expect(borrado.status).toBe("success");
    expect(await contar("car")).toBe(0);
    expect(await contar("job")).toBe(0);
    // El titular no: borrar un auto no borra a su dueño.
    expect(await contar("client")).toBe(1);
    // Y el documento tampoco: es un comprobante emitido.
    expect(await contar("document")).toBe(1);

    // 6. Se lo recupera con todo lo que tenía.
    const papelera = await invocar<Respuesta<{ id: string }[]>>("trash:list");
    const vuelta = await invocar<Respuesta>(
      "trash:restore",
      papelera.result[0].id
    );
    expect(vuelta.status).toBe("success");
    expect(await contar("car")).toBe(1);
    expect(await contar("job")).toBe(1);
    expect(await contar("service_reminder")).toBe(2);
  });
});

describe("cuando una transacción falla a mitad de camino", () => {
  it("el alta no deja ni el vehículo ni el titular", async () => {
    // El alta guarda titular, vehículo y recordatorio en **una** transacción.
    // Lo que se cuida es que un fallo en el medio no deje un cliente huérfano
    // cargado a nombre de un auto que no existe.
    //
    // Se rompe la tabla de recordatorios, que es el último paso, para que falle
    // después de haber escrito lo demás.
    await ds.query(`ALTER TABLE "service_reminder" RENAME TO "sr_escondida"`);

    const alta = await invocar<Respuesta>("car:create", {
      licensePlate: "AB123CD",
      brand: "Volkswagen",
      model: "Gol",
      year: 2016,
      kilometers: 90_000,
      owner: {
        fullname: "Ana Gómez",
        phone: "3515123456",
        address: "San Martín 100",
        city: "Córdoba",
      },
    });

    // Se contesta con un fallo, no se revienta hacia el renderer.
    expect(alta.status).toBe("failed");
    // Y no quedó nada a medias.
    expect(await contar("car")).toBe(0);
    expect(await contar("client")).toBe(0);

    await ds.query(`ALTER TABLE "sr_escondida" RENAME TO "service_reminder"`);
  });

  it("cerrar un service que falla no deja el trabajo cerrado", async () => {
    // Cerrar el trabajo y programar el próximo service son **un solo hecho**.
    // Si lo segundo falla, el trabajo tiene que quedar como estaba: si no, el
    // service figura como hecho y el vehículo nunca vuelve a aparecer.
    await invocar("car:create", {
      licensePlate: "AB123CD",
      brand: "Volkswagen",
      model: "Gol",
      year: 2016,
      kilometers: 90_000,
      owner: {
        fullname: "Ana Gómez",
        phone: "3515123456",
        address: "San Martín 100",
        city: "Córdoba",
      },
    });
    const trabajo = await invocar<Respuesta<{ id: string }>>(
      "car:add-job",
      "AB123CD",
      {
        price: 85_000,
        description: "Service completo",
        isThirdParty: false,
        status: "pending",
        parts: [],
        isService: true,
      }
    );

    await ds.query(`ALTER TABLE "service_reminder" RENAME TO "sr_escondida"`);

    const cierre = await invocar<Respuesta>(
      "car:update-job",
      "AB123CD",
      trabajo.result.id,
      { status: "delivered" }
    );

    expect(cierre.status).toBe("failed");
    const [fila] = (await ds.query("SELECT status FROM job WHERE id = ?", [
      trabajo.result.id,
    ])) as { status: string }[];
    expect(fila.status).toBe("pending");

    await ds.query(`ALTER TABLE "sr_escondida" RENAME TO "service_reminder"`);
  });
});
