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
} from "../src/Types/apiTypes";
import { UpdateInfo, UpdateProgress } from "../global";

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args;
    return ipcRenderer.on(channel, (event, ...args) =>
      listener(event, ...args)
    );
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args;
    return ipcRenderer.off(channel, ...omit);
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args;
    return ipcRenderer.send(channel, ...omit);
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args;
    return ipcRenderer.invoke(channel, ...omit);
  },

  // You can expose other APTs you need here.
  // ...
});

contextBridge.exposeInMainWorld("api", {
  cars: {
    create: (car: CreateCarDto) => ipcRenderer.invoke("car:create", car),
    getAll: async (params: CarQueryParams) =>
      await ipcRenderer.invoke("car:get-all", params),
    getActiveJobsCount: async () =>
      await ipcRenderer.invoke("car:active-jobs-count"),
    getByLicense: async (licence: string) =>
      await ipcRenderer.invoke("car:get-by-license", licence),
    update: async (id: string, kilometers: number) =>
      await ipcRenderer.invoke("car:update", id, kilometers),
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
        | { mode: "existing"; existingOwnerFullname: string }
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
    getByName: async (fullname: string) =>
      await ipcRenderer.invoke("client:find-by-name", fullname),
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
