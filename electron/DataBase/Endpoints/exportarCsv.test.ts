import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "reflect-metadata";
import type { DataSource } from "typeorm";

/**
 * Exportar los vehículos a CSV cuando el destino no se puede escribir.
 *
 * La escritura no estaba en un `try`. Un disco lleno, una carpeta sin permisos
 * o un pendrive desconectado lanzan, `handleIpc` relanza, y al renderer le
 * llegaba una promesa rechazada con el mensaje crudo de Node —`EACCES:
 * permission denied, open '...'`—. Todos los demás flujos de respaldo devuelven
 * `{ status: "failed", message }` con un texto entendible; éste era el único
 * que no.
 */

const stub = vi.hoisted(() => ({
  dir: "",
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
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
    showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })),
    showErrorBox: vi.fn(),
    showMessageBox: vi.fn(async () => ({ response: 1 })),
  },
  shell: {
    showItemInFolder: vi.fn((p: string) => stub.revelados.push(p)),
    openPath: vi.fn(),
  },
}));

let dir: string;
let ds: DataSource;

const exportar = async () => {
  const handler = stub.handlers.get("data:export-csv");
  if (!handler) throw new Error("No se registró data:export-csv");
  return (await handler({})) as { status: string; message: string };
};

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-csv-"));
  process.env.MECANICA_DATA_DIR = dir;
  stub.dir = dir;
  stub.destino = null;
  stub.revelados = [];
  stub.handlers.clear();
  vi.resetModules();

  const dataSource = await import("../dataSource");
  await dataSource.AppDataSource.initialize();
  await dataSource.applyPendingMigrations();
  await import("./backup.endpoints");
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

describe("exportar a CSV", () => {
  it("escribe el archivo y avisa dónde quedó", async () => {
    const destino = path.join(dir, "vehiculos.csv");
    stub.destino = destino;

    const res = await exportar();

    expect(res.status).toBe("success");
    expect(fs.readFileSync(destino, "utf8")).toContain("AB123CD");
    expect(stub.revelados).toEqual([destino]);
  });

  it("un destino que no se puede escribir se contesta, no se revienta", async () => {
    // Una carpeta que no existe: es lo que pasa con un pendrive desconectado.
    stub.destino = path.join(dir, "no-existe", "vehiculos.csv");

    const res = await exportar();

    // Lo que importa es que **no lance**: si lanza, `handleIpc` relanza y el
    // usuario ve el error crudo de Node en vez de un motivo.
    expect(res.status).toBe("failed");
    expect(res.message).toContain("no-existe");
    expect(res.message).not.toMatch(/ENOENT|EACCES/);
    expect(stub.revelados).toEqual([]);
  });

  it("no deja el temporal tirado", async () => {
    stub.destino = path.join(dir, "vehiculos.csv");
    await exportar();

    expect(fs.readdirSync(dir).filter((f) => f.endsWith(".parcial"))).toEqual(
      []
    );
  });

  it("cancelar no escribe nada", async () => {
    stub.destino = null;

    const res = await exportar();

    expect(res.status).toBe("cancelled");
    expect(fs.readdirSync(dir).filter((f) => f.endsWith(".csv"))).toEqual([]);
  });
});
