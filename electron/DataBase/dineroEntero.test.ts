import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "reflect-metadata";
import type { DataSource } from "typeorm";

/**
 * El dinero son pesos enteros, también en los repuestos.
 *
 * `job.price` y `document.total` son columnas `integer` y `formatARS` imprime
 * sin decimales, así que la representación ya estaba decidida. La única que se
 * había escapado es el precio de los repuestos, que vive dentro de un
 * `simple-json` y aceptaba cualquier número: los centavos entraban, sumaban al
 * total y desaparecían recién al imprimir.
 *
 * Se prueban las dos mitades del arreglo: que el borde ya no los deje entrar, y
 * que los que ya estaban guardados se redondeen —sin eso, editar un trabajo
 * viejo fallaría con un error sobre un dato que el usuario nunca escribió—.
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
    showMessageBox: vi.fn(),
    showMessageBoxSync: vi.fn(),
  },
  shell: { showItemInFolder: vi.fn(), openPath: vi.fn() },
}));

let dir: string;
let ds: DataSource;

const invocar = async (canal: string, ...args: unknown[]) => {
  const handler = stub.handlers.get(canal);
  if (!handler) throw new Error(`No se registró el canal ${canal}`);
  return (await handler({}, ...args)) as { status: string; message: string };
};

const cargar = async () => {
  process.env.MECANICA_DATA_DIR = dir;
  stub.dir = dir;
  stub.handlers.clear();
  vi.resetModules();
  return await import("./dataSource");
};

const alDia = async () => {
  const { AppDataSource, applyPendingMigrations } = await cargar();
  await AppDataSource.initialize();
  await applyPendingMigrations();
  ds = AppDataSource;
};

const conVehiculo = async () => {
  await import("./Endpoints/car.crud.endpoints");
  await import("./Endpoints/car.jobs.endpoints");
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
};

const trabajo = (parts: { name: string; price: number }[]) => ({
  price: 50000,
  description: "Service completo",
  isThirdParty: false,
  status: "pending",
  parts,
});

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-dinero-"));
});

afterEach(async () => {
  if (ds?.isInitialized) await ds.destroy();
  delete process.env.MECANICA_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("el precio de un repuesto es un entero", () => {
  it("el alta de un trabajo rechaza los centavos", async () => {
    await alDia();
    await conVehiculo();

    const res = await invocar(
      "car:add-job",
      "AB123CD",
      trabajo([{ name: "Filtro de aceite", price: 1234.56 }])
    );

    expect(res.status).toBe("failed");
    expect(res.message).toMatch(/entero/i);
  });

  it("y acepta el mismo importe sin centavos", async () => {
    await alDia();
    await conVehiculo();

    const res = await invocar(
      "car:add-job",
      "AB123CD",
      trabajo([{ name: "Filtro de aceite", price: 1235 }])
    );

    expect(res.status).toBe("success");
  });
});

describe("la migración que redondea lo que ya estaba guardado", () => {
  /** Inserta un trabajo con los repuestos crudos, sin pasar por el endpoint. */
  const insertarTrabajoCrudo = async (id: string, partsJson: string) => {
    await ds.query(
      `INSERT INTO client (id, fullname, phone, address, city, isActive, createdAt)
       VALUES ('cli-1', 'Ana Gómez', '3515123456', 'Calle 1', 'Córdoba', 1, '2026-01-01 09:00:00')
       ON CONFLICT DO NOTHING`
    );
    await ds.query(
      `INSERT INTO car (id, licensePlate, model, brand, year, kilometers, kmHistory, createdAt, updatedAt, ownerId)
       VALUES ('auto-1', 'AB123CD', 'GOL', 'Volkswagen', 2016, 90000, '[]', '2026-01-01 09:00:00', '2026-01-01 09:00:00', 'cli-1')
       ON CONFLICT DO NOTHING`
    );
    await ds.query(
      `INSERT INTO job (id, price, description, isThirdParty, status, parts, createdAt, updatedAt, carId)
       VALUES (?, 50000, 'Service', 0, 'pending', ?, '2026-01-01 09:00:00', '2026-01-01 09:00:00', 'auto-1')`,
      [id, partsJson]
    );
  };

  /** Aplica sólo esta migración sobre una base que ya tiene el resto. */
  const migrar = async () => {
    const { RoundPartPrices1700000014000 } =
      await import("./Migrations/RoundPartPrices1700000014000");
    const qr = ds.createQueryRunner();
    await new RoundPartPrices1700000014000().up(qr);
    await qr.release();
  };

  const partsDe = async (id: string) =>
    JSON.parse(
      (
        (await ds.query("SELECT parts FROM job WHERE id = ?", [id])) as {
          parts: string;
        }[]
      )[0].parts
    );

  it("redondea los centavos y conserva los nombres", async () => {
    await alDia();
    await insertarTrabajoCrudo(
      "job-1",
      JSON.stringify([
        { name: "Filtro de aceite", price: 1234.56 },
        { name: "Bujías", price: 999.4 },
      ])
    );

    await migrar();

    expect(await partsDe("job-1")).toEqual([
      { name: "Filtro de aceite", price: 1235 },
      { name: "Bujías", price: 999 },
    ]);
  });

  it("no toca los trabajos que ya estaban en pesos enteros", async () => {
    await alDia();
    const enteros = JSON.stringify([{ name: "Correa", price: 8000 }]);
    await insertarTrabajoCrudo("job-1", enteros);

    await migrar();

    // Se compara el texto y no el objeto: reescribir el JSON de filas que no lo
    // necesitan le cambiaría el formato a datos que están bien.
    const [fila] = (await ds.query(
      "SELECT parts FROM job WHERE id = 'job-1'"
    )) as { parts: string }[];
    expect(fila.parts).toBe(enteros);
  });

  it("sobrevive a un trabajo sin repuestos", async () => {
    await alDia();
    await insertarTrabajoCrudo("job-1", JSON.stringify([]));
    await ds.query(
      `INSERT INTO job (id, price, description, isThirdParty, status, parts, createdAt, updatedAt, carId)
       VALUES ('job-2', 1000, 'Sin repuestos', 0, 'pending', NULL, '2026-01-01 09:00:00', '2026-01-01 09:00:00', 'auto-1')`
    );

    await expect(migrar()).resolves.toBeUndefined();

    const [sinRepuestos] = (await ds.query(
      "SELECT parts FROM job WHERE id = 'job-2'"
    )) as { parts: string | null }[];
    expect(sinRepuestos.parts).toBeNull();
  });
});
