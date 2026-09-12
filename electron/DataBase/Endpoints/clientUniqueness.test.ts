import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "reflect-metadata";
import type { DataSource } from "typeorm";

/**
 * Nombre y teléfono repetidos, por los cuatro caminos que cargan clientes.
 *
 * Los dos campos son `unique` en la base. Cuando el endpoint no comprueba
 * antes, el `save` lanza `UNIQUE constraint failed: client.phone` y eso es lo
 * que ve el usuario. `client:create` sólo miraba el nombre y `client:update` no
 * miraba nada, mientras que los de vehículos sí lo hacían: la misma regla
 * escrita dos veces y faltando en otras dos.
 *
 * Lo que se fija acá es que los cuatro respondan igual y con un mensaje que
 * sirva —que diga **a nombre de quién** está el teléfono—, porque sin eso el
 * usuario no sabe si es la misma persona cargada dos veces.
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

/** Ver el comentario de `PLAZO` en `applyPendingMigrations.test.ts`. */
const PLAZO = 60_000;

type Respuesta = { status: string; message: string; result?: unknown };

const invocar = async (canal: string, ...args: unknown[]) => {
  const handler = stub.handlers.get(canal);
  if (!handler) throw new Error(`No se registró el canal ${canal}`);
  return (await handler({}, ...args)) as Respuesta;
};

const preparar = async () => {
  process.env.MECANICA_DATA_DIR = dir;
  stub.dir = dir;
  stub.handlers.clear();
  vi.resetModules();

  const dataSource = await import("../dataSource");
  await dataSource.AppDataSource.initialize();
  await dataSource.applyPendingMigrations();
  await import("./client.endpoints");
  await import("./car.crud.endpoints");

  ds = dataSource.AppDataSource;
};

const cliente = (overrides: Record<string, unknown> = {}) => ({
  fullname: "Ana Gómez",
  phone: "3515123456",
  address: "San Martín 100",
  city: "Córdoba",
  ...overrides,
});

const cuantosClientes = async () =>
  Number(
    ((await ds.query("SELECT COUNT(*) c FROM client")) as { c: number }[])[0].c
  );

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-clientes-"));
  await preparar();
});

afterEach(async () => {
  if (ds?.isInitialized) await ds.destroy();
  delete process.env.MECANICA_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("unicidad de clientes", () => {
  it(
    "client:create rechaza el teléfono repetido diciendo de quién es",
    async () => {
      expect((await invocar("client:create", cliente())).status).toBe(
        "success"
      );

      const res = await invocar(
        "client:create",
        cliente({ fullname: "Carlos Bravo" })
      );

      expect(res.status).toBe("failed");
      // El mensaje tiene que nombrar al otro cliente, no ser el error de SQLite.
      expect(res.message).toContain("Ana Gómez");
      expect(res.message).not.toMatch(/UNIQUE|SQLITE/i);
      expect(await cuantosClientes()).toBe(1);
    },
    PLAZO
  );

  it(
    "client:create sigue rechazando el nombre repetido",
    async () => {
      await invocar("client:create", cliente());
      const res = await invocar(
        "client:create",
        cliente({ phone: "3515123457" })
      );

      expect(res.status).toBe("failed");
      expect(res.message).toContain("Ana Gómez");
      expect(await cuantosClientes()).toBe(1);
    },
    PLAZO
  );

  it(
    "client:update rechaza mudarse a un teléfono ya tomado",
    async () => {
      await invocar("client:create", cliente());
      await invocar(
        "client:create",
        cliente({ fullname: "Carlos Bravo", phone: "3515123457" })
      );
      const [carlos] = (await ds.query(
        "SELECT id FROM client WHERE fullname = 'Carlos Bravo'"
      )) as { id: string }[];

      const res = await invocar("client:update", {
        id: carlos.id,
        fullname: "Carlos Bravo",
        phone: "3515123456",
        address: "Rivadavia 50",
        city: "Córdoba",
      });

      expect(res.status).toBe("failed");
      expect(res.message).toContain("Ana Gómez");
      expect(res.message).not.toMatch(/UNIQUE|SQLITE/i);
    },
    PLAZO
  );

  it(
    "client:update deja guardar sin cambiar nombre ni teléfono",
    async () => {
      await invocar("client:create", cliente());
      const [ana] = (await ds.query(
        "SELECT id FROM client WHERE fullname = 'Ana Gómez'"
      )) as { id: string }[];

      // El caso que rompería una comprobación ingenua: el cliente choca
      // consigo mismo si no se lo excluye de la búsqueda.
      const res = await invocar("client:update", {
        id: ana.id,
        fullname: "Ana Gómez",
        phone: "3515123456",
        address: "Otra dirección 200",
        city: "Córdoba",
      });

      expect(res.status).toBe("success");
      const [guardado] = (await ds.query(
        "SELECT address FROM client WHERE id = ?",
        [ana.id]
      )) as { address: string }[];
      expect(guardado.address).toBe("Otra dirección 200");
    },
    PLAZO
  );

  it(
    "car:create rechaza el titular con un teléfono ya tomado",
    async () => {
      await invocar("client:create", cliente());

      const res = await invocar("car:create", {
        licensePlate: "AB123CD",
        brand: "Volkswagen",
        model: "Gol",
        year: 2016,
        kilometers: 90000,
        owner: cliente({ fullname: "Carlos Bravo" }),
      });

      expect(res.status).toBe("failed");
      expect(res.message).toContain("Ana Gómez");
      expect(
        Number(
          ((await ds.query("SELECT COUNT(*) c FROM car")) as { c: number }[])[0]
            .c
        )
      ).toBe(0);
    },
    PLAZO
  );

  it(
    "car:reassign-owner rechaza el titular nuevo con datos ya tomados",
    async () => {
      await invocar("car:create", {
        licensePlate: "AB123CD",
        brand: "Volkswagen",
        model: "Gol",
        year: 2016,
        kilometers: 90000,
        owner: cliente(),
      });

      const res = await invocar("car:reassign-owner", "AB123CD", {
        mode: "new",
        newOwner: cliente({ fullname: "Carlos Bravo" }),
      });

      expect(res.status).toBe("failed");
      expect(res.message).toContain("Ana Gómez");
      expect(await cuantosClientes()).toBe(1);
    },
    PLAZO
  );
});
