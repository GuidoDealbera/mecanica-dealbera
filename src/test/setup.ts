import { afterEach } from "vitest";

/**
 * Preparación común de los tests.
 *
 * Los matchers del DOM y la limpieza entre casos sólo tienen sentido cuando el
 * entorno es jsdom, y la mayoría de los tests corren en Node: por eso se cargan
 * de forma condicional en vez de importarlos arriba. Con un import estático,
 * `@testing-library/react` explota al no encontrar `document`.
 */
if (typeof document !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => cleanup());

  // jsdom no implementa `ResizeObserver`, y varios componentes de HeroUI lo
  // usan para medirse (las Tabs, por ejemplo). Sin esto el componente revienta
  // al montarse y el test falla por una carencia del entorno, no por el código.
  //
  // Alcanza con un doble que no hace nada: los tests verifican reglas de
  // negocio y qué se muestra, no medidas.
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
}
