import { describe, expect, it, vi } from "vitest";

/**
 * Qué le queda expuesto al renderer.
 *
 * El preload tenía, además del objeto `api` —canal por canal y con tipos—, un
 * `ipcRenderer` genérico con `invoke`, `send` y `on` sobre **cualquier** canal.
 * Con eso a mano, todo el trabajo de acotar la superficie quedaba sin efecto:
 * `window.ipcRenderer.invoke("backup:import")` funcionaba igual.
 *
 * Venía de la plantilla de electron-vite y no lo usaba nadie salvo tres
 * renglones de ejemplo que hacían un `console.log`. Este test existe para que no
 * vuelva por descuido: es la clase de cosa que se agrega "para probar algo" y se
 * queda.
 */

const expuesto = vi.hoisted(() => new Map<string, unknown>());

vi.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: (nombre: string, api: unknown) => {
      expuesto.set(nombre, api);
    },
  },
  ipcRenderer: {
    on: vi.fn(),
    off: vi.fn(),
    send: vi.fn(),
    invoke: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

await import("./preload");

describe("superficie que el preload expone", () => {
  it("no hay un puente genérico de IPC", () => {
    // Lo que importa no es el nombre sino la capacidad: cualquier objeto
    // expuesto que ofrezca `invoke` o `send` sin acotar el canal anula el
    // puente tipado.
    const genericos = [...expuesto.entries()].filter(([, api]) => {
      const o = api as Record<string, unknown>;
      return typeof o?.invoke === "function" || typeof o?.send === "function";
    });

    expect(genericos.map(([nombre]) => nombre)).toEqual([]);
  });

  it("expone sólo lo previsto", () => {
    expect([...expuesto.keys()].sort()).toEqual(["api", "updater"]);
  });

  it("el objeto `api` sigue teniendo sus áreas", () => {
    // Si esto se rompe, el test de arriba podría estar pasando porque el
    // preload dejó de exponer nada.
    const api = expuesto.get("api") as Record<string, unknown>;
    expect(Object.keys(api).sort()).toEqual([
      "backup",
      "cars",
      "clients",
      "dashboard",
      "documents",
      "global",
      "onDataChanged",
      "service",
    ]);
  });
});
