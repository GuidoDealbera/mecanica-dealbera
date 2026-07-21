import { dialog, shell, app } from "electron";
import { handleIpc } from "../../ipc";
import fs from "node:fs";
import path from "node:path";
import { logError, logInfo } from "../../logger";
import { AppDataSource, getDBPath, getRepositories } from "../dataSource";
import { invalidateDashboardStatsCache } from "../dashboardCache";

function getBackupDir(): string {
  return path.join(app.getPath("documents"), "backups");
}

function toCsv<T extends object>(
  headers: Partial<Record<keyof T, string>>,
  rows: T[],
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
      .join(";"),
  );
  return BOM + [headerRow, ...dataRows].join("\n");
}

handleIpc("data:export-csv", async () => {
  const { carRepository } = getRepositories();
  const cars = await carRepository.find({ relations: ["owner", "jobs"] });

  type CarRow = {
    patente: string; marca: string; modelo: string; anio: string;
    kilometraje: string; titular: string; telefono: string;
    direccion: string; localidad: string; email: string;
    trabajos: string; ultimoService: string;
  };

  const rows: CarRow[] = cars.map((car) => {
    const jobCount = Array.isArray(car.jobs) ? car.jobs.length : 0;
    const lastJob = Array.isArray(car.jobs) && car.jobs.length > 0
      ? car.jobs.reduce((a, b) =>
          new Date((b.updatedAt ?? b.createdAt) as Date) > new Date((a.updatedAt ?? a.createdAt) as Date) ? b : a,
        )
      : null;
    const lastDate = lastJob
      ? new Date((lastJob.updatedAt ?? lastJob.createdAt) as Date).toLocaleDateString("es-AR")
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
      patente: "Patente", marca: "Marca", modelo: "Modelo", anio: "Año",
      kilometraje: "Kilometraje", titular: "Titular", telefono: "Teléfono",
      direccion: "Dirección", localidad: "Localidad", email: "Email",
      trabajos: "Trabajos", ultimoService: "Último service",
    },
    rows,
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

  return { status: "success", message: `${cars.length} vehículos exportados correctamente` };
});

handleIpc("backup:open-folder", () => {
  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  shell.openPath(backupDir);
  return { status: "success", message: "Carpeta de backups abierta" };
});

handleIpc("backup:list", () => {
  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir))
    return { status: "success", message: "Sin backups", result: [] };
  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith("taller_") && f.endsWith(".db"))
    .sort()
    .reverse();
  return { status: "success", message: "Backups listados", result: files };
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

  fs.copyFileSync(sourcePath, filePath);
  shell.showItemInFolder(filePath);

  return { status: "success", message: "Base de datos exportada correctamente" };
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

  const sourcePath = result.filePaths[0];
  const destPath = getDBPath();
  let preImportBackupPath: string | null = null;

  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }

    if (fs.existsSync(destPath)) {
      preImportBackupPath = destPath.replace(".db", `_pre_import_${Date.now()}.db`);
      fs.copyFileSync(destPath, preImportBackupPath);
    }

    fs.copyFileSync(sourcePath, destPath);
    await AppDataSource.initialize();
    invalidateDashboardStatsCache();

    return {
      status: "success",
      message: "Base de datos importada. Los datos se actualizarán.",
    };
  } catch (error) {
    logError("backup:import", error);

    if (!AppDataSource.isInitialized) {
      if (preImportBackupPath && fs.existsSync(preImportBackupPath)) {
        try {
          fs.copyFileSync(preImportBackupPath, destPath);
          logInfo("backup:import", "DB restaurada desde backup previo al import");
        } catch (restoreError) {
          logError("backup:import:restore", restoreError);
        }
      }
      try {
        await AppDataSource.initialize();
      } catch (initError) {
        logError("backup:import:reinit", initError);
      }
    }

    return {
      status: "failed",
      message: `Error al importar: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
});