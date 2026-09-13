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
 * Migraciones anotadas en la base que **esta versión no conoce**.
 *
 * Es el caso inverso al de una base vieja: un archivo hecho por una versión
 * posterior trae migraciones que acá no existen, `showMigrations()` dice que no
 * hay nada pendiente —porque para esta versión no lo hay— y la aplicación
 * termina trabajando contra un esquema del futuro. Pasa al restaurar un
 * respaldo después de volver a una versión anterior.
 *
 * Se consulta la tabla directamente y no por la API de TypeORM porque lo que
 * interesa es justamente lo que TypeORM **no** sabe mapear.
 *
 * El nombre sale de la propiedad `name` que declara cada migración, **no de
 * `constructor.name`**. El bundle del proceso principal va minificado, así que
 * ahí el nombre de la clase es una letra: con `constructor.name` esta función
 * daba por desconocidas a las once migraciones propias y no dejaba arrancar.
 * TypeORM usa la propiedad declarada por el mismo motivo.
 *
 * Devuelve `[]` si la tabla no existe: una base que nunca migró no tiene nada
 * desconocido, tiene todo pendiente.
 */
export const findUnknownMigrations = async (
  dataSource: DataSource
): Promise<string[]> => {
  const conocidas = new Set(
    dataSource.migrations.map(
      (migration) => migration.name ?? migration.constructor.name
    )
  );

  // Se pregunta si la tabla existe en vez de consultarla y atajar el error. Con
  // el `try/catch`, en una base nueva el `SELECT` fallaba igual y TypeORM lo
  // registraba como error —tiene el registro de consultas encendido en
  // desarrollo—: un "SqliteError: no such table: migrations" en el arranque que
  // no era ningún problema pero parecía uno.
  const existe = await dataSource.query<{ n: number }[]>(
    "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'migrations'"
  );
  if (!Number(existe?.[0]?.n)) return [];

  const rows = await dataSource.query<{ name: string }[]>(
    "SELECT name FROM migrations"
  );
  return rows.map((row) => row.name).filter((name) => !conocidas.has(name));
};

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
 * Archivos que SQLite deja al lado de la base: el journal del modo por defecto
 * y los dos del modo WAL.
 */
const LATERALES = ["-journal", "-wal", "-shm"];

/**
 * Borra los archivos laterales de una base.
 *
 * Va antes de dejar un `.db` distinto en esa ruta. Un `-journal` o un `-wal`
 * que quedó del archivo anterior **no le corresponde** al nuevo, y SQLite lo
 * aplicaría igual: no hay forma de que se dé cuenta.
 *
 * Hoy el riesgo es bajo y está medido: la base corre en `journal_mode = delete`
 * —comprobado en ejecución—, así que no hay un `-wal` permanente dando vueltas.
 * Pero eso es una suposición que no estaba escrita en ningún lado, y alcanza
 * con que alguien active WAL buscando rendimiento para que pase de improbable a
 * corrupción. Cuesta dos renglones.
 */
export const removeSidecarFiles = (dbPath: string): void => {
  for (const sufijo of LATERALES) {
    fs.rmSync(`${dbPath}${sufijo}`, { force: true });
  }
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

  // Los laterales que hubiera quedado son de la base que se acaba de apartar.
  removeSidecarFiles(dbPath);
  fs.copyFileSync(snapshotPath, dbPath);
  return { brokenCopyPath };
};
