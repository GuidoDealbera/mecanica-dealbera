import { describe, expect, it } from "vitest";
import { clampPage } from "./pagination";

describe("clampPage", () => {
  it("deja pasar una página que existe", () => {
    expect(clampPage(3, 40, 8)).toBe(3);
  });

  it("baja a la última página cuando el total encogió", () => {
    // El caso que motivó la función: se borró el último item de la página 6.
    expect(clampPage(6, 40, 8)).toBe(5);
  });

  it("salta directo a la última, no de a una", () => {
    // Filtrar desde la página 6 a un resultado que deja 3 items: la corrección
    // vieja hacía cinco consultas encadenadas para llegar acá.
    expect(clampPage(6, 3, 8)).toBe(1);
  });

  it("sin resultados la página válida sigue siendo la 1", () => {
    expect(clampPage(4, 0, 8)).toBe(1);
  });

  it("no devuelve páginas menores a 1", () => {
    expect(clampPage(0, 40, 8)).toBe(1);
    expect(clampPage(-2, 40, 8)).toBe(1);
  });

  it("un total que no completa la página igual da una página", () => {
    expect(clampPage(1, 3, 8)).toBe(1);
    expect(clampPage(2, 9, 8)).toBe(2);
  });

  it("no divide por cero si el tamaño de página es inválido", () => {
    expect(clampPage(3, 40, 0)).toBe(1);
  });
});
