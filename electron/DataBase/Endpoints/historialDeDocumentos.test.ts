import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "reflect-metadata";
import type { DataSource } from "typeorm";

/**
 * El historial de documentos: cómo sale ordenado y con qué índice.
 *
 * `document:list` ordena por `createdAt DESC, number DESC` y el único índice de
 * la tabla era el compuesto `(type, number)`, que no sirve para ese orden: cada
 * consulta recorría la tabla entera y ordenaba en memoria. Importa porque la
 * tabla **sólo crece**, por diseño: una fila por documento emitido y ninguna se
 * borra, que es de lo que se trata un correlativo.
 *
 * Medido con 20 000 documentos, el listado pasó de 2,1 ms a 0,46 ms.
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
  dialog: { showSaveDialog: vi.fn(), showErrorBox: vi.fn() },
  shell: { showItemInFolder: vi.fn(), openPath: vi.fn() },
}));

let dir: string;
let ds: DataSource;

const pagina = async (filtros?: unknown) => {
  const handler = stub.handlers.get("document:list");
  if (!handler) throw new Error("No se registró document:list");
  const res = (await handler({}, filtros)) as {
    result: { items: { formatted: string }[]; total: number };
  };
  return res.result;
};

/** Sólo los documentos, que es lo que miran la mayoría de los casos. */
const listar = async (filtros?: unknown) => (await pagina(filtros)).items;

const emitir = (
  id: string,
  tipo: string,
  numero: number,
  fecha: string,
  patente = "AB123CD",
  titular = "Ana Gómez"
) =>
  ds.query(
    `INSERT INTO document (id, type, number, licensePlate, clientName, total, createdAt)
     VALUES (?, ?, ?, ?, ?, 50000, ?)`,
    [id, tipo, numero, patente, titular, fecha]
  );

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-hist-"));
  process.env.MECANICA_DATA_DIR = dir;
  stub.dir = dir;
  stub.handlers.clear();
  vi.resetModules();

  const dataSource = await import("../dataSource");
  await dataSource.AppDataSource.initialize();
  await dataSource.applyPendingMigrations();
  await import("./document.endpoints");
  ds = dataSource.AppDataSource;
});

afterEach(async () => {
  if (ds?.isInitialized) await ds.destroy();
  delete process.env.MECANICA_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

const traer = async (id: string) => {
  const handler = stub.handlers.get("document:get");
  if (!handler) throw new Error("No se registró document:get");
  const res = (await handler({}, id)) as {
    result: { snapshot: unknown; formatted: string } | null;
  };
  return res.result;
};

describe("leer un documento para reimprimirlo", () => {
  it("trae la copia de lo que se imprimió", async () => {
    await ds.query(
      `INSERT INTO document (id, type, number, licensePlate, clientName, total, snapshot, createdAt)
       VALUES ('d1','budget',1,'AB123CD','Ana Gómez',50000, ?, '2026-01-01 09:00:00')`,
      [JSON.stringify({ title: "Presupuesto", jobs: [{ id: "j1" }] })]
    );

    const doc = await traer("d1");

    expect(doc?.formatted).toBe("PRE-000001");
    expect(doc?.snapshot).toMatchObject({ title: "Presupuesto" });
  });

  it("el listado no arrastra las copias, sólo dice si las hay", async () => {
    // Veinte documentos en el historial no tienen por qué traer veinte copias
    // completas para decidir si mostrar un botón.
    await emitir("d1", "budget", 1, "2026-01-01 09:00:00");
    await ds.query(`UPDATE document SET snapshot = ? WHERE id = 'd1'`, [
      JSON.stringify({ title: "Presupuesto", jobs: [] }),
    ]);
    await emitir("d2", "budget", 2, "2026-02-01 09:00:00");

    const lista = (await listar()) as unknown as {
      formatted: string;
      hasSnapshot: boolean;
      snapshot?: unknown;
    }[];

    expect(lista.map((d) => [d.formatted, d.hasSnapshot])).toEqual([
      ["PRE-000002", false],
      ["PRE-000001", true],
    ]);
    expect(lista[0]).not.toHaveProperty("snapshot");
  });

  it("un id que no existe se contesta con null, no revienta", async () => {
    expect(await traer("id-que-no-existe")).toBeNull();
  });
});

describe("el historial de documentos", () => {
  it("sale del más reciente al más viejo, mezclando tipos", async () => {
    await emitir("d1", "budget", 1, "2026-01-01 09:00:00");
    await emitir("d2", "invoice", 1, "2026-03-01 09:00:00");
    await emitir("d3", "budget", 2, "2026-02-01 09:00:00");

    // Por fecha y no por número: el correlativo es **por tipo**, así que
    // ordenar por número intercalaría las dos series.
    expect((await listar()).map((d) => d.formatted)).toEqual([
      "FAC-000001",
      "PRE-000002",
      "PRE-000001",
    ]);
  });

  it("desempata por número cuando la fecha es la misma", async () => {
    await emitir("d1", "budget", 1, "2026-01-01 09:00:00");
    await emitir("d2", "budget", 2, "2026-01-01 09:00:00");

    expect((await listar()).map((d) => d.formatted)).toEqual([
      "PRE-000002",
      "PRE-000001",
    ]);
  });

  it("ese orden tiene su índice", async () => {
    const indices = (await ds.query(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'document'"
    )) as { name: string }[];

    expect(indices.map((i) => i.name)).toContain("IDX_document_created");
  });

  it("y el índice es el que la consulta usa", async () => {
    // Que exista no alcanza: si el planificador no lo elige, no compra nada.
    const plan = (await ds.query(
      `EXPLAIN QUERY PLAN
       SELECT * FROM document ORDER BY createdAt DESC, number DESC LIMIT 20`
    )) as { detail: string }[];

    const detalle = plan.map((p) => p.detail).join(" | ");
    expect(detalle).toContain("IDX_document_created");
    // Y sin ordenado en memoria, que es lo que se estaba pagando.
    expect(detalle).not.toContain("USE TEMP B-TREE");
  });
});

describe("el historial de un vehículo", () => {
  it("incluye el documento consolidado del cliente", async () => {
    // El consolidado guarda todas las patentes en la misma columna. Con
    // igualdad exacta no salía en el historial de ninguno de los dos autos,
    // sólo en el listado general, que es donde el usuario **no** lo busca.
    await emitir("d1", "budget", 1, "2026-01-01 09:00:00", "AB123CD");
    await emitir("d2", "budget", 2, "2026-02-01 09:00:00", "AB123CD, XY456ZW");

    const delPrimero = await listar({ licensePlate: "AB123CD" });
    const delSegundo = await listar({ licensePlate: "XY456ZW" });

    expect(delPrimero.map((d) => d.formatted)).toEqual([
      "PRE-000002",
      "PRE-000001",
    ]);
    // Y también en el del otro auto, que sólo aparece en el consolidado.
    expect(delSegundo.map((d) => d.formatted)).toEqual(["PRE-000002"]);
  });

  it("no confunde una patente con el fragmento de otra", async () => {
    // Lo que haría un `LIKE '%...%'` a secas, que es la forma fácil de
    // arreglar lo de arriba y la que rompe esto.
    await emitir("d1", "budget", 1, "2026-01-01 09:00:00", "AB123CD");

    expect(await listar({ licensePlate: "B123C" })).toEqual([]);
    expect(await listar({ licensePlate: "AB123" })).toEqual([]);
  });

  it("no trae el historial completo cuando no encuentra nada", async () => {
    await emitir("d1", "budget", 1, "2026-01-01 09:00:00", "AB123CD");

    expect(await listar({ licensePlate: "ZZ999ZZ" })).toEqual([]);
  });
});

describe("revisar la numeración", () => {
  const revisar = async () => {
    const handler = stub.handlers.get("document:check-sequence");
    if (!handler) throw new Error("No se registró document:check-sequence");
    const res = (await handler({})) as {
      result: {
        type: string;
        emitted: number;
        last: number;
        missing: number[];
        truncated: boolean;
      }[];
    };
    return Object.fromEntries(res.result.map((r) => [r.type, r]));
  };

  it("con la serie completa no reporta nada", async () => {
    await emitir("d1", "budget", 1, "2026-01-01 09:00:00");
    await emitir("d2", "budget", 2, "2026-01-02 09:00:00");
    await emitir("d3", "budget", 3, "2026-01-03 09:00:00");

    const r = await revisar();

    expect(r.budget.missing).toEqual([]);
    expect(r.budget.emitted).toBe(3);
    expect(r.budget.last).toBe(3);
  });

  it("encuentra el hueco del medio", async () => {
    // El caso real: se tomó el 2 y el archivo nunca se escribió, o el descarte
    // falló. Toda la maquinaria del correlativo existe para que esto no pase, y
    // no había forma de comprobarlo.
    await emitir("d1", "budget", 1, "2026-01-01 09:00:00");
    await emitir("d3", "budget", 3, "2026-01-03 09:00:00");

    const r = await revisar();

    expect(r.budget.missing).toEqual([2]);
    expect(r.budget.emitted).toBe(2);
    expect(r.budget.last).toBe(3);
  });

  it("también avisa si la serie no arranca en 1", async () => {
    await emitir("d1", "budget", 3, "2026-01-03 09:00:00");

    expect((await revisar()).budget.missing).toEqual([1, 2]);
  });

  it("revisa cada tipo por separado", async () => {
    // El correlativo es por tipo: un hueco en presupuestos no es un hueco en
    // facturas, y mezclarlos daría huecos donde no los hay.
    await emitir("d1", "budget", 1, "2026-01-01 09:00:00");
    await emitir("d2", "invoice", 2, "2026-01-02 09:00:00");

    const r = await revisar();

    expect(r.budget.missing).toEqual([]);
    expect(r.invoice.missing).toEqual([1]);
  });

  it("sin documentos no inventa huecos", async () => {
    const r = await revisar();

    expect(r.budget).toMatchObject({ emitted: 0, last: 0, missing: [] });
  });

  it("acota el detalle cuando faltan demasiados", async () => {
    // Con cien huecos, listarlos deja de servir para nada.
    await emitir("d1", "budget", 200, "2026-01-01 09:00:00");

    const r = await revisar();

    expect(r.budget.truncated).toBe(true);
    expect(r.budget.missing).toHaveLength(50);
  });
});

describe("encontrar un documento entre dos años de historial", () => {
  /**
   * El historial aceptaba tipo, patente y un tope de cien. Sin búsqueda por
   * titular, sin rango de fechas y sin paginado, con dos años de presupuestos
   * era una lista de cien y nada más.
   */
  const cargar = async () => {
    await emitir(
      "d1",
      "budget",
      1,
      "2026-01-10 09:00:00",
      "AB123CD",
      "Ana Gómez"
    );
    await emitir(
      "d2",
      "budget",
      2,
      "2026-03-15 09:00:00",
      "XY456ZW",
      "Carlos Bravo"
    );
    await emitir(
      "d3",
      "budget",
      3,
      "2026-06-20 09:00:00",
      "AB123CD",
      "Ana Gómez"
    );
    await emitir(
      "d4",
      "budget",
      4,
      "2026-09-05 09:00:00",
      "ZZ999ZZ",
      "Beatriz Sosa"
    );
  };

  it("busca por titular", async () => {
    await cargar();

    const encontrados = await listar({ search: "carlos" });

    // Sin distinguir mayúsculas: el usuario escribe como le sale.
    expect(encontrados.map((d) => d.formatted)).toEqual(["PRE-000002"]);
  });

  it("busca también por patente, que es el otro dato que se tiene a mano", async () => {
    await cargar();

    expect((await listar({ search: "ZZ999" })).map((d) => d.formatted)).toEqual(
      ["PRE-000004"]
    );
  });

  it("acota por rango de fechas, con los dos extremos adentro", async () => {
    await cargar();

    const enRango = await listar({ from: "2026-03-15", to: "2026-06-20" });

    // Quien filtra "del 15 al 20" espera que el 20 esté: el documento de ese
    // día es de las 09:00 y el tope tiene que llegar al final del día.
    expect(enRango.map((d) => d.formatted)).toEqual([
      "PRE-000003",
      "PRE-000002",
    ]);
  });

  it("pagina, y el total es el de todos los que coinciden", async () => {
    await cargar();

    const primera = await pagina({ page: 1, pageSize: 2 });
    const segunda = await pagina({ page: 2, pageSize: 2 });

    expect(primera.total).toBe(4);
    expect(primera.items.map((d) => d.formatted)).toEqual([
      "PRE-000004",
      "PRE-000003",
    ]);
    expect(segunda.items.map((d) => d.formatted)).toEqual([
      "PRE-000002",
      "PRE-000001",
    ]);
  });

  it("los filtros se combinan", async () => {
    await cargar();

    const r = await pagina({ search: "Ana", from: "2026-05-01" });

    expect(r.total).toBe(1);
    expect(r.items[0].formatted).toBe("PRE-000003");
  });

  it("el término de búsqueda es texto, no comodines", async () => {
    await cargar();

    // Sin escapar, `%` devolvería el historial completo.
    expect(await listar({ search: "%" })).toEqual([]);
    expect(await listar({ search: "_" })).toEqual([]);
  });
});
