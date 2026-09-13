import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "reflect-metadata";
import type { DataSource } from "typeorm";
import { JobStatus } from "../../../src/Types/apiTypes";

/**
 * Lo que se puede guardar como trabajo.
 *
 * El endpoint no validaba nada: hacía `price: jobDto.price as number`, que es un
 * cast y no comprueba nada en ejecución. El DTO con los decoradores ya estaba
 * escrito y no lo usaba nadie.
 *
 * Los tres casos de abajo no son hipótesis: son las tres formas concretas en que
 * un dato malo se vuelve visible para el usuario —una fila invisible en el
 * listado, un total `NaN` impreso en una factura, un precio que es una cadena
 * vacía en una columna de enteros—.
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
  dialog: { showErrorBox: vi.fn() },
  shell: { showItemInFolder: vi.fn(), openPath: vi.fn() },
}));

let dir: string;
let ds: DataSource;

type Respuesta = { status: string; message: string; result?: unknown };

const invocar = async (canal: string, ...args: unknown[]) => {
  const handler = stub.handlers.get(canal);
  if (!handler) throw new Error(`No se registró el canal ${canal}`);
  return (await handler({}, ...args)) as Respuesta;
};

/** Un trabajo válido; cada caso rompe sólo el campo que le interesa. */
const trabajo = (overrides: Record<string, unknown> = {}) => ({
  price: 50000,
  description: "Cambio de aceite",
  isThirdParty: false,
  status: JobStatus.PENDING,
  parts: [],
  ...overrides,
});

const cuantosTrabajos = async () =>
  Number(
    ((await ds.query("SELECT COUNT(*) c FROM job")) as { c: number }[])[0].c
  );

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-trabajos-"));
  process.env.MECANICA_DATA_DIR = dir;
  stub.dir = dir;
  stub.handlers.clear();
  vi.resetModules();

  const dataSource = await import("../dataSource");
  await dataSource.AppDataSource.initialize();
  await dataSource.applyPendingMigrations();
  await import("./car.jobs.endpoints");
  ds = dataSource.AppDataSource;

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

describe("car:add-job", () => {
  it("guarda un trabajo válido", async () => {
    const res = await invocar(
      "car:add-job",
      "AB123CD",
      trabajo({ parts: [{ name: "Filtro", price: 12000 }] })
    );

    expect(res.status).toBe("success");
    expect(await cuantosTrabajos()).toBe(1);
  });

  it("rechaza un estado que no existe", async () => {
    // La columna es `varchar` sin `CHECK`: un estado inventado se guardaba, y
    // después ninguna pantalla sabía pintarlo ni ningún filtro lo encontraba.
    // El trabajo quedaba invisible en los listados, que es peor que perderlo.
    const res = await invocar(
      "car:add-job",
      "AB123CD",
      trabajo({ status: "inventado" })
    );

    expect(res.status).toBe("failed");
    expect(res.message).toMatch(/estado/i);
    expect(await cuantosTrabajos()).toBe(0);
  });

  it("rechaza un precio que no es un entero no negativo", async () => {
    for (const price of ["", -100, 1234.5, "mil", null]) {
      const res = await invocar("car:add-job", "AB123CD", trabajo({ price }));
      expect(res.status, `precio ${JSON.stringify(price)}`).toBe("failed");
    }
    expect(await cuantosTrabajos()).toBe(0);
  });

  it("rechaza un repuesto cuyo precio no es un número", async () => {
    // El total del documento suma estos precios con un `reduce`: un precio que
    // es texto lo convierte en `NaN`, y eso sale impreso en la factura.
    const res = await invocar(
      "car:add-job",
      "AB123CD",
      trabajo({ parts: [{ name: "Filtro", price: "carísimo" }] })
    );

    expect(res.status).toBe("failed");
    expect(res.message).toMatch(/repuesto/i);
    expect(await cuantosTrabajos()).toBe(0);
  });

  it("rechaza un repuesto sin nombre y uno con precio negativo", async () => {
    const sinNombre = await invocar(
      "car:add-job",
      "AB123CD",
      trabajo({ parts: [{ name: "  ", price: 100 }] })
    );
    expect(sinNombre.status).toBe("failed");

    const negativo = await invocar(
      "car:add-job",
      "AB123CD",
      trabajo({ parts: [{ name: "Filtro", price: -1 }] })
    );
    expect(negativo.status).toBe("failed");

    expect(await cuantosTrabajos()).toBe(0);
  });

  it("rechaza un trabajo sin descripción", async () => {
    const res = await invocar(
      "car:add-job",
      "AB123CD",
      trabajo({ description: "" })
    );

    expect(res.status).toBe("failed");
    expect(await cuantosTrabajos()).toBe(0);
  });

  it("descarta las propiedades que nadie declaró", async () => {
    // `whitelist: true`: lo que no tiene decorador de validación no entra.
    const res = await invocar(
      "car:add-job",
      "AB123CD",
      trabajo({ id: "un-id-elegido-por-el-cliente", carId: "otro-auto" })
    );

    expect(res.status).toBe("success");
    const [fila] = (await ds.query("SELECT id, carId FROM job")) as {
      id: string;
      carId: string;
    }[];
    expect(fila.id).not.toBe("un-id-elegido-por-el-cliente");
    expect(fila.carId).toBe("auto-1");
  });

  it("no guarda nada si el vehículo no existe", async () => {
    const res = await invocar("car:add-job", "ZZ999ZZ", trabajo());

    expect(res.status).toBe("failed");
    expect(await cuantosTrabajos()).toBe(0);
  });
});

describe("car:update-job", () => {
  /** Deja un trabajo cargado y devuelve su id. */
  const trabajoExistente = async () => {
    const res = await invocar("car:add-job", "AB123CD", trabajo());
    expect(res.status).toBe("success");
    return (res.result as { id: string }).id;
  };

  it("aplica sólo los campos que vienen", async () => {
    const id = await trabajoExistente();

    const res = await invocar("car:update-job", "AB123CD", id, {
      status: JobStatus.COMPLETED,
    });

    expect(res.status).toBe("success");
    const [fila] = (await ds.query(
      "SELECT status, price, description FROM job WHERE id = ?",
      [id]
    )) as { status: string; price: number; description: string }[];
    expect(fila.status).toBe(JobStatus.COMPLETED);
    // Lo que no vino no se toca: se puede cambiar el estado sin remandar todo.
    expect(fila.price).toBe(50000);
    expect(fila.description).toBe("Cambio de aceite");
  });

  it("corrige la descripción, que es lo que sale impreso", async () => {
    // No se podía. Un error de tipeo en la descripción salía en el presupuesto
    // del cliente y la única salida era borrar el trabajo y cargarlo de nuevo:
    // cambia de id y de fecha, y si ya se emitió un documento, deja de existir
    // el trabajo que lo respaldaba.
    const id = await trabajoExistente();

    const res = await invocar("car:update-job", "AB123CD", id, {
      description: "Cambio de correa de distribución",
      isThirdParty: true,
    });

    expect(res.status).toBe("success");
    const [fila] = (await ds.query(
      "SELECT description, isThirdParty FROM job WHERE id = ?",
      [id]
    )) as { description: string; isThirdParty: number }[];
    expect(fila.description).toBe("Cambio de correa de distribución");
    // El documento separa el total propio del de terceros, así que esto también
    // cambia lo que dice el papel.
    expect(Number(fila.isThirdParty)).toBe(1);
  });

  it("no deja dejarla vacía ni de puros espacios", async () => {
    // `@IsNotEmpty` rechaza "" pero no "   ", y una descripción de espacios
    // sale como un renglón en blanco en el documento.
    const id = await trabajoExistente();

    for (const description of ["", "   "]) {
      const res = await invocar("car:update-job", "AB123CD", id, {
        description,
      });
      expect(res.status, JSON.stringify(description)).toBe("failed");
    }

    const [fila] = (await ds.query("SELECT description FROM job WHERE id = ?", [
      id,
    ])) as { description: string }[];
    expect(fila.description).toBe("Cambio de aceite");
  });

  it("recorta la descripción antes de guardarla", async () => {
    const id = await trabajoExistente();

    await invocar("car:update-job", "AB123CD", id, {
      description: "  Alineación y balanceo  ",
    });

    const [fila] = (await ds.query("SELECT description FROM job WHERE id = ?", [
      id,
    ])) as { description: string }[];
    expect(fila.description).toBe("Alineación y balanceo");
  });

  it("no deja entrar por la ventana lo que el alta rechaza", async () => {
    const id = await trabajoExistente();

    const casos: Record<string, unknown>[] = [
      { status: "inventado" },
      { price: -100 },
      { price: 1234.5 },
      { parts: [{ name: "Filtro", price: "carísimo" }] },
      { parts: [{ name: "   ", price: 100 }] },
    ];

    for (const cambio of casos) {
      const res = await invocar("car:update-job", "AB123CD", id, cambio);
      expect(res.status, JSON.stringify(cambio)).toBe("failed");
    }

    // Y el trabajo quedó como estaba.
    const [fila] = (await ds.query(
      "SELECT status, price FROM job WHERE id = ?",
      [id]
    )) as { status: string; price: number }[];
    expect(fila.status).toBe(JobStatus.PENDING);
    expect(fila.price).toBe(50000);
  });

  it("no deja editar un trabajo de otro vehículo", async () => {
    const id = await trabajoExistente();
    await ds.query(
      `INSERT INTO car (id, licensePlate, model, brand, year, kilometers, kmHistory, createdAt, updatedAt, ownerId)
         VALUES ('auto-2', 'XY456ZW', 'PALIO', 'Fiat', 2010, 10000, '[]', '2026-01-01 09:00:00', '2026-01-01 09:00:00', 'cli-1')`
    );

    const res = await invocar("car:update-job", "XY456ZW", id, {
      price: 1,
    });

    expect(res.status).toBe("failed");
  });
});
