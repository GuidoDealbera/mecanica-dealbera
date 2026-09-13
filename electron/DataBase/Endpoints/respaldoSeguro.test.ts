import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "reflect-metadata";
import type { DataSource } from "typeorm";

/**
 * Que exportar y reemplazar la base no destruyan lo que ya estaba.
 *
 * Son tres decisiones que el proyecto ya había tomado bien en otros lados y que
 * acá faltaban:
 *
 * - Escribir a un temporal y renombrar al final, en vez de borrar el destino
 *   antes de saber si se puede escribir.
 * - Conservar unas pocas copias previas, en vez de todas.
 * - Barrer los archivos laterales de SQLite antes de dejar un `.db` distinto en
 *   esa ruta.
 */

const stub = vi.hoisted(() => ({
  dir: "",
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  destino: null as string | null,
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
  shell: { showItemInFolder: vi.fn(), openPath: vi.fn() },
}));

let dir: string;
let ds: DataSource;
let backup: typeof import("./backup.endpoints");

const exportar = async () => {
  const handler = stub.handlers.get("backup:export");
  if (!handler) throw new Error("No se registró backup:export");
  return (await handler({})) as { status: string; message: string };
};

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-resp-"));
  process.env.MECANICA_DATA_DIR = dir;
  stub.dir = dir;
  stub.destino = null;
  stub.handlers.clear();
  vi.resetModules();

  const dataSource = await import("../dataSource");
  await dataSource.AppDataSource.initialize();
  await dataSource.applyPendingMigrations();
  backup = await import("./backup.endpoints");
  ds = dataSource.AppDataSource;
});

afterEach(async () => {
  if (ds?.isInitialized) await ds.destroy();
  delete process.env.MECANICA_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("exportar la base encima de un respaldo anterior", () => {
  it("lo reemplaza cuando la exportación sale bien", async () => {
    const destino = path.join(dir, "respaldo.db");
    fs.writeFileSync(destino, "respaldo viejo");
    stub.destino = destino;

    const res = await exportar();

    expect(res.status).toBe("success");
    // Es una base de verdad, no el texto que había.
    expect(fs.readFileSync(destino).subarray(0, 15).toString()).toBe(
      "SQLite format 3"
    );
    expect(fs.existsSync(`${destino}.parcial`)).toBe(false);
  });

  it("si la exportación falla, el respaldo anterior sigue estando", async () => {
    // El escenario: se exporta encima de un respaldo en un pendrive y el
    // pendrive se va a mitad de camino. Antes se borraba el destino **antes**
    // de escribir, así que el usuario se quedaba sin el respaldo viejo y sin el
    // nuevo, justo en la operación que hace para no quedarse sin datos.
    const destino = path.join(dir, "no-existe", "respaldo.db");
    fs.mkdirSync(path.dirname(destino));
    fs.writeFileSync(destino, "respaldo viejo");
    stub.destino = destino;

    // Se rompe la escritura del temporal dejando una carpeta con ese nombre.
    fs.mkdirSync(`${destino}.parcial`);

    const res = await exportar();

    expect(res.status).toBe("failed");
    expect(fs.readFileSync(destino, "utf8")).toBe("respaldo viejo");
  });
});

describe("las copias previas al reemplazo", () => {
  const copia = (marca: number) =>
    path.join(dir, `taller_pre_import_${marca}.db`);

  it("conserva las últimas tres y borra el resto", async () => {
    // Cada importación o restauración guardaba una y no se borraba ninguna
    // nunca, mientras que las copias previas a migraciones y los respaldos
    // diarios sí tienen retención: la misma decisión con tres resultados.
    const marcas = [1, 2, 3, 4, 5];
    for (const m of marcas) fs.writeFileSync(copia(m), `copia ${m}`);

    const borradas = backup.prunePreImportCopies(path.join(dir, "taller.db"));

    expect(borradas).toHaveLength(2);
    expect(fs.existsSync(copia(1))).toBe(false);
    expect(fs.existsSync(copia(2))).toBe(false);
    // Sobreviven las tres más nuevas.
    for (const m of [3, 4, 5]) expect(fs.existsSync(copia(m))).toBe(true);
  });

  it("no toca la base ni los respaldos que no son copias previas", async () => {
    fs.writeFileSync(path.join(dir, "taller_backup_2026-01-01.db"), "otro");
    for (const m of [1, 2, 3, 4]) fs.writeFileSync(copia(m), `copia ${m}`);

    backup.prunePreImportCopies(path.join(dir, "taller.db"));

    expect(fs.existsSync(path.join(dir, "taller.db"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "taller_backup_2026-01-01.db"))).toBe(
      true
    );
  });
});

describe("los archivos laterales de SQLite", () => {
  it("se barren antes de dejar otra base en esa ruta", async () => {
    const { removeSidecarFiles } = await import("../migrationSafety");
    const dbPath = path.join(dir, "taller.db");

    for (const sufijo of ["-journal", "-wal", "-shm"]) {
      fs.writeFileSync(`${dbPath}${sufijo}`, "sobrante");
    }

    removeSidecarFiles(dbPath);

    // Un `-journal` o un `-wal` que quedó del archivo anterior no le
    // corresponde al nuevo, y SQLite lo aplicaría igual: no tiene forma de
    // darse cuenta.
    for (const sufijo of ["-journal", "-wal", "-shm"]) {
      expect(fs.existsSync(`${dbPath}${sufijo}`)).toBe(false);
    }
    // Y la base no se toca.
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it("no se queja si no hay ninguno", async () => {
    const { removeSidecarFiles } = await import("../migrationSafety");
    expect(() =>
      removeSidecarFiles(path.join(dir, "no-existe.db"))
    ).not.toThrow();
  });
});
