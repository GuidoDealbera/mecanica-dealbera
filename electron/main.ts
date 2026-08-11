import "reflect-metadata";
import "./DataBase/Endpoints/car.crud.endpoints";
import "./DataBase/Endpoints/car.jobs.endpoints";
import "./DataBase/Endpoints/car.search.endpoints";
import "./DataBase/Endpoints/client.endpoints";
import "./DataBase/Endpoints/dashboard.endpoints";
import "./DataBase/Endpoints/document.endpoints";
import "./DataBase/Endpoints/service.endpoints";
import "./DataBase/Endpoints/backup.endpoints";
import {
  app,
  BrowserWindow,
  dialog,
  Notification,
  ipcMain,
  shell,
} from "electron";
import { autoUpdater } from "electron-updater";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import log from "electron-log/main";
import { logError, logInfo } from "./logger";
import { handleIpc } from "./ipc";
import { AppDataSource, initializeDB } from "./DataBase/dataSource";
import { countDueReminders } from "./DataBase/serviceReminders.service";

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
    `Ocurrió un error inesperado:\n\n${error.message}`
  );
});

let win: BrowserWindow | null;
let splash: BrowserWindow | null;

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

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
    win?.webContents.send("update-not-available");
  });

  autoUpdater.on("download-progress", (progress) => {
    win?.webContents.send("update-progress", {
      percent: Math.round(progress.percent || 0),
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on("update-downloaded", () => {
    win?.webContents.send("update-downloaded");
  });

  // Único punto por el que se reportan los errores de actualización al
  // renderer. La clave es `message` porque es lo que declara el contrato
  // (`UpdateError` en `global.d.ts`) y lo que lee el Header: con `error` la
  // interfaz recibía `undefined` y no podía mostrar el motivo. Además se loguea,
  // que antes no pasaba: un fallo de actualización no dejaba ningún rastro.
  autoUpdater.on("error", (error) => {
    logError("auto-updater", error, { version: app.getVersion() });
    win?.webContents.send("update-error", {
      message:
        error instanceof Error && error.message
          ? error.message
          : "No se pudo completar la actualización",
    });
  });

  autoUpdater
    .checkForUpdates()
    .catch((err) => logError("auto-updater:check", err));

  setInterval(() => {
    autoUpdater
      .checkForUpdates()
      .catch((err) => logError("auto-updater:check-interval", err));
  }, UPDATE_CHECK_INTERVAL_MS);
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

  // Notificación de recordatorios de service al iniciar (solo en producción).
  // El conteo sale de `countDueReminders`, la misma función que alimenta el
  // badge y la bandeja: antes la regla estaba reimplementada acá y podía
  // divergir de la del listado.
  if (process.env.NODE_ENV !== "development") {
    try {
      const dueCount = await countDueReminders(AppDataSource.manager);
      if (dueCount > 0 && Notification.isSupported()) {
        new Notification({
          title: "Mecánica Dealbera — Recordatorios",
          body: `${dueCount} ${dueCount > 1 ? "vehículos requieren" : "vehículo requiere"} service`,
          urgency: "normal",
        }).show();
      }
    } catch (err) {
      logError("service-reminders:check", err);
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

// Abre una URL en el navegador/app externa por defecto (ej. el link wa.me de
// WhatsApp). Se restringe a https para no abrir esquemas arbitrarios.
handleIpc("app:open-external", async (_event, url: string) => {
  if (typeof url !== "string" || !url.startsWith("https://")) {
    logError("app:open-external", new Error(`URL no permitida: ${url}`));
    return;
  }
  await shell.openExternal(url);
});

ipcMain.on("start-update-download", () => {
  // `downloadUpdate()` también emite `error` y rechaza: el rechazo se atiende
  // para no dejar una promesa colgada en el proceso principal.
  autoUpdater.downloadUpdate().catch(() => {
    /* ya reportado por el listener de `error` */
  });
});

ipcMain.on("install-update", () => {
  autoUpdater.quitAndInstall();
});

handleIpc("check-for-updates", async () => {
  if (process.env.NODE_ENV === "development") {
    win?.webContents.send("update-not-available");
    return;
  }

  // `checkForUpdates()` ante un fallo emite el evento `error` **y** rechaza la
  // promesa. El evento ya avisa al renderer (y loguea), así que acá sólo se
  // absorbe el rechazo: si se propagara, el `await` del renderer quedaría como
  // promesa rechazada sin atender, y si se reenviara el mensaje el usuario
  // vería dos avisos del mismo error.
  try {
    await autoUpdater.checkForUpdates();
  } catch {
    /* ya reportado por el listener de `error` */
  }
});

app.whenReady().then(async () => {
  logInfo("app:start", "App iniciando", { version: app.getVersion() });
  await createWindow();
  setupAutoUpdater();
});
