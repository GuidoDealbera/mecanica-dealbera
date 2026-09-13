import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "reflect-metadata";
import type { DataSource } from "typeorm";
import { DocumentType } from "../../../src/Types/apiTypes";

/**
 * Emitir un documento.
 *
 * El total que se guarda es el **snapshot** de lo que se entregó, y el registro
 * es de sólo lectura: lo que entre mal ahí no se corrige después. El endpoint
 * hacía `Math.round(Number(body.total) || 0)`, que deja pasar un negativo y
 * convierte cualquier basura en cero.
 *
 * De paso queda cubierto el correlativo, que es la razón de existir de la tabla.
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

/** La copia de lo impreso, que es obligatoria: sin ella no se puede reimprimir. */
const copia = () => ({
  title: "Presupuesto de Trabajo",
  car: {
    licensePlate: "AB123CD",
    brand: "Volkswagen",
    model: "Gol",
    year: 2016,
    kilometers: 90000,
    owner: {
      fullname: "Ana Gómez",
      phone: "3515123456",
      address: "San Martín 100",
      city: "Córdoba",
    },
  },
  jobs: [
    {
      id: "j1",
      description: "Cambio de aceite",
      price: 125000,
      isThirdParty: false,
      parts: [],
    },
  ],
  totals: {
    laborTotal: 125000,
    partsGrandTotal: 0,
    thirdPartyTotal: 0,
    ownTotal: 125000,
    total: 125000,
  },
});

const emitir = (overrides: Record<string, unknown> = {}) => ({
  type: DocumentType.BUDGET,
  licensePlate: "AB123CD",
  clientName: "Ana Gómez",
  total: 125000,
  snapshot: copia(),
  ...overrides,
});

const cuantosDocumentos = async () =>
  Number(
    ((await ds.query("SELECT COUNT(*) c FROM document")) as { c: number }[])[0]
      .c
  );

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-documentos-"));
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

describe("document:issue", () => {
  it("emite y numera", async () => {
    const res = await invocar("document:issue", emitir());

    expect(res.status).toBe("success");
    expect(res.result).toMatchObject({ number: 1, formatted: "PRE-000001" });
  });

  it("rechaza un total negativo", async () => {
    const res = await invocar("document:issue", emitir({ total: -1 }));

    expect(res.status).toBe("failed");
    expect(await cuantosDocumentos()).toBe(0);
  });

  it("rechaza un total que no es un número, en vez de guardar cero", async () => {
    for (const total of ["mucha plata", null, undefined, NaN, {}]) {
      const res = await invocar("document:issue", emitir({ total }));
      expect(res.status, JSON.stringify(total)).toBe("failed");
    }
    expect(await cuantosDocumentos()).toBe(0);
  });

  it("acepta un total en cero, que es un caso real", async () => {
    // Un trabajo de garantía o de cortesía se factura en cero.
    const res = await invocar("document:issue", emitir({ total: 0 }));
    expect(res.status).toBe("success");
  });

  it("guarda la copia de lo que se imprimió", async () => {
    const res = await invocar("document:issue", emitir());
    expect(res.status).toBe("success");

    // Es la razón de ser de esta tabla: sin la copia, el historial dice que se
    // emitió un documento y no hay forma de volver a generarlo.
    const [fila] = (await ds.query(
      "SELECT snapshot FROM document WHERE number = 1"
    )) as { snapshot: string | null }[];
    expect(fila.snapshot).toBeTruthy();
    expect(JSON.parse(fila.snapshot!).jobs[0].description).toBe(
      "Cambio de aceite"
    );
  });

  it("no emite sin la copia", async () => {
    for (const rota of [undefined, null, "una copia", {}, { jobs: [] }]) {
      const res = await invocar("document:issue", emitir({ snapshot: rota }));
      expect(res.status, JSON.stringify(rota)).toBe("failed");
    }
    // Y no quema ningún número por el camino.
    expect(await cuantosDocumentos()).toBe(0);
  });

  it("rechaza una copia descomunal en vez de guardarla para siempre", async () => {
    // La tabla no se borra nunca, así que una copia por documento se acumula.
    const enorme = copia();
    enorme.jobs[0].description = "x".repeat(300_000);

    const res = await invocar("document:issue", emitir({ snapshot: enorme }));

    expect(res.status).toBe("failed");
    expect(await cuantosDocumentos()).toBe(0);
  });

  it("rechaza un tipo que no existe", async () => {
    const res = await invocar("document:issue", emitir({ type: "recibo" }));

    expect(res.status).toBe("failed");
    expect(await cuantosDocumentos()).toBe(0);
  });

  it("el correlativo es por tipo y no se saltea", async () => {
    await invocar("document:issue", emitir());
    await invocar("document:issue", emitir());
    const factura = await invocar(
      "document:issue",
      emitir({ type: DocumentType.INVOICE })
    );

    // Presupuestos y facturas llevan series separadas.
    expect(factura.result).toMatchObject({
      number: 1,
      formatted: "FAC-000001",
    });

    const tercero = await invocar("document:issue", emitir());
    expect(tercero.result).toMatchObject({ number: 3 });
  });

  it("un rechazo no quema un número", async () => {
    await invocar("document:issue", emitir());
    await invocar("document:issue", emitir({ total: -5 }));

    const siguiente = await invocar("document:issue", emitir());
    expect(siguiente.result).toMatchObject({ number: 2 });
  });
});
