import { ipcMain, dialog, shell } from "electron";
import fs from "node:fs";
import { AppDataSource, getDBPath } from "../dataSource";

ipcMain.handle("backup:export", async () => {
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

ipcMain.handle("backup:import", async () => {
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

  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }

    // Backup automático antes de importar
    if (fs.existsSync(destPath)) {
      const backupPath = destPath.replace(
        ".db",
        `_pre_import_${Date.now()}.db`
      );
      fs.copyFileSync(destPath, backupPath);
    }

    fs.copyFileSync(sourcePath, destPath);
    await AppDataSource.initialize();

    return {
      status: "success",
      message: "Base de datos importada. Los datos se actualizarán.",
    };
  } catch (error) {
    if (!AppDataSource.isInitialized) {
      try {
        await AppDataSource.initialize();
      } catch { /* ignore */ }
    }
    return {
      status: "failed",
      message: `Error al importar: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
});