import log from "electron-log/main";

export type LogContext = Record<string, unknown>;

/**
 * Serializa un error desconocido a un objeto plano con los campos útiles.
 * Evita perder el `stack` (que se pierde al concatenar el error en un string).
 */
function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

/**
 * Log de error estructurado.
 * @param scope  Identificador de la operación (ej. "car:create").
 * @param error  Error capturado (se serializa name/message/stack).
 * @param context  Datos extra relevantes (ids, payload acotado, etc.).
 *
 * Se emite un único objeto para que electron-log lo registre de forma
 * consistente y parseable, en lugar de un string concatenado.
 */
export function logError(
  scope: string,
  error: unknown,
  context: LogContext = {}
): void {
  log.error({ scope, ...context, error: serializeError(error) });
}

/**
 * Log informativo estructurado.
 */
export function logInfo(
  scope: string,
  message?: string,
  context: LogContext = {}
): void {
  log.info({ scope, ...(message ? { message } : {}), ...context });
}

/**
 * Log de advertencia estructurado.
 */
export function logWarn(
  scope: string,
  message: string,
  context: LogContext = {}
): void {
  log.warn({ scope, message, ...context });
}
