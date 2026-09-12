/**
 * Reemplazo de `electron-log/main` para los tests.
 *
 * `electron/logger.ts` lo importa, y `electron-log` a su vez hace su propio
 * `require("electron")` para resolver rutas. Eso **no lo intercepta**
 * `vi.mock("electron")`: el mock vale para el módulo bajo prueba, no para lo que
 * pida una dependencia por su cuenta. Así que se cargaba el paquete real, que
 * intenta ubicar el binario de Electron y falla con "Electron failed to install
 * correctly" cuando no está descargado.
 *
 * En local no se notaba —el binario está, de correr la aplicación— y en el
 * runner del CI reventaban trece tests. Es el tipo de diferencia que sólo
 * aparece en una máquina limpia.
 *
 * Se conecta por `alias` en `vitest.config.ts` y no con `vi.mock` en cada
 * archivo: es una sustitución de infraestructura, igual para todos los tests, y
 * repetirla en cada uno es la forma de que al próximo se le olvide.
 */
const noop = () => {};

const transport = { level: "silly", getFile: () => ({ path: "" }) };

export default {
  error: noop,
  warn: noop,
  info: noop,
  verbose: noop,
  debug: noop,
  silly: noop,
  log: noop,
  initialize: noop,
  transports: { file: transport, console: transport, ipc: transport },
};
