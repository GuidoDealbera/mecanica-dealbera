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
}
