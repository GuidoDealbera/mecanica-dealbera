import { ipcRenderer, contextBridge } from "electron";
import { CreateCarDto, UpdateJobDto } from "./DataBase/Types/car.dto";
import { CreateClientDto, UpdateClientDto } from "./DataBase/Types/client.dto";
import {
  CarQueryParams,
  ClientQueryParams,
  CreateCarJob,
  DocumentQueryParams,
  IssueDocumentBody,
  ReminderQueryParams,
  SaveReminderBody,
  ServiceSettings,
  UpdateCarBody,
} from "../src/Types/apiTypes";
import { UpdateInfo, UpdateProgress } from "../global";

/**
 * Todo lo que el renderer puede pedirle al proceso principal está acá abajo,
 * canal por canal y con tipos.
 *
 * Antes convivía con un `ipcRenderer` genérico —`invoke`, `send`, `on` sobre
 * **cualquier** canal— que dejaba sin efecto este trabajo: con él a mano,
 * `window.ipcRenderer.invoke("car:delete", ...)` funcionaba igual. Venía de la
 * plantilla de electron-vite y no lo usaba nadie salvo tres renglones de
 * ejemplo que hacían un `console.log` de la fecha. La superficie estaba abierta
 * para sostener código muerto.
 */
contextBridge.exposeInMainWorld("api", {
  cars: {
    create: (car: CreateCarDto) => ipcRenderer.invoke("car:create", car),
    getAll: async (params: CarQueryParams) =>
      await ipcRenderer.invoke("car:get-all", params),
    getActiveJobsCount: async () =>
      await ipcRenderer.invoke("car:active-jobs-count"),
    getByLicense: async (licence: string) =>
      await ipcRenderer.invoke("car:get-by-license", licence),
    update: async (id: string, cambios: UpdateCarBody) =>
      await ipcRenderer.invoke("car:update", id, cambios),
    delete: async (licence: string) =>
      await ipcRenderer.invoke("car:delete", licence),
    addJob: async (licence: string, job: CreateCarJob) =>
      await ipcRenderer.invoke("car:add-job", licence, job),
    updateJob: async (
      licence: string,
      jobId: string,
      updateJobDto: UpdateJobDto
    ) =>
      await ipcRenderer.invoke("car:update-job", licence, jobId, updateJobDto),
    reassignOwner: async (
      licensePlate: string,
      payload:
        | { mode: "existing"; existingOwnerId: string }
        | {
            mode: "new";
            newOwner: CreateClientDto;
          }
    ) => await ipcRenderer.invoke("car:reassign-owner", licensePlate, payload),
  },
  clients: {
    create: async (dto: CreateClientDto) =>
      await ipcRenderer.invoke("client:create", dto),
    getAll: async (params: ClientQueryParams) =>
      await ipcRenderer.invoke("client:get-all", params),
    getById: async (id: string) =>
      await ipcRenderer.invoke("client:find-by-id", id),
    getCities: async () => await ipcRenderer.invoke("client:cities"),
    search: async (query: string) =>
      await ipcRenderer.invoke("client:search", query),
    update: async (dto: UpdateClientDto) =>
      await ipcRenderer.invoke("client:update", dto),
    toggleActive: async (id: string) =>
      await ipcRenderer.invoke("client:toggle-active", id),
    delete: async (id: string) => await ipcRenderer.invoke("client:delete", id),
  },
  dashboard: {
    getStats: async () => await ipcRenderer.invoke("dashboard:get-stats"),
  },
  service: {
    list: async (params: ReminderQueryParams) =>
      await ipcRenderer.invoke("service:list", params),
    countDue: async () => await ipcRenderer.invoke("service:count-due"),
    byCar: async (licensePlate: string) =>
      await ipcRenderer.invoke("service:by-car", licensePlate),
    snooze: async (id: string, days: number) =>
      await ipcRenderer.invoke("service:snooze", id, days),
    markContacted: async (id: string) =>
      await ipcRenderer.invoke("service:mark-contacted", id),
    complete: async (id: string) =>
      await ipcRenderer.invoke("service:complete", id),
    dismiss: async (id: string) =>
      await ipcRenderer.invoke("service:dismiss", id),
    reactivate: async (id: string) =>
      await ipcRenderer.invoke("service:reactivate", id),
    save: async (body: SaveReminderBody) =>
      await ipcRenderer.invoke("service:save", body),
    getSettings: async () => await ipcRenderer.invoke("service:settings-get"),
    setSettings: async (settings: Partial<ServiceSettings>) =>
      await ipcRenderer.invoke("service:settings-set", settings),
  },
  documents: {
    issue: async (body: IssueDocumentBody) =>
      await ipcRenderer.invoke("document:issue", body),
    discard: async (id: string) =>
      await ipcRenderer.invoke("document:discard", id),
    list: async (filters?: DocumentQueryParams) =>
      await ipcRenderer.invoke("document:list", filters),
    /** Un documento con la copia de lo que se imprimió, para reimprimirlo. */
    get: async (id: string) => await ipcRenderer.invoke("document:get", id),
    /** Revisa que la numeración no tenga huecos. */
    checkSequence: async () =>
      await ipcRenderer.invoke("document:check-sequence"),
    /** Pregunta dónde guardar el PDF ya dibujado y lo escribe. */
    savePdf: async (payload: { defaultName: string; bytes: Uint8Array }) =>
      await ipcRenderer.invoke("document:save-pdf", payload),
  },
  /**
   * Aviso de "los datos cambiaron", que emite el proceso principal cada vez que
   * una mutación invalida la caché del dashboard. Devuelve la función para
   * desuscribirse: sin eso, cada montaje del componente dejaba un listener
   * colgado (y en desarrollo StrictMode monta dos veces).
   */
  onDataChanged: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("data-changed", handler);
    return () => {
      ipcRenderer.removeListener("data-changed", handler);
    };
  },
  backup: {
    export: async () => await ipcRenderer.invoke("backup:export"),
    import: async () => await ipcRenderer.invoke("backup:import"),
    exportCsv: async () => await ipcRenderer.invoke("data:export-csv"),
    openFolder: async () => await ipcRenderer.invoke("backup:open-folder"),
    list: async () => await ipcRenderer.invoke("backup:list"),
    restore: async (name: string) =>
      await ipcRenderer.invoke("backup:restore", name),
  },
  global: {
    search: async (query: string) =>
      await ipcRenderer.invoke("global:search", query),
    openLogsFolder: async () =>
      await ipcRenderer.invoke("app:open-logs-folder"),
    openExternal: async (url: string) =>
      await ipcRenderer.invoke("app:open-external", url),
    /**
     * Avisa si hay cambios sin guardar en pantalla. El guard de navegación de
     * React Router sólo cubre moverse **dentro** de la aplicación; cerrar la
     * ventana se llevaba el formulario sin decir una palabra, y eso lo tiene
     * que atajar el proceso principal, que es el dueño de la ventana.
     */
    setUnsavedChanges: (dirty: boolean) =>
      ipcRenderer.send("app:unsaved-changes", dirty),
    /**
     * Manda al archivo de log un error de la interfaz. Sin esto no llegaba
     * ninguno: `console.error` del renderer va a las herramientas de
     * desarrollo, no al archivo que el usuario puede mandar.
     */
    logError: (payload: {
      scope: string;
      name?: string;
      message: string;
      stack?: string;
      componentStack?: string;
      route?: string;
    }) => ipcRenderer.send("app:log-renderer-error", payload),
  },
});

/** Canales que el proceso principal usa para informar el estado de la actualización. */
const UPDATER_CHANNELS = [
  "update-available",
  "update-not-available",
  "update-progress",
  "update-downloaded",
  "update-error",
] as const;

contextBridge.exposeInMainWorld("updater", {
  onUpdateAvailable: (cb: (data: UpdateInfo) => void) =>
    ipcRenderer.on("update-available", (_, data) => cb(data)),
  onUpdateNotAvailable: (cb: () => void) =>
    ipcRenderer.on("update-not-available", cb),
  onProgress: (cb: (data: UpdateProgress) => void) =>
    ipcRenderer.on("update-progress", (_, data) => cb(data)),
  onDownloaded: (cb: () => void) => ipcRenderer.on("update-downloaded", cb),
  onError: (cb: (data: { message: string }) => void) =>
    ipcRenderer.on("update-error", (_, data) => cb(data)),
  startDownload: () => ipcRenderer.send("start-update-download"),
  installUpdate: () => ipcRenderer.send("install-update"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  // Los `on` de arriba acumulan listeners: sin una forma de darlos de baja, cada
  // montaje del componente que los registra agrega un handler más y el mismo
  // aviso se muestra repetido (en desarrollo pasa siempre, porque `StrictMode`
  // ejecuta los efectos dos veces).
  removeAllListeners: () => {
    for (const channel of UPDATER_CHANNELS) {
      ipcRenderer.removeAllListeners(channel);
    }
  },
});
