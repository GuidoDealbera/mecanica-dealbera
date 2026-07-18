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
export function handleIpc<Args extends unknown[], R>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: Args) => R | Promise<R>,
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
