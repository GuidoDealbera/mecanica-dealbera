import { dialog, shell } from "electron";
import { handleIpc } from "../../ipc";
import fs from "node:fs";
import { logError, logInfo } from "../../logger";
import {
  AppDataSource,
  applyPendingMigrations,
  getBackupDir,
  getDBPath,
  getRepositories,
} from "../dataSource";
import { invalidateDashboardStatsCache } from "../dashboardCache";
import { listBackups } from "../backups";
import { checkDatabaseHealth } from "../migrationSafety";
import type { APIResponse, BackupEntry } from "../../../src/Types/apiTypes";

function toCsv<T extends object>(
  headers: Partial<Record<keyof T, string>>,
  rows: T[]
): string {
  const BOM = "﻿";
  const keys = Object.keys(headers) as (keyof T)[];
  const headerRow = keys.map((k) => headers[k]).join(";");
  const dataRows = rows.map((row) =>
    keys
      .map((k) => {
        const v = row[k];
        const str = v == null ? "" : String(v);
        return str.includes(";") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      })
      .join(";")
  );
  return BOM + [headerRow, ...dataRows].join("\n");
}

handleIpc("data:export-csv", async () => {
  const { carRepository } = getRepositories();
  const cars = await carRepository.find({
    relations: { owner: true, jobs: true },
  });

  type CarRow = {
    patente: string;
    marca: string;
    modelo: string;
    anio: string;
    kilometraje: string;
    titular: string;
    telefono: string;
    direccion: string;
    localidad: string;
    email: string;
    trabajos: string;
    ultimoService: string;
  };

  const rows: CarRow[] = cars.map((car) => {
    const jobCount = Array.isArray(car.jobs) ? car.jobs.length : 0;
    const lastJob =
      Array.isArray(car.jobs) && car.jobs.length > 0
        ? car.jobs.reduce((a, b) =>
            new Date((b.updatedAt ?? b.createdAt) as Date) >
            new Date((a.updatedAt ?? a.createdAt) as Date)
              ? b
              : a
          )
        : null;
    const lastDate = lastJob
      ? new Date(
          (lastJob.updatedAt ?? lastJob.createdAt) as Date
        ).toLocaleDateString("es-AR")
      : "---";

    return {
      patente: car.licensePlate,
      marca: car.brand,
      modelo: car.model,
      anio: String(car.year),
      kilometraje: String(car.kilometers),
      titular: car.owner?.fullname ?? "---",
      telefono: car.owner?.phone ?? "---",
      direccion: car.owner?.address ?? "---",
      localidad: car.owner?.city ?? "---",
      email: car.owner?.email ?? "---",
      trabajos: String(jobCount),
      ultimoService: lastDate,
    };
  });

  const csv = toCsv<CarRow>(
    {
      patente: "Patente",
      marca: "Marca",
      modelo: "Modelo",
      anio: "Año",
      kilometraje: "Kilometraje",
      titular: "Titular",
      telefono: "Teléfono",
      direccion: "Dirección",
      localidad: "Localidad",
      email: "Email",
      trabajos: "Trabajos",
      ultimoService: "Último service",
    },
    rows
  );

  const today = new Date().toISOString().slice(0, 10);
  const { filePath } = await dialog.showSaveDialog({
    title: "Exportar vehículos a CSV",
    defaultPath: `vehiculos_${today}.csv`,
    filters: [{ name: "Archivo CSV", extensions: ["csv"] }],
  });

  if (!filePath) return { status: "cancelled", message: "Operación cancelada" };

  fs.writeFileSync(filePath, csv, "utf8");
  shell.showItemInFolder(filePath);

  return {
    status: "success",
    message: `${cars.length} vehículos exportados correctamente`,
  };
});

handleIpc("backup:open-folder", () => {
  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  shell.openPath(backupDir);
  return { status: "success", message: "Carpeta de backups abierta" };
});

// Los respaldos se listan con fecha y tamaño, no sólo el nombre: es lo que
// necesita la pantalla para que el usuario elija cuál restaurar sin tener que
// interpretar un nombre de archivo.
handleIpc("backup:list", (): APIResponse<BackupEntry[]> => {
  const result = listBackups(getBackupDir()).map((backup) => ({
    name: backup.name,
    date: backup.date.toISOString(),
    sizeKb: Math.max(1, Math.round(fs.statSync(backup.path).size / 1024)),
  }));
  return { status: "success", message: "Backups listados", result };
});

/**
 * Reemplaza la base en uso por el archivo indicado.
 *
 * Lo comparten la importación (archivo elegido por el usuario) y la
 * restauración (respaldo automático). Antes de tocar nada guarda la base actual
 * al lado, con sufijo `_pre_import_<marca>`: si el archivo nuevo resulta
 * ilegible, se vuelve solo.
 *
 * **El archivo entrante se migra igual que en el arranque.** Sin eso, restaurar
 * un respaldo viejo dejaba la aplicación andando contra un esquema anterior
 * —sin `service_reminder`, sin `document`, con `job.serviceType`— y cada
 * pantalla que tocara esas columnas reventaba. `integrity_check` no lo detecta,
 * y no es su culpa: mira la estructura del archivo, no si el esquema es el que
 * la aplicación espera. Una base vieja está perfectamente sana.
 *
 * No hace falta una copia previa a esa migración: la red es la base que se
 * acaba de apartar, y el archivo de origen sigue donde estaba.
 */
const replaceDatabaseWith = async (sourcePath: string, scope: string) => {
  const destPath = getDBPath();
  let previousPath: string | null = null;

  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }

    if (fs.existsSync(destPath)) {
      previousPath = destPath.replace(".db", `_pre_import_${Date.now()}.db`);
      fs.copyFileSync(destPath, previousPath);
    }

    fs.copyFileSync(sourcePath, destPath);
    await AppDataSource.initialize();

    // Un archivo que no supera la verificación no sirve como base: se vuelve a
    // la anterior en vez de dejar al taller trabajando sobre algo dañado.
    const health = await checkDatabaseHealth(AppDataSource);
    if (!health.ok) {
      throw new Error(
        `El archivo no superó la verificación de integridad: ${health.problems
          .slice(0, 3)
          .join(" | ")}`
      );
    }

    // Un respaldo puede ser de una versión anterior. Si falla, el `catch` de
    // abajo vuelve a la base que se apartó recién.
    const migradas = await applyPendingMigrations();

    invalidateDashboardStatsCache();
    logInfo(scope, "Base de datos reemplazada", {
      sourcePath,
      previousPath,
      migraciones: migradas,
    });

    return {
      status: "success",
      message:
        migradas > 0
          ? `Base de datos restaurada y actualizada (${migradas} ${
              migradas === 1 ? "cambio aplicado" : "cambios aplicados"
            }). Los datos se actualizarán.`
          : "Base de datos restaurada. Los datos se actualizarán.",
    };
  } catch (error) {
    logError(scope, error, { sourcePath });

    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy().catch(() => {});
    }
    if (previousPath && fs.existsSync(previousPath)) {
      try {
        fs.copyFileSync(previousPath, destPath);
        logInfo(scope, "Base restaurada desde la copia previa al reemplazo");
      } catch (restoreError) {
        logError(`${scope}:restore`, restoreError);
      }
    }
    try {
      await AppDataSource.initialize();
    } catch (initError) {
      logError(`${scope}:reinit`, initError);
    }

    return {
      status: "failed",
      message: `No se pudo restaurar: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
};

// Restaura uno de los respaldos automáticos, elegido desde la pantalla. Recibe
// sólo el **nombre** y lo resuelve contra la carpeta de respaldos: si aceptara
// una ruta, el renderer podría pedir que se copie cualquier archivo del disco
// encima de la base.
handleIpc("backup:restore", async (_event, name: string) => {
  const backup = listBackups(getBackupDir()).find((b) => b.name === name);
  if (!backup) {
    return { status: "failed", message: "No se encontró ese respaldo" };
  }
  return await replaceDatabaseWith(backup.path, "backup:restore");
});

handleIpc("backup:export", async () => {
  const sourcePath = getDBPath();

  if (!fs.existsSync(sourcePath)) {
    return { status: "failed", message: "No se encontró la base de datos" };
  }

  const today = new Date().toISOString().slice(0, 10);
  const { filePath } = await dialog.showSaveDialog({
    title: "Exportar base de datos",
    defaultPath: `taller_backup_${today}.db`,
    filters: [{ name: "Base de Datos SQLite", extensions: ["db"] }],
  });

  if (!filePath) return { status: "cancelled", message: "Operación cancelada" };

  // `VACUUM INTO` y no `copyFileSync`: copiar el archivo a secas puede
  // capturarlo a mitad de una escritura. Esta es la copia que el usuario se
  // lleva en un pendrive pensando que tiene sus datos a salvo, así que tiene que
  // ser consistente sí o sí. `VACUUM INTO` falla si el destino ya existe, y el
  // diálogo de guardado ya confirmó el reemplazo.
  try {
    fs.rmSync(filePath, { force: true });
    await AppDataSource.query("VACUUM INTO ?", [filePath]);
  } catch (error) {
    logError("backup:export", error, { filePath });
    return {
      status: "failed",
      message: `No se pudo exportar la base de datos: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  shell.showItemInFolder(filePath);

  return {
    status: "success",
    message: "Base de datos exportada correctamente",
  };
});

handleIpc("backup:import", async () => {
  const confirm = await dialog.showMessageBox({
    type: "warning",
    title: "Importar base de datos",
    message: "¿Estás seguro?",
    detail:
      "Esta acción reemplazará todos los datos actuales con los del archivo seleccionado. Se generará un respaldo automático antes de continuar.",
    buttons: ["Cancelar", "Continuar"],
    defaultId: 0,
    cancelId: 0,
  });

  if (confirm.response === 0) {
    return { status: "cancelled", message: "Operación cancelada" };
  }

  const result = await dialog.showOpenDialog({
    title: "Seleccionar base de datos a importar",
    filters: [{ name: "Base de Datos SQLite", extensions: ["db"] }],
    properties: ["openFile"],
  });

  if (result.canceled || !result.filePaths[0]) {
    return { status: "cancelled", message: "Operación cancelada" };
  }

  return await replaceDatabaseWith(result.filePaths[0], "backup:import");
});
