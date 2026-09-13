/**
 * Qué se registra cuando la interfaz avisa que algo reventó.
 *
 * Vive fuera de `main.ts` porque es una regla y no cableado: lo que llega por
 * el canal es un objeto que armó el renderer, y hay que decidir qué se guarda,
 * con qué nombre y hasta dónde. Acá se puede ejercitar sin levantar Electron.
 */

/** Tope de los campos largos. Una traza de React puede tener miles de renglones. */
export const LARGO_MAXIMO_DE_TRAZA = 4000;

export interface ErrorDeRenderer {
  scope: string;
  error: Error;
  context: { codigo: string; ruta: string; componentes: string };
}

const comoTexto = (valor: unknown, tope: number): string =>
  typeof valor === "string" ? valor.slice(0, tope) : "";

/**
 * Convierte lo que mandó el renderer en algo que `logError` sepa registrar.
 *
 * Se rearma un `Error` de verdad en vez de pasar el objeto plano porque
 * `serializeError` sólo conserva `name`, `message` y `stack` de un `Error`: con
 * un objeto cualquiera guardaría `"[object Object]"` y se perdería la traza,
 * que es lo único por lo que este canal existe.
 *
 * Todos los campos se acotan. No es por desconfianza del renderer sino por el
 * archivo: es finito y rota, y una traza de componentes sin límite se lleva
 * puesto el historial de errores anteriores.
 */
export const normalizarErrorDeRenderer = (
  payload: unknown
): ErrorDeRenderer => {
  const datos = (payload ?? {}) as Record<string, unknown>;

  const error = new Error(
    comoTexto(datos.message, 500) || "Error desconocido en la interfaz"
  );
  error.name = comoTexto(datos.name, 100) || "RendererError";
  const stack = comoTexto(datos.stack, LARGO_MAXIMO_DE_TRAZA);
  if (stack) error.stack = stack;

  return {
    scope: comoTexto(datos.scope, 60) || "renderer",
    error,
    context: {
      // El código que la pantalla le mostró al usuario. Es la única forma de
      // encontrar **este** error en el archivo cuando llama por teléfono.
      codigo: comoTexto(datos.errorId, 40),
      // La ruta es lo primero que se pregunta al leer el log: sin ella hay que
      // deducir la pantalla desde la traza de componentes.
      ruta: comoTexto(datos.route, 200),
      componentes: comoTexto(datos.componentStack, LARGO_MAXIMO_DE_TRAZA),
    },
  };
};
