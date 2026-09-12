// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { reportarError } from "./reportarError";

/**
 * El lado de la interfaz del registro de errores.
 *
 * Lo importante no es tanto lo que manda —eso lo fija
 * `rendererErrorLog.test.ts` del otro lado del canal— como **que no rompa**: se
 * lo llama desde un `componentDidCatch` y desde los manejadores globales de
 * error, o sea siempre encima de un error que ya ocurrió. Si esto lanzara,
 * taparía el error original con otro peor y sin traza.
 */

type Api = { global?: { logError?: (p: unknown) => void } };
const conApi = (api: Api | undefined) => {
  (window as unknown as { api?: Api }).api = api;
};

afterEach(() => {
  conApi(undefined);
  window.location.hash = "";
});

describe("reportar un error de la interfaz", () => {
  it("manda nombre, mensaje, traza y ruta", () => {
    const logError = vi.fn();
    conApi({ global: { logError } });
    window.location.hash = "#/cars/AB123CD";

    const error = new TypeError("no se puede leer 'map' de undefined");
    reportarError("renderer:boundary", error, {
      componentStack: "\n    at CarsTable",
    });

    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError.mock.calls[0][0]).toMatchObject({
      scope: "renderer:boundary",
      name: "TypeError",
      message: "no se puede leer 'map' de undefined",
      componentStack: "\n    at CarsTable",
      route: "#/cars/AB123CD",
    });
    expect(logError.mock.calls[0][0].stack).toContain("TypeError");
  });

  it("sirve también con algo que no es un Error", () => {
    // Los manejadores globales atrapan lo que se haya lanzado, y en JavaScript
    // eso puede ser cualquier cosa: una promesa rechazada con un string es lo
    // más común.
    const logError = vi.fn();
    conApi({ global: { logError } });

    reportarError("renderer:promesa", "se cayó la conexión");

    expect(logError.mock.calls[0][0]).toMatchObject({
      message: "se cayó la conexión",
    });
  });

  it("no lanza si el puente no está", () => {
    // Pasa en cualquier contexto sin preload. Reventar acá cambiaría un error
    // de pantalla por una pantalla en blanco.
    conApi(undefined);
    expect(() => reportarError("renderer:error", new Error("x"))).not.toThrow();

    conApi({});
    expect(() => reportarError("renderer:error", new Error("x"))).not.toThrow();
  });

  it("no lanza si el puente falla", () => {
    conApi({
      global: {
        logError: () => {
          throw new Error("el canal se cayó");
        },
      },
    });

    expect(() => reportarError("renderer:error", new Error("x"))).not.toThrow();
  });
});
