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

const listar = async (filtros?: unknown) => {
  const handler = stub.handlers.get("document:list");
  if (!handler) throw new Error("No se registró document:list");
  const res = (await handler({}, filtros)) as {
    result: { formatted: string }[];
  };
  return res.result;
};

const emitir = (id: string, tipo: string, numero: number, fecha: string) =>
  ds.query(
    `INSERT INTO document (id, type, number, licensePlate, clientName, total, createdAt)
     VALUES (?, ?, ?, 'AB123CD', 'Ana Gómez', 50000, ?)`,
    [id, tipo, numero, fecha]
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
