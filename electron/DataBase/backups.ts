import fs from "node:fs";
import path from "node:path";
import { DataSource } from "typeorm";
import { checkDatabaseHealth } from "./migrationSafety";

/**
 * Respaldos automáticos: cómo se sacan y cuáles se conservan.
 *
 * Antes se hacía `fs.copyFileSync` del `.db` y se guardaban las últimas 7 copias
 * diarias. Dos problemas:
 *
 * - Copiar el archivo a secas puede capturarlo **a mitad de una escritura**, o
 *   sin el journal que necesita para quedar consistente. La copia parece bien
 *   hasta el día que hay que usarla.
 * - Con 7 diarias, un problema que se detecta a los diez días **ya no tiene
 *   ningún respaldo sano**: los siete que quedan son todos posteriores al daño.
 *   Justo los errores que importan —un dato borrado por accidente, una
 *   corrupción silenciosa— son los que se descubren tarde.
 *
 * Ahora la copia se hace con `VACUUM INTO`, se le corre `integrity_check` antes
 * de darla por buena, y la retención es por niveles: además de los últimos días
 * se conserva una copia por semana y una por mes, así siempre hay a dónde volver.
 */

const PREFIX = "taller_";
const SUFFIX = ".db";

/** Cuántas copias se conservan de cada nivel. */
export const RETENTION = { diarias: 7, semanales: 4, mensuales: 6 } as const;

/** Nombre del respaldo de un día: `taller_2026-09-06.db`. */
export const backupFileName = (date: Date): string =>
  `${PREFIX}${dayKey(date)}${SUFFIX}`;

const pad = (n: number) => String(n).padStart(2, "0");

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

/**
 * Clave de semana ISO. Se usa la semana ISO y no "cada 7 días" para que el corte
 * caiga siempre el mismo día y las semanas no se corran con el tiempo.
 */
const weekKey = (d: Date) => {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // Jueves de esa semana: define a qué año ISO pertenece.
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const primerJueves = new Date(t.getFullYear(), 0, 4);
  primerJueves.setDate(
    primerJueves.getDate() + 3 - ((primerJueves.getDay() + 6) % 7)
  );
  const semana =
    1 + Math.round((t.getTime() - primerJueves.getTime()) / (7 * 86400000));
  return `${t.getFullYear()}-S${pad(semana)}`;
};

export interface BackupFile {
  name: string;
  path: string;
  date: Date;
}

/** Respaldos del directorio, del más nuevo al más viejo. */
export const listBackups = (dir: string): BackupFile[] => {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(PREFIX) && f.endsWith(SUFFIX))
    .map((name) => {
      const raw = name.slice(PREFIX.length, -SUFFIX.length);
      const [y, m, d] = raw.split("-").map(Number);
      return { name, path: path.join(dir, name), date: new Date(y, m - 1, d) };
    })
    .filter((f) => !Number.isNaN(f.date.getTime()))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
};

/**
 * Cuáles se conservan, según la retención por niveles.
 *
 * Para cada nivel se recorren los respaldos del más nuevo al más viejo y se
 * conserva **el más reciente de cada período**, hasta completar la cantidad de
 * períodos del nivel. Un mismo archivo puede cubrir varios niveles a la vez (el
 * de hoy es el diario de hoy, el semanal de esta semana y el mensual de este
 * mes), y por eso el total conservado es menor que 7 + 4 + 6.
 */
export const selectKept = (
  backups: BackupFile[],
  retention: {
    diarias: number;
    semanales: number;
    mensuales: number;
  } = RETENTION
): Set<string> => {
  const kept = new Set<string>();

  const niveles: [(d: Date) => string, number][] = [
    [dayKey, retention.diarias],
    [weekKey, retention.semanales],
    [monthKey, retention.mensuales],
  ];

  for (const [key, cantidad] of niveles) {
    const periodos = new Set<string>();
    for (const backup of backups) {
      const periodo = key(backup.date);
      if (periodos.has(periodo)) continue;
      if (periodos.size >= cantidad) break;
      periodos.add(periodo);
      kept.add(backup.path);
    }
  }

  return kept;
};

/** Borra los respaldos que ya no entran en la retención. Devuelve los borrados. */
export const applyRetention = (
  dir: string,
  retention?: { diarias: number; semanales: number; mensuales: number }
): string[] => {
  const backups = listBackups(dir);
  const kept = selectKept(backups, retention);
  const borrados = backups.filter((b) => !kept.has(b.path)).map((b) => b.path);
  for (const file of borrados) fs.rmSync(file, { force: true });
  return borrados;
};

export interface BackupResult {
  /** `true` si ya existía el respaldo de hoy y no se hizo nada. */
  skipped: boolean;
  path: string;
  bytes: number;
  removed: string[];
}

/**
 * Saca el respaldo del día, si todavía no existe, y aplica la retención.
 *
 * La copia se escribe a un temporal, se **verifica** abriéndola y corriéndole
 * `integrity_check`, y sólo entonces se renombra al nombre definitivo. Un
 * respaldo que no se puede verificar no es un respaldo: si falla, se descarta el
 * temporal y se propaga el error, en vez de dejar un archivo con nombre de copia
 * buena que nadie va a mirar hasta que sea tarde.
 */
export const createDailyBackup = async (
  dataSource: DataSource,
  { dir, now = new Date() }: { dir: string; now?: Date }
): Promise<BackupResult> => {
  fs.mkdirSync(dir, { recursive: true });

  const target = path.join(dir, backupFileName(now));
  if (fs.existsSync(target)) {
    return {
      skipped: true,
      path: target,
      bytes: fs.statSync(target).size,
      removed: applyRetention(dir),
    };
  }

  const temp = `${target}.parcial`;
  fs.rmSync(temp, { force: true });

  await dataSource.query("VACUUM INTO ?", [temp]);

  const verificacion = new DataSource({
    type: "better-sqlite3",
    database: temp,
    synchronize: false,
    migrationsRun: false,
    logging: false,
    entities: [],
  });
  await verificacion.initialize();
  let salud;
  try {
    salud = await checkDatabaseHealth(verificacion);
  } finally {
    await verificacion.destroy();
  }

  if (!salud.ok) {
    fs.rmSync(temp, { force: true });
    throw new Error(
      `El respaldo no superó la verificación de integridad: ${salud.problems
        .slice(0, 3)
        .join(" | ")}`
    );
  }

  fs.renameSync(temp, target);

  return {
    skipped: false,
    path: target,
    bytes: fs.statSync(target).size,
    removed: applyRetention(dir),
  };
};
