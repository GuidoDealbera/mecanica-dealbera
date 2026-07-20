// Respuesta unificada del backend. Se reexporta el tipo canónico definido en
// el frontend para que el código de electron use exactamente la misma forma.
// Se mantiene el alias `ApiResponse` por compatibilidad con imports previos.
export type { APIResponse, APIResponse as ApiResponse, ApiStatus } from "../../../src/Types/apiTypes";
