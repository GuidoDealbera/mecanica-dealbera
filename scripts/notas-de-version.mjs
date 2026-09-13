/**
 * Saca del CHANGELOG las notas de la versión que se está publicando.
 *
 * La aplicación **muestra** `info.releaseNotes` en el cartel de actualización:
 * el código está escrito desde siempre y recibía vacío, así que el usuario veía
 * "hay una versión nueva" sin una palabra de qué traía.
 *
 * Se extrae la sección de la versión de `package.json` y nada más: publicar el
 * changelog entero en cada release haría que el cartel repita lo de todas las
 * versiones anteriores.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(
  fs.readFileSync(path.join(raiz, "package.json"), "utf8")
);

const changelog = fs.readFileSync(path.join(raiz, "CHANGELOG.md"), "utf8");
const lineas = changelog.split("\n");
const desde = lineas.findIndex((l) => l.trim() === `## ${version}`);

if (desde === -1) {
  // Falla en vez de publicar sin notas: que el release salga mudo es
  // exactamente lo que esto vino a evitar, y en silencio no se arregla nunca.
  console.error(
    `No hay una sección "## ${version}" en CHANGELOG.md. ` +
      `Agregala antes de publicar.`
  );
  process.exit(1);
}

const resto = lineas.slice(desde + 1);
const hasta = resto.findIndex((l) => l.startsWith("## "));
const notas = (hasta === -1 ? resto : resto.slice(0, hasta)).join("\n").trim();

const destino = path.join(raiz, "build", "release-notes.md");
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, `${notas}\n`, "utf8");

console.log(`Notas de la ${version}: ${notas.length} caracteres → ${destino}`);
