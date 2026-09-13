import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "reflect-metadata";
import type { DataSource } from "typeorm";

/**
 * Guardar el PDF de un documento emitido.
 *
 * Antes lo hacía `doc.save()` de jsPDF —la descarga del navegador—: el archivo
 * caía en la carpeta de descargas sin diálogo y, sobre todo, **sin devolver si
 * había funcionado**. Un disco lleno o una carpeta sin permisos no se veían, y
 * como no se veían, no disparaban el descarte del documento: el número quedaba
 * quemado y no existía ningún PDF.
 *
 * Lo que se fija acá es que las tres salidas —guardado, cancelado y fallido— se
 * distingan, porque de eso depende que el correlativo no quede con huecos.
 */

const stub = vi.hoisted(() => ({
  dir: "",
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  /** Qué devuelve el diálogo de guardado en este caso. */
  destino: null as string | null,
  revelados: [] as string[],
}));

vi.mock("electron", () => ({
  app: { getPath: () => stub.dir, getVersion: () => "2.0.0" },
  ipcMain: {
    handle: (canal: string, handler: (...args: unknown[]) => unknown) => {
      stub.handlers.set(canal, handler);
    },
  },
  dialog: {
    showSaveDialog: vi.fn(async () => ({
      filePath: stub.destino ?? undefined,
    })),
    showErrorBox: vi.fn(),
  },
  shell: {
    showItemInFolder: vi.fn((p: string) => stub.revelados.push(p)),
    openPath: vi.fn(),
  },
}));

let dir: string;
let ds: DataSource;

type Respuesta = {
  status: string;
  message: string;
  result?: { filePath: string };
};

const guardar = async (payload: unknown) => {
  const handler = stub.handlers.get("document:save-pdf");
  if (!handler) throw new Error("No se registró document:save-pdf");
  return (await handler({}, payload)) as Respuesta;
};

const contenido = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-pdf-"));
  process.env.MECANICA_DATA_DIR = dir;
  stub.dir = dir;
  stub.destino = null;
  stub.revelados = [];
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

describe("guardar el PDF", () => {
  it("escribe el archivo y lo muestra en la carpeta", async () => {
    const destino = path.join(dir, "0001_Factura_AB123CD.pdf");
    stub.destino = destino;

    const res = await guardar({
      defaultName: "0001_Factura_AB123CD.pdf",
      bytes: contenido,
    });

    expect(res.status).toBe("success");
    expect(res.result?.filePath).toBe(destino);
    expect(new Uint8Array(fs.readFileSync(destino))).toEqual(contenido);
    // Como el resto de las exportaciones de la aplicación: se avisa dónde quedó.
    expect(stub.revelados).toEqual([destino]);
  });

  it("no deja el temporal tirado", async () => {
    // Se escribe a `.parcial` y se renombra al final, como todo lo que este
    // proyecto escribe en disco: un corte no puede dejar un archivo con nombre
    // de documento emitido y contenido a medias.
    const destino = path.join(dir, "0001_Factura.pdf");
    stub.destino = destino;

    await guardar({ defaultName: "x.pdf", bytes: contenido });

    expect(fs.existsSync(`${destino}.parcial`)).toBe(false);
    expect(fs.readdirSync(dir).filter((f) => f.endsWith(".parcial"))).toEqual(
      []
    );
  });

  it("cancelar se distingue de fallar", async () => {
    stub.destino = null;

    const res = await guardar({ defaultName: "x.pdf", bytes: contenido });

    // Es la diferencia de la que depende que cancelar no quede como un error en
    // la pantalla: el documento se descarta igual, pero no se avisa nada malo.
    expect(res.status).toBe("cancelled");
  });

  it("un destino que no se puede escribir devuelve el fallo, no lo lanza", async () => {
    // Una carpeta que no existe: es lo que pasa con un pendrive desconectado.
    stub.destino = path.join(dir, "carpeta-que-no-existe", "doc.pdf");

    const res = await guardar({ defaultName: "x.pdf", bytes: contenido });

    expect(res.status).toBe("failed");
    // El mensaje nombra la carpeta: sin eso el usuario no sabe dónde intentó
    // escribir ni por qué falló.
    expect(res.message).toContain("carpeta-que-no-existe");
    expect(stub.revelados).toEqual([]);
  });

  it("rechaza un PDF vacío en vez de escribir un archivo inservible", async () => {
    stub.destino = path.join(dir, "doc.pdf");

    const res = await guardar({
      defaultName: "x.pdf",
      bytes: new Uint8Array(0),
    });

    expect(res.status).toBe("failed");
    expect(fs.existsSync(path.join(dir, "doc.pdf"))).toBe(false);
  });
});
