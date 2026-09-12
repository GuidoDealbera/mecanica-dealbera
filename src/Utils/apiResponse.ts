import { APIResponse } from "../Types/apiTypes";

/**
 * Convierte el envelope del backend en una excepción cuando la operación no fue
 * exitosa, devolviendo el `result` cuando sí lo fue.
 *
 * Hace falta porque los thunks **resuelven** con la respuesta incluso cuando
 * trae `status: "failed"` (sólo rechazan si la llamada IPC en sí falla). Sin
 * esto, un rechazo de negocio del backend —"no se pueden bajar los kilómetros",
 * "el teléfono ya está registrado"— se veía como un éxito: el mensaje quedaba
 * sin mostrar y la pantalla seguía adelante avisando que todo salió bien.
 *
 * El estado `cancelled` (que usan los flujos de respaldo, cuando el usuario
 * cierra el diálogo de archivos) también se considera "no exitoso": esos flujos
 * tienen que distinguirlo **antes** de llamar a este helper.
 */
export const ensureSuccess = <T>(response: APIResponse<T>): T => {
  if (response.status !== "success") {
    throw new Error(response.message || "La operación no pudo completarse");
  }
  return response.result;
};

/**
 * Mensaje legible de algo que se lanzó, sea lo que sea.
 *
 * `catch` recibe `unknown`: puede llegar un `Error`, un string o cualquier
 * cosa. Varios `catch` del proyecto estaban tipados como `any` y leían
 * `error.message` directo, así que ante algo que no fuera un `Error` el toast
 * salía vacío —el usuario veía un cartel rojo sin texto—.
 */
export const errorMessage = (
  error: unknown,
  fallback = "La operación no pudo completarse"
): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
};

/**
 * Convierte lo que se lanzó en una respuesta con la forma del backend.
 *
 * Los hooks devolvían el propio `Error` en el `catch`, y quien llamaba hacía
 * `if (response.status === "success")`. Un `Error` no tiene `status`, así que
 * daba `undefined`: **funcionaba de casualidad**, porque `undefined` es falsy y
 * se interpretaba como fallo. Con esto el contrato es el mismo en los dos
 * caminos.
 */
export const failureFrom = (
  error: unknown,
  fallback?: string
): { status: "failed"; message: string } => ({
  status: "failed",
  message: errorMessage(error, fallback),
});
