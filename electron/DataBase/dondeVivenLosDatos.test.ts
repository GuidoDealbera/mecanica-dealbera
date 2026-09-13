import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import "reflect-metadata";

/**
 * Qué decide dónde vive la base de datos.
 *
 * Lo decidía `process.env.NODE_ENV === "development"`, y eso es una convención
 * de las herramientas, no algo que Electron garantice. Hoy la define Vite, pero
 * es una variable de entorno **heredada**: un `NODE_ENV=production` suelto en
 * la terminal del desarrollador hacía que `npm run dev` abriera la base real
 * del usuario y escribiera respaldos en sus Documentos.
 *
 * Ahora lo decide `app.isPackaged`, que lo sabe el propio Electron y no se
 * puede pisar desde afuera. Estos casos existen para que la decisión no vuelva
 * a colgar de una variable de entorno.
 */

const stub = vi.hoisted(() => ({ empaquetada: false }));

vi.mock("electron", () => ({
  app: {
    get isPackaged() {
      return stub.empaquetada;
    },
    getPath: (nombre: string) => path.join("C:", "usuario", nombre),
    getVersion: () => "2.0.0",
  },
  dialog: {
    showErrorBox: vi.fn(),
    showMessageBox: vi.fn(),
    showMessageBoxSync: vi.fn(),
  },
}));

const cargar = async () => {
  vi.resetModules();
  return await import("./dataSource");
};

const NODE_ENV_ORIGINAL = process.env.NODE_ENV;

beforeEach(() => {
  delete process.env.MECANICA_DATA_DIR;
});

afterEach(() => {
  // `NODE_ENV` está declarado como no opcional en los tipos de Node, así que se
  // restaura asignando en vez de borrando.
  process.env.NODE_ENV = NODE_ENV_ORIGINAL ?? "test";
  delete process.env.MECANICA_DATA_DIR;
});

describe("dónde vive la base según cómo esté corriendo la aplicación", () => {
  it("empaquetada, en los datos del usuario", async () => {
    stub.empaquetada = true;
    const { getDBPath, getBackupDir } = await cargar();

    expect(getDBPath()).toContain(path.join("usuario", "userData"));
    // Los respaldos van a Documentos: son lo que el usuario busca para copiar
    // a un pendrive.
    expect(getBackupDir()).toContain(path.join("usuario", "documents"));
  });

  it("sin empaquetar, en la carpeta del proyecto", async () => {
    stub.empaquetada = false;
    const { getDBPath, getBackupDir } = await cargar();

    expect(getDBPath()).toContain(path.join(process.cwd(), "data"));
    expect(getBackupDir()).toContain(path.join(process.cwd(), "data"));
  });

  it("NODE_ENV ya no decide nada", async () => {
    // El escenario concreto: la variable quedó en `production` en la terminal
    // del desarrollador. Antes eso alcanzaba para que `npm run dev` abriera la
    // base real y escribiera en los Documentos del usuario.
    stub.empaquetada = false;
    process.env.NODE_ENV = "production";
    const { getDBPath, getBackupDir } = await cargar();

    expect(getDBPath()).toContain(path.join(process.cwd(), "data"));
    expect(getBackupDir()).not.toContain("documents");
  });

  it("y al revés tampoco", async () => {
    stub.empaquetada = true;
    process.env.NODE_ENV = "development";
    const { getDBPath } = await cargar();

    expect(getDBPath()).toContain(path.join("usuario", "userData"));
  });

  it("MECANICA_DATA_DIR sigue mandando sobre todo lo demás", async () => {
    // Es lo que permite probar contra datos de verdad sin tocar los del
    // usuario, así que tiene que ganarle a las dos ramas.
    stub.empaquetada = true;
    process.env.MECANICA_DATA_DIR = path.join("D:", "prueba");
    const { getDBPath, getBackupDir } = await cargar();

    expect(getDBPath()).toBe(path.join("D:", "prueba", "taller.db"));
    expect(getBackupDir()).toBe(path.join("D:", "prueba", "backups"));
  });
});
