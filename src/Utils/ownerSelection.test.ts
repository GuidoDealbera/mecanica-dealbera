import { describe, expect, it } from "vitest";
import {
  buscarTitularPorId,
  seleccionTrasEditarNombre,
} from "./ownerSelection";

/**
 * La regla que decide si el auto va a una ficha que ya existe o a una nueva.
 *
 * Los dos casos que importan son homónimos y renombre, que es justamente lo que
 * el sistema no podía representar mientras el nombre fuera la clave.
 */

const ana = { id: "cli-1", fullname: "Ana Gómez" };
const otraAna = { id: "cli-2", fullname: "Ana Gómez" };

describe("elegir el titular del autocompletar", () => {
  it("distingue a dos clientes que se llaman igual", () => {
    const resultados = [ana, otraAna];

    // Esto es lo que con el nombre como clave era imposible: las dos opciones
    // eran la misma y elegir una devolvía siempre la primera.
    expect(buscarTitularPorId(resultados, "cli-2")).toBe(otraAna);
    expect(buscarTitularPorId(resultados, "cli-1")).toBe(ana);
  });

  it("no elige a nadie si la clave no está en los resultados", () => {
    // Pasa de verdad: la lista se renueva mientras se escribe, y la selección
    // vieja puede quedar apuntando a alguien que ya no está.
    expect(buscarTitularPorId([ana], "cli-9")).toBeUndefined();
    expect(buscarTitularPorId([ana], null)).toBeUndefined();
  });
});

describe("qué pasa con la selección al editar el nombre", () => {
  it("cambiar el nombre convierte al titular en uno nuevo", () => {
    // El usuario eligió a Ana y le agregó un apellido: ya no es Ana, es otra
    // persona que hay que dar de alta.
    expect(seleccionTrasEditarNombre(ana, "Ana Gómez Pérez")).toBeUndefined();
    expect(seleccionTrasEditarNombre(ana, "")).toBeUndefined();
  });

  it("conserva la selección mientras el texto sea el del elegido", () => {
    // Y devuelve **el mismo objeto**: el formulario rellena los datos del
    // titular en un efecto que depende de esta referencia, así que una copia
    // haría que los campos se reescribieran en cada tecla.
    expect(seleccionTrasEditarNombre(ana, "Ana Gómez")).toBe(ana);
  });

  it("sin selección previa no inventa una", () => {
    expect(seleccionTrasEditarNombre(undefined, "Ana Gómez")).toBeUndefined();
  });
});
