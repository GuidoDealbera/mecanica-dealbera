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

  it("cada listener del updater devuelve su propia baja", () => {
    // Antes no devolvían nada y la limpieza era un `removeAllListeners()` que
    // borraba **todos** los listeners de esos canales, fueran de quien fueran.
    // Funcionaba porque el único consumidor era el Header; el día que otra
    // pantalla escuchara uno, desmontar el Header la dejaba sorda sin ningún
    // error y sin forma de darse cuenta.
    const updater = expuesto.get("updater") as Record<
      string,
      (cb: () => void) => unknown
    >;

    for (const nombre of [
      "onUpdateAvailable",
      "onUpdateNotAvailable",
      "onProgress",
      "onDownloaded",
      "onError",
    ]) {
      expect(typeof updater[nombre](() => {}), nombre).toBe("function");
    }

    // Y el martillo ya no está: quien quiera limpiar tiene que usar su baja.
    expect(updater.removeAllListeners).toBeUndefined();
  });

  it("los listeners del updater no filtran el evento IPC", async () => {
    // `onUpdateNotAvailable` y `onDownloaded` registraban el callback directo,
    // así que recibían `(event, ...args)`. No molestaba porque no usan
    // argumentos, pero filtraba el objeto del evento al renderer, que es justo
    // lo que el puente existe para no hacer.
    const { ipcRenderer } = (await import("electron")) as unknown as {
      ipcRenderer: { on: { mock: { calls: unknown[][] } } };
    };
    const updater = expuesto.get("updater") as Record<
      string,
      (cb: (data: unknown) => void) => unknown
    >;

    const recibido: unknown[] = [];
    updater.onDownloaded((...args: unknown[]) => recibido.push(args));

    // Se dispara el handler que quedó registrado, como haría el proceso
    // principal: con un evento adelante y los datos atrás.
    const [, handler] = ipcRenderer.on.mock.calls.at(-1) as [
      string,
      (evento: unknown, data: unknown) => void,
    ];
    handler({ sender: "el evento IPC" }, { version: "2.1.0" });

    expect(recibido).toEqual([[{ version: "2.1.0" }]]);
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
      "trash",
    ]);
  });
});
