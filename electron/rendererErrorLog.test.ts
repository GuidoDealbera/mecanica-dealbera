import { describe, expect, it } from "vitest";
import {
  LARGO_MAXIMO_DE_TRAZA,
  normalizarErrorDeRenderer,
} from "./rendererErrorLog";

/**
 * Lo que queda escrito en el log cuando revienta una pantalla.
 *
 * Antes no quedaba nada: el `ErrorBoundary` hacía `console.error`, que va a las
 * herramientas de desarrollo y no al archivo que el usuario puede mandar. El
 * error que importaba era el único sin registrar.
 *
 * Lo que se fija acá es que lo que llega por el canal sobreviva el viaje —sobre
 * todo la traza, que es lo único que sirve para averiguar algo— y que el canal
 * no se pueda usar para arruinar el archivo de log.
 */

describe("el error de la interfaz que va al archivo de log", () => {
  it("conserva nombre, mensaje y traza", () => {
    const { scope, error, context } = normalizarErrorDeRenderer({
      scope: "renderer:boundary",
      name: "TypeError",
      message: "Cannot read properties of undefined (reading 'map')",
      stack: "TypeError: ...\n    at CarsTable (CarsTable.tsx:182:20)",
      componentStack: "\n    at CarsTable\n    at Layout",
      route: "#/cars",
    });

    expect(scope).toBe("renderer:boundary");
    expect(error.name).toBe("TypeError");
    expect(error.message).toContain("Cannot read properties");
    // La traza es el motivo por el que existe este canal: si se perdiera acá,
    // el log diría que hubo un error y nada más.
    expect(error.stack).toContain("CarsTable.tsx:182");
    expect(context.ruta).toBe("#/cars");
    expect(context.componentes).toContain("CarsTable");
  });

  it("es un Error de verdad, no un objeto plano", () => {
    // `serializeError` del logger sólo saca name/message/stack de un `Error`;
    // con un objeto cualquiera escribiría "[object Object]" y la traza se
    // perdería sin que nadie se entere.
    const { error } = normalizarErrorDeRenderer({ message: "algo" });
    expect(error).toBeInstanceOf(Error);
  });

  it("acota la traza para no llevarse puesto el archivo", () => {
    const enorme = "x".repeat(50_000);
    const { error, context } = normalizarErrorDeRenderer({
      message: enorme,
      stack: enorme,
      componentStack: enorme,
      route: enorme,
    });

    // El archivo de log es finito y rota: una traza de React sin límite se
    // lleva por delante los errores anteriores, que son los que dan contexto.
    expect(error.stack).toHaveLength(LARGO_MAXIMO_DE_TRAZA);
    expect(context.componentes).toHaveLength(LARGO_MAXIMO_DE_TRAZA);
    expect(error.message.length).toBeLessThanOrEqual(500);
    expect(context.ruta.length).toBeLessThanOrEqual(200);
  });

  it("registra algo aunque no le manden nada usable", () => {
    // Se lo llama desde manejadores globales, donde lo que se atrapa puede ser
    // cualquier cosa. Perder el aviso por un payload raro sería volver al
    // problema original.
    for (const basura of [undefined, null, "texto suelto", 42, []]) {
      const { scope, error } = normalizarErrorDeRenderer(basura);
      expect(scope).toBe("renderer");
      expect(error.name).toBe("RendererError");
      expect(error.message).toBe("Error desconocido en la interfaz");
      // Sin traza propia queda la del `new Error`, que al menos ubica el canal.
      expect(error.stack).toBeTruthy();
    }
  });
});
