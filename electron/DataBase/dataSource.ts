import { DataSource } from "typeorm";
import path from "path";
import { app } from "electron";
import { logError, logInfo, logWarn } from "../logger";
import {
  checkDatabaseHealth,
  createPreMigrationSnapshot,
  hasPendingMigrations,
  pruneSnapshots,
  restoreSnapshot,
} from "./migrationSafety";
import { Car } from "./Entities/car.entity";
import { Client } from "./Entities/client.entity";
import { Job } from "./Entities/job.entity";
import { Document } from "./Entities/document.entity";
import { ServiceReminder } from "./Entities/serviceReminder.entity";
import { AppSetting } from "./Entities/appSetting.entity";
import { InitialSchema1700000000000 } from "./Migrations/1700000000000-InitialSchema";
import { AddPartsToExistingJobs1700000002000 } from "./Migrations/AddPartsToExistingJobs1700000002000";
import { AddOwnerIndex1700000003000 } from "./Migrations/AddOwnerIndex1700000003000";
import { NormalizeJobs1700000004000 } from "./Migrations/NormalizeJobs1700000004000";
import { AddNotesToJob1700000005000 } from "./Migrations/AddNotesToJob1700000005000";
import { CreateDocumentTable1700000006000 } from "./Migrations/CreateDocumentTable1700000006000";
import { CreateServiceReminders1700000007000 } from "./Migrations/CreateServiceReminders1700000007000";
import { AddJobStatusIndex1700000008000 } from "./Migrations/AddJobStatusIndex1700000008000";

export const AppDataSource = new DataSource({
  type: "sqlite",
  database: getDBPath(),
  entities: [Car, Client, Job, Document, ServiceReminder, AppSetting],
  synchronize: false,
  logging: process.env.NODE_ENV === "development",
  // Las migraciones **no** corren solas al conectar: las lanza `initializeDB`
  // después de sacar una copia de la base y comprueba el resultado. Ver
  // `runPendingMigrations`.
  migrationsRun: false,
  migrations: [
    InitialSchema1700000000000,
    AddPartsToExistingJobs1700000002000,
    AddOwnerIndex1700000003000,
    NormalizeJobs1700000004000,
    AddNotesToJob1700000005000,
    CreateDocumentTable1700000006000,
    CreateServiceReminders1700000007000,
    AddJobStatusIndex1700000008000,
  ],
  subscribers: [],
});

/**
 * Carpeta donde viven la base y sus respaldos.
 *
 * `MECANICA_DATA_DIR` es el punto de escape para las pruebas de extremo a
 * extremo, que arrancan la aplicación de verdad: sin él, un test escribiría
 * sobre la base real del usuario. En uso normal la variable no existe.
 */
function getDataDir(): string {
  const override = process.env.MECANICA_DATA_DIR;
  if (override) return override;

  return process.env.NODE_ENV === "development"
    ? path.join(process.cwd(), "data")
    : app.getPath("documents");
}

export function getDBPath() {
  return path.join(getDataDir(), "taller.db");
}

/**
 * Carpeta de respaldos: al lado de la base, para que las copias viajen con ella
 * y para que en desarrollo no se escriba en los Documentos del usuario.
 */
export function getBackupDir() {
  return path.join(path.dirname(getDBPath()), "backups");
}

/**
 * Fallo del que **ya se avisó al usuario** con su propio cuadro de diálogo.
 * `initializeDB` lo reconoce para no mostrar un segundo aviso encima.
 */
class ReportedStartupError extends Error {}

/**
 * Aplica las migraciones pendientes con red: copia previa, migración y
 * comprobación de que la base quedó sana.
 *
 * Antes esto lo hacía `migrationsRun: true` al conectar, sin copia previa y sin
 * comprobar nada después. Las tres decisiones que vale la pena tener presentes:
 *
 * - **Sin copia no se migra.** Si no se puede escribir la copia (disco lleno,
 *   permisos), la aplicación no arranca en vez de migrar a ciegas: dejar la base
 *   intacta y pedir que se libere espacio es recuperable; una migración a medio
 *   aplicar sobre la única copia de los datos del taller, no.
 * - **La comprobación corre sólo cuando hubo migraciones.** `integrity_check`
 *   recorre el archivo entero; no tiene sentido pagarlo en cada arranque normal.
 * - **Restaurar no reintenta.** Si se restaura, la aplicación se cierra: volver a
 *   abrirla correría la misma migración fallida contra los mismos datos.
 */
const runPendingMigrations = async (): Promise<void> => {
  if (!(await hasPendingMigrations(AppDataSource))) return;

  const version = app.getVersion();
  const backupDir = getBackupDir();

  let snapshotPath: string;
  try {
    const snapshot = await createPreMigrationSnapshot(AppDataSource, {
      dir: backupDir,
      version,
    });
    snapshotPath = snapshot.path;
    logInfo("db:migrate", "Copia previa a las migraciones creada", {
      path: snapshotPath,
      kb: Math.round(snapshot.bytes / 1024),
    });
    const borradas = pruneSnapshots(backupDir);
    if (borradas.length > 0) {
      logInfo("db:migrate", "Copias previas antiguas eliminadas", {
        count: borradas.length,
      });
    }
  } catch (error) {
    logError("db:migrate:snapshot", error, { backupDir });
    throw new Error(
      "No se pudo crear la copia de seguridad previa a la actualización de la " +
        `base de datos (${backupDir}). La base quedó intacta y no se aplicó ` +
        "ningún cambio. Liberá espacio en el disco y volvé a abrir la aplicación."
    );
  }

  try {
    const executed = await AppDataSource.runMigrations();
    logInfo("db:migrate", "Migraciones aplicadas", {
      count: executed.length,
      names: executed.map((m) => m.name),
    });
  } catch (error) {
    logError("db:migrate:run", error);
    await offerRestore(
      snapshotPath,
      "La actualización de la base de datos no pudo completarse."
    );
    throw new ReportedStartupError(
      `Falló una migración: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const health = await checkDatabaseHealth(AppDataSource);
  if (health.foreignKeyViolations > 0) {
    // No se trata como corrupción: puede venir de datos viejos anteriores a la
    // restricción. Queda registrado para poder revisarlo.
    logWarn("db:migrate", "Referencias huérfanas después de migrar", {
      count: health.foreignKeyViolations,
    });
  }
  if (!health.ok) {
    logError(
      "db:migrate:integrity",
      new Error(health.problems.slice(0, 5).join(" | "))
    );
    await offerRestore(
      snapshotPath,
      "La base de datos quedó dañada después de la actualización."
    );
    throw new ReportedStartupError(
      "La base de datos no superó la verificación de integridad"
    );
  }

  logInfo("db:migrate", "Verificación de integridad correcta");
};

/**
 * Ofrece volver a la copia previa. Cualquiera sea la respuesta, quien llama
 * cierra la aplicación: la base no está en condiciones de usarse.
 */
const offerRestore = async (
  snapshotPath: string,
  reason: string
): Promise<void> => {
  const { dialog } = await import("electron");

  const { response } = await dialog.showMessageBox({
    type: "error",
    title: "Error al actualizar la base de datos",
    message: reason,
    detail:
      `Hay una copia de los datos tal como estaban antes de la actualización:\n${snapshotPath}\n\n` +
      "Se puede restaurar ahora. La aplicación se va a cerrar en cualquier caso, " +
      "y conviene no volver a abrirla hasta revisar el problema: al iniciar " +
      "intentaría la misma actualización sobre los mismos datos.",
    buttons: ["Restaurar la copia previa", "Cerrar sin tocar nada"],
    defaultId: 0,
    cancelId: 1,
  });

  if (response !== 0) return;

  try {
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
    const { brokenCopyPath } = restoreSnapshot(snapshotPath, getDBPath());
    logInfo("db:migrate:restore", "Base restaurada desde la copia previa", {
      snapshotPath,
      brokenCopyPath,
    });
    dialog.showMessageBoxSync({
      type: "info",
      title: "Datos restaurados",
      message: "Se restauró la copia previa a la actualización.",
      detail: brokenCopyPath
        ? `La base dañada quedó guardada en:\n${brokenCopyPath}`
        : undefined,
    });
  } catch (error) {
    logError("db:migrate:restore", error, { snapshotPath });
    dialog.showErrorBox(
      "No se pudo restaurar",
      `La copia previa sigue disponible en:\n${snapshotPath}\n\n` +
        `${error instanceof Error ? error.message : String(error)}`
    );
  }
};

export const initializeDB = async () => {
  try {
    logInfo("db:init", "Inicializando base de datos");
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      await runPendingMigrations();
      logInfo("db:init", "Base de datos inicializada correctamente", {
        dbPath: getDBPath(),
      });
    }
    return AppDataSource;
  } catch (error) {
    logError("db:init", error, { dbPath: getDBPath() });
    // `runPendingMigrations` ya mostró su propio cuadro (con la ruta de la copia
    // previa y la opción de restaurar): encimarle el genérico sólo confunde.
    if (error instanceof ReportedStartupError) throw error;
    const { dialog } = await import("electron");
    dialog.showErrorBox(
      "Error de Base de Datos",
      `
            No se pudo inicializar la base de datos.\n\n
            Ruta: ${getDBPath()}\n\n
            Error: ${error instanceof Error ? error.message : String(error)}
            `
    );
    throw error;
  }
};

export const getRepositories = () => {
  return {
    clientRepository: AppDataSource.getRepository(Client),
    carRepository: AppDataSource.getRepository(Car),
    jobRepository: AppDataSource.getRepository(Job),
    documentRepository: AppDataSource.getRepository(Document),
    serviceReminderRepository: AppDataSource.getRepository(ServiceReminder),
    appSettingRepository: AppDataSource.getRepository(AppSetting),
  };
};
