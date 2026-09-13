/**
 * El único camino por el que un error de la interfaz llega al archivo de log.
 *
 * `console.error` del renderer termina en las herramientas de desarrollo, que
 * en producción nadie abre: cuando al usuario le reventaba una pantalla y se le
 * pedía que mandara los logs, ahí no había nada. Esto lo manda al proceso
 * principal, que lo registra con `logError` como todo lo demás.
 *
 * Nunca lanza. Se lo llama desde un `componentDidCatch` y desde los manejadores
 * globales de error: si el puente no estuviera —en un test, o si el preload no
 * cargó—, romper acá taparía el error original con otro peor.
 */
export const reportarError = (
  scope: string,
  error: unknown,
  extra: { componentStack?: string } = {}
): void => {
  try {
    const esError = error instanceof Error;
    window.api?.global?.logError?.({
      scope,
      name: esError ? error.name : typeof error,
      message: esError ? error.message : String(error),
      stack: esError ? error.stack : undefined,
      componentStack: extra.componentStack,
      // La ruta es lo primero que se pregunta al leer el log: sin esto hay que
      // deducir la pantalla desde la traza de componentes.
      route: window.location.hash,
    });
  } catch {
    // Registrar no puede romper nada. Si esto falla no hay a dónde avisar.
  }
};
