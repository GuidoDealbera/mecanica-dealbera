import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "reflect-metadata";
import type { DataSource } from "typeorm";

/**
 * Nombre y teléfono repetidos, por los cuatro caminos que cargan clientes.
 *
 * Los dos campos **eran** `unique` en la base y los cuatro endpoints rechazaban
 * el duplicado. Ya no: dos clientes pueden llamarse igual y una familia puede
 * compartir un número, y ninguna de las dos cosas es un error de carga. Lo que
 * queda en su lugar es un aviso.
 *
 * Lo que se fija acá es que los cuatro caminos se comporten igual —que ninguno
 * siga bloqueando por su cuenta— y que el aviso sirva: que diga **a nombre de
 * quién** está el teléfono, porque sin eso el usuario no sabe si es la misma
 * persona cargada dos veces.
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

/**
 * El `id` del cliente, que es lo que manda el formulario cuando se lo elige del
 * autocompletar. Antes el alta buscaba al titular por nombre y no hacía falta.
 */
const idDe = async (fullname: string) =>
  (
    (await ds.query("SELECT id FROM client WHERE fullname = ?", [
      fullname,
    ])) as { id: string }[]
  )[0].id;

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
  it("client:create acepta el teléfono repetido y avisa de quién es", async () => {
    expect((await invocar("client:create", cliente())).status).toBe("success");

    // Una familia que comparte el número: antes era imposible.
    const res = await invocar(
      "client:create",
      cliente({ fullname: "Carlos Bravo" })
    );

    expect(res.status).toBe("success");
    expect(await cuantosClientes()).toBe(2);
    // Pero el aviso tiene que nombrar al otro cliente, no ser el error de
    // SQLite: es lo único con lo que el usuario puede darse cuenta de que
    // cargó dos veces a la misma persona.
    expect(res.message).toContain("Ana Gómez");
    expect(res.message).not.toMatch(/UNIQUE|SQLITE/i);
  });

  it("client:create acepta dos clientes que se llaman igual", async () => {
    await invocar("client:create", cliente());
    const res = await invocar(
      "client:create",
      cliente({ phone: "3515123457" })
    );

    expect(res.status).toBe("success");
    expect(await cuantosClientes()).toBe(2);
    expect(res.message).toContain("Ana Gómez");
  });

  it("el aviso junta nombre y teléfono cuando coinciden los dos", async () => {
    await invocar("client:create", cliente());

    // Los dos repetidos es la señal más fuerte de que es la misma persona
    // cargada de nuevo. Avisar de uno solo la escondería a medias.
    const res = await invocar("client:create", cliente());

    expect(res.status).toBe("success");
    expect(res.message).toContain("llamado");
    expect(res.message).toContain("teléfono");
  });

  it("client:update avisa al mudarse a un teléfono ya usado", async () => {
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

    expect(res.status).toBe("success");
    expect(res.message).toContain("Ana Gómez");
    expect(res.message).not.toMatch(/UNIQUE|SQLITE/i);
  });

  it("client:update no avisa nada si no cambió nombre ni teléfono", async () => {
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
    // Y sin aviso: chocar consigo mismo no es un duplicado.
    expect(res.message).not.toContain("Atención");
    const [guardado] = (await ds.query(
      "SELECT address FROM client WHERE id = ?",
      [ana.id]
    )) as { address: string }[];
    expect(guardado.address).toBe("Otra dirección 200");
  });

  it("car:create acepta un titular nuevo con un teléfono ya usado, avisando", async () => {
    await invocar("client:create", cliente());

    // El hijo trae el auto y da el teléfono de la casa. El vehículo se registra
    // igual; lo que no puede pasar es que se registre en silencio.
    const res = await invocar("car:create", {
      licensePlate: "AB123CD",
      brand: "Volkswagen",
      model: "Gol",
      year: 2016,
      kilometers: 90000,
      owner: cliente({ fullname: "Carlos Bravo" }),
    });

    expect(res.status).toBe("success");
    expect(res.message).toContain("Ana Gómez");
    expect(await cuantosClientes()).toBe(2);
    expect(
      Number(
        ((await ds.query("SELECT COUNT(*) c FROM car")) as { c: number }[])[0].c
      )
    ).toBe(1);
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
      ownerId: await idDe("Ana Gómez"),
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
      ownerId: await idDe("Ana Gómez"),
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
      ownerId: await idDe("Ana Gómez"),
      owner: cliente({ email: "" }),
    });

    expect(res.status).toBe("success");
  });

  it("car:create sin id no reutiliza al cliente que se llama igual", async () => {
    await invocar("client:create", cliente());

    // Sin `ownerId` el usuario **no** eligió a nadie de la lista: escribió un
    // nombre. Antes el backend lo buscaba por nombre y le asociaba el auto al
    // cliente que ya existía, así que bastaba con escribir el nombre de otro
    // para quedarse con su ficha.
    const res = await invocar("car:create", {
      licensePlate: "AB123CD",
      brand: "Volkswagen",
      model: "Gol",
      year: 2016,
      kilometers: 90000,
      owner: cliente({ phone: "3515199999" }),
    });

    // Ahora se crea una ficha aparte —son dos personas distintas hasta que
    // alguien diga lo contrario— y se avisa del homónimo.
    expect(res.status).toBe("success");
    expect(res.message).toContain("Ana Gómez");
    expect(await cuantosClientes()).toBe(2);

    const [auto] = (await ds.query(
      "SELECT c.id, c.phone FROM car JOIN client c ON c.id = car.ownerId"
    )) as { id: string; phone: string }[];
    // Y el auto queda con el titular recién cargado, no con el que ya estaba.
    expect(auto.phone).toBe("3515199999");
  });

  it("car:create rechaza un titular elegido que no existe", async () => {
    const res = await invocar("car:create", {
      licensePlate: "AB123CD",
      brand: "Volkswagen",
      model: "Gol",
      year: 2016,
      kilometers: 90000,
      ownerId: "id-que-no-existe",
      owner: cliente(),
    });

    // Y no cae en la rama de "cliente nuevo": si el id no resuelve, algo está
    // mal en el pedido y crear otra ficha sería peor que fallar.
    expect(res.status).toBe("failed");
    expect(await cuantosClientes()).toBe(0);
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

  it("car:reassign-owner acepta el titular nuevo con datos ya usados, avisando", async () => {
    await invocar("car:create", {
      licensePlate: "AB123CD",
      brand: "Volkswagen",
      model: "Gol",
      year: 2016,
      kilometers: 90000,
      owner: cliente(),
    });

    // El auto pasa a nombre del hijo, que comparte el teléfono de la casa.
    const res = await invocar("car:reassign-owner", "AB123CD", {
      mode: "new",
      newOwner: cliente({ fullname: "Carlos Bravo" }),
    });

    expect(res.status).toBe("success");
    expect(res.message).toContain("Carlos Bravo");
    expect(res.message).toContain("Ana Gómez");
    expect(await cuantosClientes()).toBe(2);
  });
});
