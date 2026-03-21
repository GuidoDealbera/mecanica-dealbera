import { ipcRenderer, contextBridge } from "electron";
import { CreateCarDto, UpdateJobDto } from "./DataBase/Types/car.dto";
import { CreateClientDto } from "./DataBase/Types/client.dto";
import { Jobs } from "../src/Types/types";

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args;
    return ipcRenderer.on(channel, (event, ...args) =>
      listener(event, ...args),
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
    getAll: async () => await ipcRenderer.invoke("car:get-all"),
    getByLicense: async (licence: string) =>
      await ipcRenderer.invoke("car:get-by-license", licence),
    update: async (id: string, kilometers: number) =>
      await ipcRenderer.invoke("car:update", id, kilometers),
    delete: async (licence: string) =>
      await ipcRenderer.invoke("car:delete", licence),
    addJob: async (licence: string, job: Jobs) =>
      await ipcRenderer.invoke("car:add-job", licence, job),
    findJobs: async () => await ipcRenderer.invoke("car:find-jobs"),
    updateJob: async (
      licence: string,
      jobId: string,
      updateJobDto: UpdateJobDto,
    ) =>
      await ipcRenderer.invoke("car:update-job", licence, jobId, updateJobDto),
    getServiceAlerts: async () =>
      await ipcRenderer.invoke("car:service-alerts"),
  },
  clients: {
    create: async (dto: CreateClientDto) =>
      await ipcRenderer.invoke("client:create", dto),
    getAll: async () => await ipcRenderer.invoke("client:get-all"),
    getByName: async (fullname: string) =>
      await ipcRenderer.invoke("client:find-by-name", fullname),
    search: async (query: string) =>
      await ipcRenderer.invoke("client:search", query),
    update: async (dto: Partial<CreateClientDto>) =>
      await ipcRenderer.invoke("client:update", dto),
    toggleActive: async (id: string) =>
      await ipcRenderer.invoke("client:toggle-active", id),
    delete: async (id: string) => await ipcRenderer.invoke("client:delete", id),
  },
  dashboard: {
    getStats: async () => await ipcRenderer.invoke("dashboard:get-stats"),
  },
  backup: {
    export: async () => await ipcRenderer.invoke("backup:export"),
    import: async () => await ipcRenderer.invoke("backup:import"),
  },
  global: {
    search: async (query: string) =>
      await ipcRenderer.invoke("global:search", query),
  },
});
