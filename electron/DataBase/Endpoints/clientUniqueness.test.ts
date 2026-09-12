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
  it("client:create rechaza el teléfono repetido diciendo de quién es", async () => {
    expect((await invocar("client:create", cliente())).status).toBe("success");

    const res = await invocar(
      "client:create",
      cliente({ fullname: "Carlos Bravo" })
    );

    expect(res.status).toBe("failed");
    // El mensaje tiene que nombrar al otro cliente, no ser el error de SQLite.
    expect(res.message).toContain("Ana Gómez");
    expect(res.message).not.toMatch(/UNIQUE|SQLITE/i);
    expect(await cuantosClientes()).toBe(1);
  });

  it("client:create sigue rechazando el nombre repetido", async () => {
    await invocar("client:create", cliente());
    const res = await invocar(
      "client:create",
      cliente({ phone: "3515123457" })
    );

    expect(res.status).toBe("failed");
    expect(res.message).toContain("Ana Gómez");
    expect(await cuantosClientes()).toBe(1);
  });

  it("client:update rechaza mudarse a un teléfono ya tomado", async () => {
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
  });

  it("client:update deja guardar sin cambiar nombre ni teléfono", async () => {
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
  });

  it("car:create rechaza el titular con un teléfono ya tomado", async () => {
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
        ((await ds.query("SELECT COUNT(*) c FROM car")) as { c: number }[])[0].c
      )
    ).toBe(0);
  });

  it("car:create no descarta en silencio los datos del titular recién cargados", async () => {
    await invocar("client:create", cliente());

    // Mismo nombre, otro teléfono: o es otra persona que se llama igual, o es
    // la misma que cambió de número. En los dos casos, guardar el auto a
    // nombre del cliente viejo y tirar el dato nuevo es lo peor que se puede
    // hacer: después se llama a la persona equivocada.
    const res = await invocar("car:create", {
      licensePlate: "AB123CD",
      brand: "Volkswagen",
      model: "Gol",
      year: 2016,
      kilometers: 90000,
      owner: cliente({ phone: "3515123457" }),
    });

    expect(res.status).toBe("failed");
    expect(res.message).toContain("el teléfono");
    expect(
      Number(
        ((await ds.query("SELECT COUNT(*) c FROM car")) as { c: number }[])[0].c
      )
    ).toBe(0);
  });

  it("car:create asocia el vehículo al cliente existente cuando los datos son los suyos", async () => {
    await invocar("client:create", cliente());

    // El flujo normal: se elige el cliente del autocompletar, que rellena sus
    // datos, así que llegan idénticos. Esto **no** puede romperse.
    const res = await invocar("car:create", {
      licensePlate: "AB123CD",
      brand: "Volkswagen",
      model: "Gol",
      year: 2016,
      kilometers: 90000,
      owner: cliente(),
    });

    expect(res.status).toBe("success");
    expect(await cuantosClientes()).toBe(1);
    const [auto] = (await ds.query(
      "SELECT c.fullname FROM car JOIN client c ON c.id = car.ownerId"
    )) as { fullname: string }[];
    expect(auto.fullname).toBe("Ana Gómez");
  });

  it("car:create no se queja por un campo que el usuario dejó en blanco", async () => {
    await invocar("client:create", cliente({ email: "ana@ejemplo.com" }));

    // Dejar un campo vacío es no haberlo retipeado, no pedir que se borre.
    const res = await invocar("car:create", {
      licensePlate: "AB123CD",
      brand: "Volkswagen",
      model: "Gol",
      year: 2016,
      kilometers: 90000,
      owner: cliente({ email: "" }),
    });

    expect(res.status).toBe("success");
  });

  it("car:reassign-owner valida el titular nuevo igual que el alta", async () => {
    await invocar("car:create", {
      licensePlate: "AB123CD",
      brand: "Volkswagen",
      model: "Gol",
      year: 2016,
      kilometers: 90000,
      owner: cliente(),
    });

    // Lo mismo que `car:create` rechaza. Antes este camino lo aceptaba, y
    // quedaban dos calidades de dato según por dónde se hubiera entrado.
    const casos: Record<string, unknown>[] = [
      { phone: "no es un teléfono" },
      { address: "" },
      { city: "" },
      { fullname: "" },
      { email: "esto no es un correo" },
    ];

    for (const roto of casos) {
      const res = await invocar("car:reassign-owner", "AB123CD", {
        mode: "new",
        newOwner: cliente({ fullname: "Carlos Bravo", ...roto }),
      });
      expect(res.status, JSON.stringify(roto)).toBe("failed");
    }

    expect(await cuantosClientes()).toBe(1);
  });

  it("car:reassign-owner rechaza un modo que no existe", async () => {
    await invocar("car:create", {
      licensePlate: "AB123CD",
      brand: "Volkswagen",
      model: "Gol",
      year: 2016,
      kilometers: 90000,
      owner: cliente(),
    });

    // Con un modo cualquiera se tomaba la rama de "cliente nuevo" con un
    // `newOwner` que podía no existir.
    const res = await invocar("car:reassign-owner", "AB123CD", {
      mode: "cualquiera",
    });

    expect(res.status).toBe("failed");
    expect(await cuantosClientes()).toBe(1);
  });

  it("car:reassign-owner rechaza el titular nuevo con datos ya tomados", async () => {
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
  });
});
