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

/**
 * La etiqueta de apertura de un `<Modal`, hasta su `>`.
 *
 * El cierre se busca por renglón y no por carácter: dentro de las props suele
 * haber un `=>`, y cortar ahí dejaría afuera la mitad de la etiqueta.
 */
const etiquetaDeApertura = (lineas: string[], i: number): string => {
  const bloque: string[] = [];
  for (let j = i; j < Math.min(lineas.length, i + 25); j++) {
    bloque.push(lineas[j]);
    const t = lineas[j].trim();
    if (t === ">" || (j === i && /[^=]>$/.test(t))) break;
  }
  return bloque.join("\n");
};

/**
 * Los modales que muestran la cruz de cerrar sin `CerrarModal`.
 *
 * HeroUI la rotula "Close" escrito a mano, y el `locale` del provider no la
 * alcanza. Un modal nuevo que se olvide de `closeButton={<CerrarModal />}` se
 * vuelve a anunciar en inglés, y nada en la pantalla lo delata. Uno que la
 * esconda siempre (`hideCloseButton` a secas) no la necesita; uno que la
 * esconda a veces (`hideCloseButton={...}`), sí.
 */
const modalesEnIngles = (contenido: string, archivo: string): string[] => {
  const lineas = contenido.split("\n");
  const fallas: string[] = [];

  lineas.forEach((linea, i) => {
    if (!/<Modal(\s|$)/.test(linea)) return;
    const etiqueta = etiquetaDeApertura(lineas, i);
    const sinCruz = etiqueta
      .split("\n")
      .some((l) => l.trim() === "hideCloseButton");
    if (!sinCruz && !etiqueta.includes("closeButton={<CerrarModal")) {
      fallas.push(`${path.basename(archivo)}:${i + 1}`);
    }
  });

  return fallas;
};

describe("la cruz de los modales", () => {
  it("hay varios modales, o esta prueba no está probando nada", () => {
    const total = archivos(RAIZ)
      .map((f) => fs.readFileSync(f, "utf8"))
      .join("\n")
      .split("\n")
      .filter((l) => /<Modal(\s|$)/.test(l)).length;

    expect(total).toBeGreaterThanOrEqual(8);
  });

  it("todos la muestran con su nombre en castellano, o no la muestran", () => {
    const fallas = archivos(RAIZ).flatMap((archivo) =>
      modalesEnIngles(fs.readFileSync(archivo, "utf8"), archivo)
    );

    expect(fallas).toEqual([]);
  });
});

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
