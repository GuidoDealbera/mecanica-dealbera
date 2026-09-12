import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

/**
 * El CSV que se lleva el usuario.
 *
 * Lo que se cuida acá son dos cosas distintas que es fácil confundir:
 *
 * - Que el **formato** esté bien: comillas dobladas, celdas entrecomilladas
 *   cuando traen el separador.
 * - Que la planilla no **ejecute** lo que hay adentro. Un archivo puede estar
 *   perfectamente bien formado y ejecutar una fórmula al abrirlo, y acá los
 *   datos los escribe una persona en un formulario.
 */

type Fila = { nombre: string; telefono: string };
const cabeceras = { nombre: "Titular", telefono: "Teléfono" };

const celdas = (csv: string) =>
  csv
    .replace(/^\uFEFF/, "")
    .split("\n")
    .map((l) => l.split(";"));

describe("toCsv", () => {
  it("escribe cabeceras y filas separadas por punto y coma", () => {
    const csv = toCsv<Fila>(cabeceras, [
      { nombre: "Ana Gómez", telefono: "3515123456" },
    ]);

    expect(celdas(csv)).toEqual([
      ["Titular", "Teléfono"],
      ["Ana Gómez", "3515123456"],
    ]);
  });

  it("arranca con BOM, que es lo que hace que Excel lo abra como UTF-8", () => {
    // Sin esto los acentos y la eñe salen rotos en Windows.
    expect(toCsv<Fila>(cabeceras, [])).toMatch(/^\uFEFF/);
  });

  it("entrecomilla lo que traiga el separador, comillas o saltos", () => {
    const csv = toCsv<Fila>(cabeceras, [
      { nombre: 'Gómez; Ana "la jefa"', telefono: "351\n512" },
    ]);
    const [, fila] = csv.replace(/^\uFEFF/, "").split("\n");

    expect(fila).toContain('"Gómez; Ana ""la jefa"""');
  });

  it("neutraliza las celdas que la planilla tomaría como fórmula", () => {
    // El vector clásico: el archivo se ve bien y la fórmula corre al abrirlo.
    const peligrosos = [
      '=HYPERLINK("http://ejemplo","clic")',
      "+1+1",
      "-2+3+cmd|' /C calc'!A0",
      "@SUM(1+1)",
      "\tfórmula",
    ];

    for (const valor of peligrosos) {
      const csv = toCsv<Fila>(cabeceras, [{ nombre: valor, telefono: "1" }]);
      const fila = csv.replace(/^\uFEFF/, "").split("\n")[1];
      expect(fila.startsWith("'") || fila.startsWith("\"'"), valor).toBe(true);
    }
  });

  it("no toca un texto normal", () => {
    const csv = toCsv<Fila>(cabeceras, [
      { nombre: "Ana Gómez", telefono: "3515123456" },
    ]);
    expect(csv).not.toContain("'Ana");
  });

  it("una celda vacía o nula queda vacía, no dice 'null'", () => {
    const csv = toCsv<{ a: string | null; b: undefined }>({ a: "A", b: "B" }, [
      { a: null, b: undefined },
    ]);
    expect(celdas(csv)[1]).toEqual(["", ""]);
  });
});
