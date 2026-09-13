import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "reflect-metadata";
import type { DataSource } from "typeorm";

/**
 * Deshacer un borrado.
 *
 * Borrar un vehículo se llevaba sus trabajos, su historial de kilometraje y su
 * recordatorio. Borrar un cliente se llevaba además **todos sus vehículos**.
 * Era irreversible salvo restaurando un respaldo entero, o sea eligiendo entre
 * perder un dato y perder un día de trabajo.
 *
 * Lo que se prueba es lo que el usuario espera de una papelera: que lo borrado
 * vuelva **completo**, que no se pueda pisar algo cargado mientras tanto, y que
 * cuando algo sale mal no quede a medias.
 */

const stub = vi.hoisted(() => ({
  dir: "",
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
}));

vi.mock("electron", () => ({
  app: { getPath: () => stub.dir, getVersion: () => "2.0.0", isPackaged: true },
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

const invocar = async <T>(canal: string, ...args: unknown[]): Promise<T> => {
  const handler = stub.handlers.get(canal);
  if (!handler) throw new Error(`No se registró el canal ${canal}`);
  return (await handler({}, ...args)) as T;
};

type Respuesta = { status: string; message: string };
type Item = {
  id: string;
  label: string;
  kind: string;
  counts: { jobs: number; cars: number };
};

const papelera = async () =>
  (await invocar<{ result: Item[] }>("trash:list")).result;

const contar = async (tabla: string, where = "1=1") =>
  Number(
    (
      (await ds.query(`SELECT COUNT(*) c FROM "${tabla}" WHERE ${where}`)) as {
        c: number;
      }[]
    )[0].c
  );

/** Un cliente con un vehículo y dos trabajos. */
const cargarTaller = async () => {
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
  for (const desc of ["Cambio de aceite", "Alineación"]) {
    await invocar("car:add-job", "AB123CD", {
      price: 50000,
      description: desc,
      isThirdParty: false,
      status: "pending",
      parts: [],
    });
  }
};

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-papelera-"));
  process.env.MECANICA_DATA_DIR = dir;
  stub.dir = dir;
  stub.handlers.clear();
  vi.resetModules();

  const dataSource = await import("./dataSource");
  await dataSource.AppDataSource.initialize();
  await dataSource.applyPendingMigrations();
  await import("./Endpoints/car.crud.endpoints");
  await import("./Endpoints/car.jobs.endpoints");
  await import("./Endpoints/client.endpoints");
  await import("./Endpoints/trash.endpoints");
  ds = dataSource.AppDataSource;

  await cargarTaller();
});

afterEach(async () => {
  if (ds?.isInitialized) await ds.destroy();
  delete process.env.MECANICA_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("borrar un vehículo", () => {
  it("lo borra de verdad y deja una copia en la papelera", async () => {
    const res = await invocar<Respuesta>("car:delete", "AB123CD");

    expect(res.status).toBe("success");
    // De verdad: no es un borrado lógico. Las consultas agregadas sobre `job`
    // que nunca pasan por `car` —el badge, el dashboard— siguen dando lo mismo
    // que antes sin tener que acordarse de excluir nada.
    expect(await contar("car")).toBe(0);
    expect(await contar("job")).toBe(0);

    const [item] = await papelera();
    expect(item.kind).toBe("car");
    expect(item.label).toContain("AB123CD");
    // Y dice qué arrastra, que es lo que el usuario recupera.
    expect(item.counts.jobs).toBe(2);
  });

  it("recuperarlo lo devuelve con todo lo que tenía", async () => {
    await invocar("car:delete", "AB123CD");
    const [item] = await papelera();

    const res = await invocar<Respuesta>("trash:restore", item.id);

    expect(res.status).toBe("success");
    expect(await contar("car")).toBe(1);
    expect(await contar("job")).toBe(2);
    // El recordatorio de service también: es parte del vehículo.
    expect(await contar("service_reminder")).toBe(1);
    // Con su historial de kilometraje, no un vehículo en blanco.
    const [auto] = (await ds.query(
      "SELECT kmHistory, ownerId FROM car WHERE licensePlate = 'AB123CD'"
    )) as { kmHistory: string; ownerId: string }[];
    expect(JSON.parse(auto.kmHistory)).toHaveLength(1);
    // Y sigue siendo del mismo titular, que nunca se borró.
    expect(auto.ownerId).toBeTruthy();
    // La papelera queda vacía: ya no hay nada que recuperar.
    expect(await papelera()).toHaveLength(0);
  });

  it("no lo recupera si la patente se volvió a usar", async () => {
    await invocar("car:delete", "AB123CD");
    const [item] = await papelera();

    // Mientras tanto se cargó otro auto con la misma patente.
    await invocar("car:create", {
      licensePlate: "AB123CD",
      brand: "Fiat",
      model: "Palio",
      year: 2010,
      kilometers: 10000,
      owner: {
        fullname: "Beto Ruiz",
        phone: "3515199999",
        address: "Calle 2",
        city: "Córdoba",
      },
    });

    const res = await invocar<Respuesta>("trash:restore", item.id);

    expect(res.status).toBe("failed");
    expect(res.message).toContain("AB123CD");
    // Y no dejó nada a medias: sigue habiendo un solo auto, el nuevo.
    expect(await contar("car")).toBe(1);
    const [auto] = (await ds.query("SELECT model FROM car")) as {
      model: string;
    }[];
    // El alta lo guarda en mayúsculas.
    expect(auto.model.toUpperCase()).toBe("PALIO");
    // La copia sigue en la papelera: el usuario decide qué hacer.
    expect(await papelera()).toHaveLength(1);
  });
});

describe("borrar un cliente", () => {
  it("se lleva sus vehículos, y la papelera los devuelve a todos", async () => {
    const [cliente] = (await ds.query("SELECT id FROM client")) as {
      id: string;
    }[];

    await invocar("client:delete", cliente.id);
    expect(await contar("client")).toBe(0);
    expect(await contar("car")).toBe(0);

    const [item] = await papelera();
    expect(item.kind).toBe("client");
    expect(item.counts.cars).toBe(1);
    expect(item.counts.jobs).toBe(2);

    const res = await invocar<Respuesta>("trash:restore", item.id);

    expect(res.status).toBe("success");
    expect(await contar("client")).toBe(1);
    expect(await contar("car")).toBe(1);
    expect(await contar("job")).toBe(2);
  });
});

describe("tirar de la papelera", () => {
  it("es definitivo", async () => {
    await invocar("car:delete", "AB123CD");
    const [item] = await papelera();

    const res = await invocar<Respuesta>("trash:purge", item.id);

    expect(res.status).toBe("success");
    expect(await papelera()).toHaveLength(0);
    expect(await contar("car")).toBe(0);
  });

  it("un id que no existe se contesta, no revienta", async () => {
    const res = await invocar<Respuesta>("trash:purge", "id-que-no-existe");
    expect(res.status).toBe("failed");
  });
});

describe("el tamaño de la papelera", () => {
  it("se conservan los últimos y se tiran los más viejos", async () => {
    // Guarda copias enteras de vehículos con sus trabajos: sin tope crece igual
    // que crecía la carpeta de respaldos antes de tener retención.
    const { podar } = await import("./trash.service");

    for (let i = 0; i < 8; i++) {
      await ds.query(
        `INSERT INTO deleted_item (id, kind, label, payload, deletedAt)
         VALUES (?, 'car', ?, '{}', ?)`,
        [`t${i}`, `auto ${i}`, `2026-09-0${i + 1}T09:00:00.000Z`]
      );
    }

    const tirados = await podar(ds.manager, 3);

    expect(tirados).toBe(5);
    const quedan = (await ds.query(
      "SELECT label FROM deleted_item ORDER BY deletedAt DESC"
    )) as { label: string }[];
    // Los tres más nuevos.
    expect(quedan.map((q) => q.label)).toEqual(["auto 7", "auto 6", "auto 5"]);
  });
});
