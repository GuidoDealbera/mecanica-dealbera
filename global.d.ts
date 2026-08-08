import {
  CreateCarDto,
  UpdateCarDto,
  UpdateJobDto,
} from "./electron/DataBase/Types/car.dto";
import { CreateClientDto } from "./electron/DataBase/Types/client.dto";
import {
  APIResponse,
  CarQueryParams,
  ClientQueryParams,
  CreateCarJob,
  Paginated,
  UpdateClientBody,
} from "./src/Types/apiTypes";
import {
  Car,
  Client,
  DashboardStats,
  Jobs,
  ServiceAlert,
} from "./src/Types/types";
export {};

interface SearchResult {
  cars: {
    id: string;
    licensePlate: string;
    brand: string;
    model: string;
    year: number;
    ownerName: string;
  }[];
  clients: {
    id: string;
    fullname: string;
    phone: string;
    city: string;
    isActive: boolean;
  }[];
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
        getAll: (params: CarQueryParams) => Promise<Paginated<Car>>;
        getActiveJobsCount: () => Promise<number>;
        getByLicense: (license: string) => Promise<APIResponse<Car>>;
        update: (id: string, kilometers: number) => Promise<APIResponse<Car>>;
        delete: (licence: string) => Promise<APIResponse>;
        findJobs: () => Promise<{ licensePlate: string; jobs: Jobs[] }[]>;
        addJob: (
          licence: string,
          job: CreateCarJob
        ) => Promise<APIResponse<Jobs>>;
        updateJob: (
          licence: string,
          jobId: string,
          updateJobDto: UpdateJobDto
        ) => Promise<APIResponse<Jobs>>;
        getServiceAlerts: () => Promise<APIResponse<ServiceAlert[]>>;
        reassignOwner: (
          licensePlate: string,
          payload:
            | { mode: "existing"; existingOwnerFullname: string }
            | { mode: "new"; newOwner: CreateClientDto }
        ) => Promise<APIResponse>;
      };
      clients: {
        create: (dto: CreateClientDto) => Promise<APIResponse>;
        getAll: (params: ClientQueryParams) => Promise<Paginated<Client>>;
        getByName: (fullname: string) => Promise<APIResponse<Client>>;
        getCities: () => Promise<string[]>;
        search: (query: string) => Promise<APIResponse<Client[]>>;
        update: (dto: UpdateClientBody) => Promise<APIResponse<Client>>;
        toggleActive: (id: string) => Promise<APIResponse>;
        delete: (id: string) => Promise<APIResponse>;
      };
      dashboard: {
        getStats: () => Promise<APIResponse<DashboardStats>>;
      };
      backup: {
        export: () => Promise<APIResponse>;
        import: () => Promise<APIResponse>;
        exportCsv: () => Promise<APIResponse>;
        openFolder: () => Promise<APIResponse>;
        list: () => Promise<APIResponse<string[]>>;
      };
      global: {
        search: (query: string) => Promise<{ status: string } & SearchResult>;
        openLogsFolder: () => Promise<void>;
        openExternal: (url: string) => Promise<void>;
      };
    };
    updater: UpdaterAPI;
  }
}

type _SuppressUnused = UpdateCarDto;
