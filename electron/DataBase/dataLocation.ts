import fs from "node:fs";
import path from "node:path";
import { DataSource } from "typeorm";

/**
 * Traslado de la base desde su ubicación histórica a la definitiva.
 *
 * Hasta la 1.0.x la base productiva vivía en `Documentos/taller.db`: una carpeta
 * que el usuario ve, que puede mover o borrar sin saber qué es, y que en la
 * mayoría de las instalaciones de Windows **sincroniza OneDrive**. Eso último es
 * lo grave: OneDrive puede tomar el archivo mientras SQLite escribe, y una base
 * bloqueada a mitad de una transacción es exactamente el escenario que rompe los
 * datos.
 *
 * El módulo no importa Electron —recibe las rutas por parámetro— así que se
 * puede ejercitar contra copias.
 */

/** Sufijo con el que se aparta la base vieja una vez trasladada. */
const RETIRED_SUFFIX = ".migrated";

/**
 * Archivos que SQLite deja al lado de la base.
 *
 * En la práctica el `-journal` casi nunca llega hasta acá: al abrir la base para
 * copiarla, el motor recupera la transacción pendiente y lo borra él mismo
 * (verificado). Se contemplan igual porque `-wal`/`-shm` sí sobreviven si alguna
 * vez se activa el modo WAL, y dejar sueltos en Documentos archivos con el
 * nombre de la base sólo sirve para confundir.
 */
const SIDECAR_SUFFIXES = ["-journal", "-wal", "-shm"];

export type RelocationOutcome =
  | { status: "sin-base-anterior" }
  | { status: "ya-trasladada"; legacyPath: string }
  | {
      status: "trasladada";
      legacyPath: string;
      retiredPath: string;
      targetPath: string;
      bytes: number;
    };

const stamp = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}`
  );
};

/**
 * Nombre con el que se aparta la base vieja. Si ya hay una apartada —pasa si se
 * reinstaló la versión anterior y se volvió a actualizar— se le agrega la marca
 * de tiempo en vez de pisarla.
 */
export const retiredPathFor = (legacyPath: string, now: Date): string => {
  const base = `${legacyPath}${RETIRED_SUFFIX}`;
  return fs.existsSync(base) ? `${base}.${stamp(now)}` : base;
};

/**
 * Traslada la base a su ubicación nueva, si corresponde. Es idempotente: en
 * cuanto la base nueva existe, no vuelve a hacer nada.
 *
 * Se copia con **`VACUUM INTO`** y no con `fs.copyFileSync` por el mismo motivo
 * que la copia previa a las migraciones: el motor escribe una base nueva y
 * consistente a partir de la transacción en curso. Copiar el archivo a secas
 * puede capturarlo a mitad de una escritura, y si además había un journal
 * pendiente la copia queda inservible justo cuando más se la necesita.
 *
 * El orden importa: primero se escribe la base nueva completa, y **sólo cuando
 * está lista** se aparta la vieja. Si el proceso muere en el medio, la vieja
 * sigue en su lugar y el próximo arranque reintenta.
 */
export const relocateLegacyDatabase = async ({
  legacyPath,
  targetPath,
  now = new Date(),
}: {
  legacyPath: string;
  targetPath: string;
  now?: Date;
}): Promise<RelocationOutcome> => {
  if (fs.existsSync(targetPath)) {
    return fs.existsSync(legacyPath)
      ? { status: "ya-trasladada", legacyPath }
      : { status: "sin-base-anterior" };
  }
  if (!fs.existsSync(legacyPath)) return { status: "sin-base-anterior" };

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  const temp = `${targetPath}.parcial`;
  fs.rmSync(temp, { force: true });

  const source = new DataSource({
    type: "better-sqlite3",
    database: legacyPath,
    synchronize: false,
    migrationsRun: false,
    logging: false,
    entities: [],
  });

  await source.initialize();
  try {
    await source.query("VACUUM INTO ?", [temp]);
  } finally {
    await source.destroy();
  }

  fs.renameSync(temp, targetPath);

  // Recién ahora se aparta la vieja: hasta este punto era la única copia buena.
  const retiredPath = retiredPathFor(legacyPath, now);
  fs.renameSync(legacyPath, retiredPath);
  for (const suffix of SIDECAR_SUFFIXES) {
    const sidecar = `${legacyPath}${suffix}`;
    if (fs.existsSync(sidecar))
      fs.renameSync(sidecar, `${retiredPath}${suffix}`);
  }

  return {
    status: "trasladada",
    legacyPath,
    retiredPath,
    targetPath,
    bytes: fs.statSync(targetPath).size,
  };
};
