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
