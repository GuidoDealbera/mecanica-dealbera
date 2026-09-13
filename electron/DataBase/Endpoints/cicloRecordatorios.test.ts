import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "reflect-metadata";
import type { DataSource } from "typeorm";

/**
 * El ciclo de vida de un recordatorio, con foco en **cómo se vuelve**.
 *
 * La tarea D4 del plan decía que descartar un recordatorio sacaba al vehículo
 * del circuito de service "de forma permanente". Se probó y no es así: hay dos
 * caminos de vuelta, y uno es automático. Estos casos existen para que sigan
 * estándolo, porque no había ninguno que los cubriera.
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

const invocar = async <T>(canal: string, ...args: unknown[]): Promise<T> => {
  const handler = stub.handlers.get(canal);
  if (!handler) throw new Error(`No se registró el canal ${canal}`);
  return (await handler({}, ...args)) as T;
};

// Las lecturas devuelven el envelope: se desenvuelve acá, una vez.
const vigentes = async () =>
  (await invocar<{ result: { id: string }[] }>("service:by-car", "AB123CD"))
    .result;

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-ciclo-"));
  process.env.MECANICA_DATA_DIR = dir;
  stub.dir = dir;
  stub.handlers.clear();
  vi.resetModules();

  const dataSource = await import("../dataSource");
  await dataSource.AppDataSource.initialize();
  await dataSource.applyPendingMigrations();
  await import("./car.crud.endpoints");
  await import("./car.jobs.endpoints");
  await import("./service.endpoints");
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
});

afterEach(async () => {
  if (ds?.isInitialized) await ds.destroy();
  delete process.env.MECANICA_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("volver al circuito de service después de descartar", () => {
  it("el vehículo entra al circuito desde el alta", async () => {
    expect(await vigentes()).toHaveLength(1);
  });

  it("descartar lo saca de la bandeja pero no lo borra", async () => {
    const [r] = await vigentes();
    await invocar("service:dismiss", r.id);

    expect(await vigentes()).toHaveLength(0);
    // Sigue estando: la pantalla lo muestra en "Historial completo", que es de
    // donde se lo reactiva.
    const historial = await invocar<{ result: { total: number } }>(
      "service:list",
      { scope: "all", pageSize: 50 }
    );
    expect(historial.result.total).toBe(1);
  });

  it("reactivar lo devuelve, que es la salida manual", async () => {
    const [r] = await vigentes();
    await invocar("service:dismiss", r.id);

    const res = await invocar<{ status: string }>("service:reactivate", r.id);

    expect(res.status).toBe("success");
    // Vuelve *el mismo*: reactivar no inventa uno nuevo, rescata el descartado.
    expect((await vigentes()).map((v) => v.id)).toEqual([r.id]);
  });

  it("cerrar un service lo devuelve solo, que es la salida automática", async () => {
    const [r] = await vigentes();
    await invocar("service:dismiss", r.id);
    expect(await vigentes()).toHaveLength(0);

    // El vehículo vuelve al taller y se le carga un service ya entregado.
    const job = await invocar<{ status: string }>("car:add-job", "AB123CD", {
      price: 50000,
      description: "Service completo",
      isThirdParty: false,
      status: "delivered",
      parts: [],
      isService: true,
    });

    expect(job.status).toBe("success");
    // Esto es lo que hace que descartar no sea una condena: sin ningún trámite,
    // el auto vuelve al circuito en cuanto se le hace un service. Y vuelve con
    // uno **nuevo**, programado desde la fecha del service, no con el
    // descartado: por eso no alcanza con contar, hay que mirar el id.
    const [devuelto] = await vigentes();
    expect(devuelto).toBeDefined();
    expect(devuelto.id).not.toBe(r.id);
  });
});
