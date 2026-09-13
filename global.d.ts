import {
  CreateCarDto,
  UpdateCarDto,
  UpdateJobDto,
} from "./electron/DataBase/Types/car.dto";
import { CreateClientDto } from "./electron/DataBase/Types/client.dto";
import {
  APIResponse,
  BackupEntry,
  DocumentQueryParams,
  CarQueryParams,
  ClientQueryParams,
  CreateCarJob,
  DocumentType,
  IssueDocumentBody,
  IssuedDocument,
  DocumentSnapshot,
  Paginated,
  ReminderQueryParams,
  SaveReminderBody,
  ServiceReminderView,
  ServiceSettings,
  UpdateClientBody,
} from "./src/Types/apiTypes";
import { Car, Client, DashboardStats, Jobs } from "./src/Types/types";
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
  /** Motivo del fallo, tal como lo reporta `electron-updater`. */
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
  /** Da de baja los listeners registrados con los `on*` (limpieza del efecto). */
  removeAllListeners: () => void;
}

declare global {
  interface Window {
    api: {
      cars: {
        create: (car: CreateCarDto) => Promise<APIResponse>;
        getAll: (
          params: CarQueryParams
        ) => Promise<APIResponse<Paginated<Car>>>;
        getActiveJobsCount: () => Promise<APIResponse<number>>;
        getByLicense: (license: string) => Promise<APIResponse<Car>>;
        update: (
          id: string,
          cambios: UpdateCarBody
        ) => Promise<APIResponse<Car>>;
        delete: (licence: string) => Promise<APIResponse>;
        addJob: (
          licence: string,
          job: CreateCarJob
        ) => Promise<APIResponse<Jobs>>;
        updateJob: (
          licence: string,
          jobId: string,
          updateJobDto: UpdateJobDto
        ) => Promise<APIResponse<Jobs>>;
        reassignOwner: (
          licensePlate: string,
          payload:
            | { mode: "existing"; existingOwnerId: string }
            | { mode: "new"; newOwner: CreateClientDto }
        ) => Promise<APIResponse>;
      };
      clients: {
        create: (dto: CreateClientDto) => Promise<APIResponse<Client>>;
        getAll: (
          params: ClientQueryParams
        ) => Promise<APIResponse<Paginated<Client>>>;
        getById: (id: string) => Promise<APIResponse<Client>>;
        getCities: () => Promise<APIResponse<string[]>>;
        search: (query: string) => Promise<APIResponse<Client[]>>;
        update: (dto: UpdateClientBody) => Promise<APIResponse<Client>>;
        toggleActive: (id: string) => Promise<APIResponse>;
        delete: (id: string) => Promise<APIResponse>;
      };
      dashboard: {
        getStats: () => Promise<APIResponse<DashboardStats>>;
      };
      service: {
        list: (
          params: ReminderQueryParams
        ) => Promise<APIResponse<Paginated<ServiceReminderView>>>;
        countDue: () => Promise<APIResponse<number>>;
        byCar: (
          licensePlate: string
        ) => Promise<APIResponse<ServiceReminderView[]>>;
        snooze: (
          id: string,
          days: number
        ) => Promise<APIResponse<ServiceReminderView>>;
        markContacted: (
          id: string
        ) => Promise<APIResponse<ServiceReminderView>>;
        complete: (id: string) => Promise<APIResponse<ServiceReminderView>>;
        dismiss: (id: string) => Promise<APIResponse>;
        reactivate: (id: string) => Promise<APIResponse<ServiceReminderView>>;
        save: (
          body: SaveReminderBody
        ) => Promise<APIResponse<ServiceReminderView>>;
        getSettings: () => Promise<APIResponse<ServiceSettings>>;
        setSettings: (
          settings: Partial<ServiceSettings>
        ) => Promise<APIResponse<ServiceSettings>>;
      };
      documents: {
        issue: (
          body: IssueDocumentBody
        ) => Promise<APIResponse<IssuedDocument>>;
        discard: (id: string) => Promise<APIResponse>;
        list: (
          filters?: DocumentQueryParams
        ) => Promise<APIResponse<IssuedDocument[]>>;
        get: (
          id: string
        ) => Promise<
          APIResponse<
            (IssuedDocument & { snapshot: DocumentSnapshot | null }) | null
          >
        >;
        savePdf: (payload: {
          defaultName: string;
          bytes: Uint8Array;
        }) => Promise<APIResponse<{ filePath: string }>>;
      };
      /** Suscribe al aviso de "los datos cambiaron". Devuelve la baja. */
      onDataChanged: (callback: () => void) => () => void;
      backup: {
        export: () => Promise<APIResponse>;
        import: () => Promise<APIResponse>;
        exportCsv: () => Promise<APIResponse>;
        openFolder: () => Promise<APIResponse>;
        list: () => Promise<APIResponse<BackupEntry[]>>;
        restore: (name: string) => Promise<APIResponse>;
      };
      global: {
        search: (query: string) => Promise<APIResponse<SearchResult>>;
        openLogsFolder: () => Promise<void>;
        openExternal: (url: string) => Promise<APIResponse>;
        setUnsavedChanges: (dirty: boolean) => void;
        logError: (payload: {
          scope: string;
          name?: string;
          message: string;
          stack?: string;
          componentStack?: string;
          route?: string;
        }) => void;
      };
    };
    updater: UpdaterAPI;
  }
}

type _SuppressUnused = UpdateCarDto;
