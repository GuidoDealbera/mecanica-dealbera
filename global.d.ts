import { CreateCarDto, UpdateCarDto, UpdateJobDto } from "./electron/DataBase/Types/car.dto";
import { CreateClientDto } from "./electron/DataBase/Types/client.dto";
import { ApiResponse } from "./electron/DataBase/Types/types";
import { APIResponse, CreateCarJob } from "./src/Types/apiTypes";
import { Car, Client, DashboardStats, Jobs, ServiceAlert } from "./src/Types/types";
export {};

interface SearchResult {
  cars: { id: string; licensePlate: string; brand: string; model: string; year: number; ownerName: string }[];
  clients: { id: string; fullname: string; phone: string; city: string; isActive: boolean }[];
}

export interface UpdateInfo {
  version: string;
}
 
export interface UpdateProgress {
  percent: number;
  bytesPerSecond?: number;
}
 
export interface UpdateError {
  message: string;
}
 
export interface UpdaterAPI {
  onUpdateAvailable: (callback: (data: UpdateInfo) => void) => void;
  onUpdateNotAvailable: (callback: () => void) => void;
  onProgress: (callback: (data: UpdateProgress) => void) => void;
  onDownloaded: (callback: () => void) => void;
  onError: (callback: (data: UpdateError) => void) => void;
 
  startDownload: () => void;
  installUpdate: () => void;
  checkForUpdates: () => Promise<void>;
}

declare global {
  interface Window {
    api: {
      cars: {
        create: (car: CreateCarDto) => Promise<APIResponse>;
        getAll: () => Promise<Car[]>;
        getByLicense: (license: string) => Promise<APIResponse>;
        update: (id: string, kilometers: number) => Promise<APIResponse>;
        delete: (licence: string) => Promise<APIResponse>;
        findJobs: () => Promise<{ licensePlate: string; jobs: Jobs[] }[]>;
        addJob: (licence: string, job: CreateCarJob) => Promise<APIResponse>;
        updateJob: (licence: string, jobId: string, updateJobDto: UpdateJobDto) => Promise<APIResponse>;
        getServiceAlerts: () => Promise<{ status: string; result: ServiceAlert[] }>;
        reassignOwner: (
          licensePlate: string,
          payload:
            | { mode: "existing"; existingOwnerFullname: string }
            | { mode: "new"; newOwner: CreateClientDto }
        ) => Promise<APIResponse>;
      };
      clients: {
        create: (dto: CreateClientDto) => Promise<APIResponse>;
        getAll: () => Promise<Client[]>;
        getByName: (fullname: string) => Promise<APIResponse>;
        search: (query: string) => Promise<{ status: string; results: Client[] }>;
        update: (dto: Partial<CreateClientDto>) => Promise<APIResponse>;
        toggleActive: (id: string) => Promise<APIResponse>;
        delete: (id: string) => Promise<APIResponse>;
      };
      dashboard: {
        getStats: () => Promise<{ status: string; result: DashboardStats }>;
      };
      budget: {
        print: (data: unknown) => Promise<APIResponse>;
        printDirect: (data: unknown) => Promise<APIResponse>;
      };
      backup: {
        export: () => Promise<APIResponse>;
        import: () => Promise<APIResponse>;
      };
      global: {
        search: (query: string) => Promise<{ status: string } & SearchResult>;
      };
    },
    updater: UpdaterAPI
  }
}

type _SuppressUnused = UpdateCarDto | ApiResponse;
