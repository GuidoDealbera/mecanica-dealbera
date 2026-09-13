import { ipcMain, IpcMainInvokeEvent } from "electron";
import { logError } from "./logger";

/**
 * Envuelve `ipcMain.handle` con una red de seguridad de errores.
 *
 * Cualquier excepción no controlada dentro de un handler se registra de
 * forma estructurada (usando el canal como `scope`) y se vuelve a lanzar,
 * de modo que el renderer la reciba como promesa rechazada — contrato que
 * los thunks del frontend ya manejan con `rejectWithValue`.
 *
 * Los handlers que capturan sus propios errores y devuelven
 * `{ status: 'failed' }` no llegan a este `catch` (no hay doble log).
 *
 * @param channel Canal IPC; se usa además como `scope` del log.
 * @param handler Handler original, con sus tipos de argumentos preservados.
 */
/**
 * Registra un canal de **lectura**, envolviendo lo que devuelva.
 *
 * Nueve canales devolvían el dato pelado —un `Paginated`, un número, un
 * arreglo— mientras el resto usaba el envelope. El problema no era la
 * inconsistencia en sí: era que `ensureSuccess` no se podía usar en la mitad de
 * las llamadas, así que cada pantalla se inventaba su manejo de error, y que
 * una lectura fallida llegaba al renderer como una promesa rechazada con el
 * mensaje crudo de TypeORM.
 *
 * Envolver acá y no en cada handler es a propósito: el contrato deja de ser una
 * convención que hay que acordarse de respetar y pasa a ser estructural. Un
 * canal de lectura nuevo lo cumple por usar esta función.
 *
 * @param mensajeDeError Lo que va a leer el usuario si la consulta falla.
 */
export function handleIpcQuery<Args extends unknown[], R>(
  channel: string,
  mensajeDeError: string,
  handler: (event: IpcMainInvokeEvent, ...args: Args) => R | Promise<R>
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      const result = await handler(event, ...(args as Args));
      // Sin mensaje: no hay nada que avisarle a nadie porque algo se leyó.
      return { status: "success", message: "", result };
    } catch (error) {
      logError(channel, error);
      return { status: "failed", message: mensajeDeError };
    }
  });
}

export function handleIpc<Args extends unknown[], R>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: Args) => R | Promise<R>
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...(args as Args));
    } catch (error) {
      logError(channel, error);
      throw error;
    }
  });
}
