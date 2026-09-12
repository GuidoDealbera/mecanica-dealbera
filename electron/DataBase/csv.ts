/**
 * Armado del CSV que se exporta.
 *
 * Vive en su propio módulo —y no dentro del endpoint— por dos razones: no
 * necesita Electron ni la base, y **hay que poder probarlo**. Lo que hace no es
 * obvio y equivocarse tiene consecuencias que no se ven al abrir el archivo.
 */

/**
 * Caracteres con los que Excel y LibreOffice interpretan la celda como una
 * **fórmula** en vez de como texto.
 *
 * El tabulador y el retorno de carro entran porque algunas versiones los saltean
 * y evalúan lo que sigue.
 */
const INICIOS_DE_FORMULA = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Neutraliza una celda que la planilla tomaría como fórmula.
 *
 * `toCsv` escapaba comillas y separadores —correcto para el formato— pero no
 * esto, que es un problema distinto: el archivo está bien formado y la fórmula
 * se ejecuta igual al abrirlo. Y acá los datos los escribe una persona en un
 * formulario, así que un cliente llamado `=HYPERLINK(...)` alcanza.
 *
 * El apóstrofo delante es la neutralización estándar: la planilla lo consume y
 * muestra el texto tal cual.
 *
 * Se escapa también un valor que empiece con `-` aunque sea un número negativo.
 * En este CSV no hay ninguno —kilometraje, año y cantidad de trabajos son
 * siempre positivos— y el arranque clásico de una carga por DDE es justamente
 * un `-`, así que el intercambio conviene.
 */
export const neutralizarFormula = (valor: string): string =>
  INICIOS_DE_FORMULA.some((inicio) => valor.startsWith(inicio))
    ? `'${valor}`
    : valor;

/**
 * Escapa una celda para el formato CSV: comillas dobladas y entrecomillado
 * cuando el valor trae el separador, comillas o saltos de línea.
 */
const escaparCelda = (valor: unknown): string => {
  const texto = valor == null ? "" : String(valor);
  const seguro = neutralizarFormula(texto);
  return seguro.includes(";") ||
    seguro.includes('"') ||
    seguro.includes("\n") ||
    seguro.includes("\r")
    ? `"${seguro.replace(/"/g, '""')}"`
    : seguro;
};

/**
 * Arma el CSV a partir de las cabeceras (mapa campo → título) y las filas.
 *
 * Lleva BOM porque es lo que hace que Excel en Windows lo abra como UTF-8; sin
 * él, los acentos y la eñe salen rotos.
 */
export function toCsv<T extends object>(
  headers: Partial<Record<keyof T, string>>,
  rows: T[]
): string {
  const BOM = "\uFEFF";
  const keys = Object.keys(headers) as (keyof T)[];
  const headerRow = keys.map((k) => escaparCelda(headers[k])).join(";");
  const dataRows = rows.map((row) =>
    keys.map((k) => escaparCelda(row[k])).join(";")
  );
  return BOM + [headerRow, ...dataRows].join("\n");
}
