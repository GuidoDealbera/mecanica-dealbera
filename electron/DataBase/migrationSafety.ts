import fs from "node:fs";
import path from "node:path";
import type { DataSource } from "typeorm";

/**
 * Red de seguridad alrededor de las migraciones.
 *
 * Hasta ahora la aplicación abría la base con `migrationsRun: true`: las
 * migraciones corrían solas al iniciar, sin respaldo previo y sin comprobar
 * después que la base hubiera quedado sana. Una migración que falle a mitad deja
 * el archivo en un estado intermedio y la única red era el respaldo diario, que
 * puede ser de ayer.
 *
 * Acá viven las tres piezas: la copia previa, la comprobación posterior y la
 * restauración. Ninguna importa Electron —reciben el `DataSource` y las rutas
 * por parámetro— así que se pueden ejercitar contra una copia de la base.
 */

/** Prefijo de los archivos de copia previa, para distinguirlos de los diarios. */
const SNAPSHOT_PREFIX = "pre-migration_";

/** Cuántas copias previas se conservan. */
const SNAPSHOT_KEEP = 3;

/** Marca de tiempo ordenable y legible: `2026-08-16_1432`. */
const stamp = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}`
  );
};

/**
 * Nombre del archivo de copia previa.
 *
 * Lleva versión **y** marca de tiempo: con la versión sola, dos arranques de la
 * misma versión pisarían la única copia buena (justo lo que se quiere conservar
 * si el primero dejó la base rota).
 */
export const snapshotFileName = (version: string, at: Date): string =>
  `${SNAPSHOT_PREFIX}${version}_${stamp(at)}.db`;

/** Copias previas del directorio, de la más vieja a la más nueva. */
export const listSnapshots = (dir: string): string[] => {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(SNAPSHOT_PREFIX) && f.endsWith(".db"))
    .sort()
    .map((f) => path.join(dir, f));
};

/** La copia previa más reciente, o `null` si no hay ninguna. */
export const latestSnapshot = (dir: string): string | null =>
  listSnapshots(dir).at(-1) ?? null;

/** Borra las copias previas más viejas y devuelve las que eliminó. */
export const pruneSnapshots = (dir: string, keep = SNAPSHOT_KEEP): string[] => {
  const snapshots = listSnapshots(dir);
  const sobran = snapshots.slice(0, Math.max(0, snapshots.length - keep));
  for (const file of sobran) fs.rmSync(file, { force: true });
  return sobran;
};

/**
 * ¿Quedan migraciones sin aplicar en esta base?
 *
 * Ojo con un efecto de TypeORM: consultarlo **crea la tabla `migrations`** si no
 * existía. Es inocuo —queda vacía— pero significa que la copia previa de una
 * base que nunca migró va a incluirla, también vacía. Al restaurar, el resultado
 * es el mismo: cero migraciones aplicadas, así que vuelven a correr todas.
 */
export const hasPendingMigrations = (
  dataSource: DataSource
): Promise<boolean> => dataSource.showMigrations();

/**
 * Copia la base **antes** de migrar, con `VACUUM INTO`.
 *
 * `VACUUM INTO` y no `fs.copyFileSync`: el motor escribe una base nueva y
 * consistente a partir de la transacción en curso, así que la copia nunca queda
 * a mitad de una escritura ni depende de que el journal esté al día. Además sale
 * compactada.
 *
 * Se escribe primero a un archivo temporal y recién al terminar se renombra al
 * nombre definitivo: si el proceso muere en el medio, no queda un archivo con
 * nombre de copia buena y contenido incompleto.
 */
export const createPreMigrationSnapshot = async (
  dataSource: DataSource,
  {
    dir,
    version,
    now = new Date(),
  }: { dir: string; version: string; now?: Date }
): Promise<{ path: string; bytes: number }> => {
  fs.mkdirSync(dir, { recursive: true });

  const target = path.join(dir, snapshotFileName(version, now));
  const temp = `${target}.parcial`;
  // `VACUUM INTO` falla si el destino ya existe.
  fs.rmSync(temp, { force: true });
  fs.rmSync(target, { force: true });

  await dataSource.query("VACUUM INTO ?", [temp]);
  fs.renameSync(temp, target);

  return { path: target, bytes: fs.statSync(target).size };
};

/**
 * Comprueba que la base haya quedado sana después de migrar.
 *
 * Son dos comprobaciones distintas y se informan por separado a propósito:
 *
 * - `integrity_check` mira la estructura del archivo (páginas, índices, árboles).
 *   Si falla, la base está corrupta: no es opinable.
 * - `foreign_key_check` mira las referencias entre tablas. Una violación acá
 *   puede venir de datos viejos que nunca tuvieron la restricción activa, así
 *   que se informa pero no se trata como corrupción.
 */
export const checkDatabaseHealth = async (
  dataSource: DataSource
): Promise<{
  ok: boolean;
  problems: string[];
  foreignKeyViolations: number;
}> => {
  const rows = await dataSource.query<{ integrity_check: string }[]>(
    "PRAGMA integrity_check"
  );
  const problems = rows
    .map((row) => row.integrity_check)
    .filter((value) => value !== "ok");

  const fk = await dataSource.query<unknown[]>("PRAGMA foreign_key_check");

  return {
    ok: problems.length === 0,
    problems,
    foreignKeyViolations: fk.length,
  };
};

/**
 * Vuelve la base al contenido de una copia previa.
 *
 * Quien llama tiene que haber cerrado el `DataSource` antes: se está
 * reemplazando el archivo que el motor tiene abierto. La base rota no se borra,
 * se guarda al lado con sufijo `.rota-<marca>` para poder revisarla después.
 */
export const restoreSnapshot = (
  snapshotPath: string,
  dbPath: string,
  now = new Date()
): { brokenCopyPath: string | null } => {
  if (!fs.existsSync(snapshotPath)) {
    throw new Error(`No se encontró la copia previa: ${snapshotPath}`);
  }

  let brokenCopyPath: string | null = null;
  if (fs.existsSync(dbPath)) {
    brokenCopyPath = `${dbPath}.rota-${stamp(now)}`;
    fs.rmSync(brokenCopyPath, { force: true });
    fs.renameSync(dbPath, brokenCopyPath);
  }

  fs.copyFileSync(snapshotPath, dbPath);
  return { brokenCopyPath };
};
