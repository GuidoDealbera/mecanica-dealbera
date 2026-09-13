import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Todo botón que sólo tiene un ícono tiene que decir cómo se llama.
 *
 * Había **24 usos de `isIconOnly` y ninguno declaraba `aria-label`**. Un botón
 * cuyo único contenido es un `<svg>` no tiene texto: para un lector de pantalla
 * es "botón", sin más. Y afecta a las acciones más comunes —borrar, editar,
 * refrescar, emitir—.
 *
 * El `Tooltip` no alcanza: ayuda con el mouse y no con el teclado.
 *
 * De paso arregla los tests: sin nombre accesible no se puede escribir
 * `getByRole("button", { name: /eliminar/i })`, que es la forma correcta de
 * encontrar un botón, y hay que caer en selectores por clase o por posición.
 *
 * Esto se revisa leyendo los archivos y no montando la aplicación: la regla vale
 * para todos los botones, incluidos los de pantallas que ningún test monta, y es
 * justamente en esos donde se cuela el que falta.
 */

const RAIZ = path.join(__dirname, "..");

const archivos = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) return archivos(completo);
    if (!entrada.name.endsWith(".tsx")) return [];
    if (entrada.name.includes(".test.")) return [];
    return [completo];
  });

/**
 * Los `isIconOnly` cuyo bloque de props no declara un nombre accesible.
 *
 * Se mira una ventana de renglones alrededor y no el JSX parseado: alcanza para
 * lo que se está cuidando, y un parser de JSX acá sería más código que el que
 * revisa.
 */
const sinNombre = (contenido: string, archivo: string): string[] => {
  const lineas = contenido.split("\n");
  const fallas: string[] = [];

  lineas.forEach((linea, i) => {
    if (!linea.includes("isIconOnly")) return;
    const bloque = lineas.slice(Math.max(0, i - 8), i + 14).join("\n");
    if (!bloque.includes("aria-label")) {
      fallas.push(`${path.basename(archivo)}:${i + 1}`);
    }
  });

  return fallas;
};

describe("botones de sólo ícono", () => {
  it("hay varios, o esta prueba no está probando nada", () => {
    const total =
      archivos(RAIZ)
        .map((f) => fs.readFileSync(f, "utf8"))
        .join("\n")
        .split("isIconOnly").length - 1;

    expect(total).toBeGreaterThanOrEqual(20);
  });

  it("todos declaran su nombre accesible", () => {
    const fallas = archivos(RAIZ).flatMap((archivo) =>
      sinNombre(fs.readFileSync(archivo, "utf8"), archivo)
    );

    // Se reportan todos juntos: así el fallo dice qué botones hay que arreglar
    // en vez de sólo el primero.
    expect(fallas).toEqual([]);
  });
});
