import "reflect-metadata";
import "./DataBase/Endpoints/car.endpoints";
import "./DataBase/Endpoints/client.endpoints";
import "./DataBase/Endpoints/dashboard.endpoints";
import "./DataBase/Endpoints/backup.endpoints";
import { app, BrowserWindow, dialog, Notification, ipcMain, shell } from "electron";
import { autoUpdater } from "electron-updater";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import log from "electron-log/main";
import { logError, logInfo } from "./logger";
import { handleIpc } from "./ipc";
import { getRepositories, initializeDB } from "./DataBase/dataSource";

log.initialize();
log.transports.file.level = "info";
log.transports.console.level = "debug";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

function getBackupDir(): string {
  return path.join(app.getPath("documents"), "backups");
}

function performAutoBackup(): void {
  const dbPath = path.join(app.getPath("documents"), "taller.db");
  if (!fs.existsSync(dbPath)) return;

  const today = new Date().toISOString().slice(0, 10);
  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const backupPath = path.join(backupDir, `taller_${today}.db`);
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(dbPath, backupPath);
  }

  const backups = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith("taller_") && f.endsWith(".db"))
    .sort();
  if (backups.length > 7) {
    backups
      .slice(0, backups.length - 7)
      .forEach((f) => fs.unlinkSync(path.join(backupDir, f)));
  }
}

process.on("uncaughtException", (error) => {
  logError("uncaught-exception", error);
  dialog.showErrorBox(
    "Error Inesperado",
    `Ocurrió un error inesperado:\n\n${error.message}`,
  );
});

let win: BrowserWindow | null;
let splash: BrowserWindow | null;

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

function setupAutoUpdater() {
  if (process.env.NODE_ENV === "development") return;

  autoUpdater.autoDownload = false;

  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    win?.webContents.send("update-available", {
      version: info.version,
      notes: info.releaseNotes,
    });
  });

  autoUpdater.on("update-not-available", () => {
    win?.webContents.send("update-not-available")
  });

  autoUpdater.on("download-progress", (progress) => {
    win?.webContents.send("update-progress", {
      percent: Math.round(progress.percent || 0),
      bytesPerSecond: progress.bytesPerSecond
    })
  })

  autoUpdater.on("update-downloaded", () => {
    win?.webContents.send("update-downloaded")
  })

  autoUpdater.on("error", (error) => {
    win?.webContents.send("update-error", {
      error: error.message
    })
  })

  autoUpdater.checkForUpdates().catch(err => logError("auto-updater:check", err))

  setInterval(() => {
    autoUpdater.checkForUpdates().catch(err => logError("auto-updater:check-interval", err))
  }, UPDATE_CHECK_INTERVAL_MS)
}

async function createWindow() {
  splash = new BrowserWindow({
    width: 600,
    height: 600,
    frame: false,
    show: true,
    alwaysOnTop: true,
  });

  const splashPath = VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT, "electron", "splash.html")
    : path.join(process.resourcesPath, "splash.html");

  splash.loadFile(path.join(splashPath));

  if (process.env.NODE_ENV !== "development") {
    try {
      performAutoBackup();
      logInfo("backup:auto", "Auto-backup completado");
    } catch (err) {
      logError("backup:auto", err);
    }
  }

  await initializeDB();

  // Notificación de alertas de service al iniciar (solo en producción)
  if (process.env.NODE_ENV !== "development") {
    try {
      const { carRepository } = getRepositories();
      const cars = await carRepository.find();
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const alertCount = cars.filter((car) => {
        if (!Array.isArray(car.jobs) || car.jobs.length === 0) {
          return new Date(car.createdAt) < threeMonthsAgo;
        }
        const lastDate = car.jobs.reduce((latest, job) => {
          const d = new Date((job.updatedAt || job.createdAt) as Date);
          return d > latest ? d : latest;
        }, new Date(0));
        return lastDate < sixMonthsAgo;
      }).length;

      if (alertCount > 0 && Notification.isSupported()) {
        new Notification({
          title: "Mecánica Dealbera — Recordatorios",
          body: `${alertCount} vehículo${alertCount > 1 ? "s" : ""} sin service en los últimos 6 meses`,
          urgency: "normal",
        }).show();
      }
    } catch (err) {
      logError("service-alerts:check", err);
    }
  }

  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "logo-grande.png"),
    title: "Mecánica Dealbera",
    minWidth: 600,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.setMenuBarVisibility(false);
  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }

  win.once("ready-to-show", () => {
    splash?.close();
    splash = null;
    win?.show();
    win?.maximize();
  });
}

app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

handleIpc("app:open-logs-folder", () => {
  const logPath = log.transports.file.getFile().path;
  shell.showItemInFolder(logPath);
});

ipcMain.on("start-update-download", () => {
  autoUpdater.downloadUpdate()
})

ipcMain.on("install-update", () => {
  autoUpdater.quitAndInstall()
})

handleIpc("check-for-updates", async () => {
  if(process.env.NODE_ENV === 'development'){
    win?.webContents.send("update-not-available")
    return
  }

  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    win?.webContents.send("update-error", {message: msg})
  }
})

app.whenReady().then(async () => {
  logInfo("app:start", "App iniciando", { version: app.getVersion() });
  await createWindow();
  setupAutoUpdater();
});
