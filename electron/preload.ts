import { ipcRenderer, contextBridge } from "electron";
import { CreateCarDto, UpdateJobDto } from "./DataBase/Types/car.dto";
import { CreateClientDto } from "./DataBase/Types/client.dto";

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
  //Cars
  cars: {
    create: (car: CreateCarDto) => ipcRenderer.invoke("car:create", car),
    getAll: async () => await ipcRenderer.invoke("car:get-all"),
    getByLicense: async (licence: string) => await ipcRenderer.invoke("car:get-by-license", licence),
    update: async (id: string, updateCarDto: UpdateJobDto) => await ipcRenderer.invoke("car:update", id, updateCarDto),
    delete: async (licence: string) => await ipcRenderer.invoke("car:delete", licence),
    findJobs: async () => await ipcRenderer.invoke("car:find-jobs"),
    updateJob: async (licence: string, jobId: string, updateJobDto: UpdateJobDto) => await ipcRenderer.invoke("car:update-job", licence, jobId, updateJobDto)
  },
  clients: {
    create: async (createClientDto: CreateClientDto) => await ipcRenderer.invoke("client:create", createClientDto),
    getAll: async () => await ipcRenderer.invoke("client:get-all"),
    getByName: async (fullname: string) => await ipcRenderer.invoke('client:find-by-name', fullname),
    update: async (updateClientDto: Partial<CreateClientDto>) => await ipcRenderer.invoke("client:update", updateClientDto),
  }
});
