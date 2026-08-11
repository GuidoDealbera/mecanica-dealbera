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
import { logError, logInfo, logWarn } from "./logger";
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

let win: BrowserWindow | null;
let splash: BrowserWindow | null;

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** Tiempo máximo que se deja el splash esperando a que la ventana esté lista. */
const SPLASH_TIMEOUT_MS = 20_000;

/** Cierra el splash. Es idempotente: se puede llamar desde varios caminos. */
function closeSplash(): void {
  if (splash && !splash.isDestroyed()) splash.close();
  splash = null;
}

/** Evita que dos errores encadenados disparen dos cierres (y dos cuadros). */
let isShuttingDown = false;

/**
 * Cierra la aplicación de forma controlada ante un error del que no puede
 * recuperarse.
 *
 * Antes `uncaughtException` sólo mostraba un cuadro de error y la ejecución
 * **seguía**, con la app en un estado indefinido: es el peor escenario posible
 * para algo que escribe en una base de datos. Acá se registra el error, se cierra
 * el splash (si quedó abierto) y se sale con código 1.
 *
 * @param showDialog `false` cuando quien llama ya avisó al usuario (por ejemplo
 * `initializeDB`, que muestra su propio cuadro con la ruta de la base).
 */
function fatalError(
  scope: string,
  error: unknown,
  { showDialog = true }: { showDialog?: boolean } = {}
): void {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logError(scope, error);
  closeSplash();

  if (showDialog) {
    const detail = error instanceof Error ? error.message : String(error);
    dialog.showErrorBox(
      "Error inesperado",
      `La aplicación se va a cerrar porque ocurrió un error del que no puede recuperarse.\n\n` +
        `${detail}\n\n` +
        `El detalle quedó registrado en los logs.`
    );
  }

  // `app.exit` en vez de `app.quit`: no depende de que los handlers de cierre
  // corran bien, que es justo lo que no se puede dar por sentado acá.
  app.exit(1);
}

process.on("uncaughtException", (error) => {
  fatalError("uncaught-exception", error);
});

// Una promesa rechazada sin atender no deja ningún rastro por sí sola: se
// registra para poder diagnosticarla. A diferencia de `uncaughtException`, no
// cierra la app: casi siempre es una operación puntual que falló y el resto
// sigue sirviendo.
process.on("unhandledRejection", (reason) => {
  logError("unhandled-rejection", reason);
});

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

/**
 * Muestra la pantalla de carga. Es puramente cosmética, así que un fallo acá
 * (por ejemplo que `splash.html` no esté empaquetado) se registra y se sigue: no
 * puede impedir que la aplicación arranque.
 */
function showSplash(): void {
  const splashPath = VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT, "electron", "splash.html")
    : path.join(process.resourcesPath, "splash.html");

  try {
    splash = new BrowserWindow({
      width: 600,
      height: 600,
      frame: false,
      show: true,
      alwaysOnTop: true,
      // Sin esto la ventana se pinta blanca hasta que el HTML carga, y se veía un
      // fogonazo blanco antes de la pantalla de carga (que es oscura).
      backgroundColor: "#000000",
    });
    splash.loadFile(splashPath).catch((error) => {
      logWarn("app:splash", "No se pudo cargar la pantalla de carga", {
        splashPath,
        error: String(error),
      });
      closeSplash();
    });
  } catch (error) {
    logWarn("app:splash", "No se pudo crear la pantalla de carga", {
      error: String(error),
    });
    splash = null;
  }
}

async function createWindow() {
  showSplash();

  try {
    if (process.env.NODE_ENV !== "development") {
      try {
        performAutoBackup();
        logInfo("backup:auto", "Auto-backup completado");
      } catch (err) {
        // El respaldo es best-effort: si falla no impide usar la aplicación.
        logError("backup:auto", err);
      }
    }

    await initializeDB();
  } catch (error) {
    // Sin base de datos la aplicación no sirve para nada, y antes este camino
    // dejaba el splash abierto para siempre y ninguna ventana: `initializeDB`
    // muestra su propio cuadro de error (con la ruta de la base) y re-lanza, así
    // que acá sólo se registra y se cierra.
    fatalError("app:start", error, { showDialog: false });
    return;
  }

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

  // Red de seguridad: si la ventana nunca llega a `ready-to-show`, el splash
  // quedaría arriba de todo, sin bordes y sin forma de cerrarlo. Pasado el plazo
  // se cierra igual y se muestra la ventana, aunque esté a medio cargar: es
  // preferible a una pantalla de carga eterna.
  const splashTimeout = setTimeout(() => {
    if (!splash) return;
    logWarn(
      "app:splash",
      "La ventana no estuvo lista en el tiempo esperado; se cierra la pantalla de carga",
      { timeoutMs: SPLASH_TIMEOUT_MS }
    );
    closeSplash();
    win?.show();
  }, SPLASH_TIMEOUT_MS);

  win.once("ready-to-show", () => {
    clearTimeout(splashTimeout);
    closeSplash();
    win?.show();
    win?.maximize();
  });

  // Si la carga del renderer falla no hay `ready-to-show`, así que hay que
  // atender este evento o la app queda colgada en la pantalla de carga.
  win.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      // ERR_ABORTED (-3) lo emite una navegación cancelada: pasa de forma normal
      // con el recargado en caliente del servidor de desarrollo.
      if (errorCode === -3) return;

      clearTimeout(splashTimeout);
      closeSplash();
      logError(
        "app:window-load",
        new Error(`${errorDescription} (${errorCode})`),
        { url: validatedURL }
      );

      if (VITE_DEV_SERVER_URL) {
        // En desarrollo se muestra la ventana: Vite reintenta la carga solo
        // cuando el servidor vuelve.
        win?.show();
        return;
      }
      fatalError(
        "app:window-load",
        new Error(
          `No se pudo cargar la interfaz de la aplicación: ${errorDescription}`
        )
      );
    }
  );

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
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
  try {
    await createWindow();
    setupAutoUpdater();
  } catch (error) {
    // `createWindow` ya atiende sus propios fallos; esto cubre lo que se le
    // escape, para que un arranque fallido no quede como promesa rechazada.
    fatalError("app:start", error);
  }
});
