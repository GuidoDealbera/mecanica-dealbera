import type { CarBrand } from "../Utils/utils";
import { AppError, JobStatus, Paginated } from "./apiTypes";

export interface KmRecord {
  km: number;
  date: string;
}
export interface Client {
  id: string;
  fullname: string;
  phone: string;
  address: string;
  city: string;
  email?: string;
  isActive: boolean;
  createdAt?: string;
  cars?: Car[];
}

export interface Car {
  id: string;
  licensePlate: string;
  model: string;
  brand: CarBrand;
  year: number;
  jobs: Jobs[];
  kilometers: number;
  kmHistory?: KmRecord[];
  owner: Client;
  createdAt: Date;
  updatedAt: Date;
}

// El store guarda los datos crudos: las fechas quedan como `Date` (sin
// formatear). El formateo a texto se hace en la capa de presentación
// (componentes) con `formatDate()`. `Cars`/`Clients` se conservan como alias
// por los consumidores que ya los referencian.
export type Cars = Car;
export type Clients = Client;

export interface Jobs {
  id: string;
  price: number;
  description: string;
  isThirdParty: boolean;
  status: JobStatus;
  parts: {
    name: string;
    price: number;
  }[];
  createdAt?: string;
  updatedAt?: string;
}

// Los listados guardan una PÁGINA de resultados (server-side), no el dataset
// completo: `list` incluye los items de la página actual + `total`/`page`/
// `pageSize` para paginar en la vista.
export interface ClientState {
  list: Paginated<Clients>;
  /**
   * `false` mientras el listado nunca se resolvió (el estado "idle" que no se
   * puede deducir de `loadingStates.fetching_all`, porque ahí `false` significa
   * tanto "todavía no se pidió" como "ya terminó"). Lo resetean los reducers
   * que vacían `list`, así ambos no pueden desincronizarse.
   */
  listLoaded: boolean;
  client: Clients | undefined;
  /**
   * Ídem `listLoaded` pero para el detalle. Acá es imprescindible para poder
   * distinguir "todavía no cargó" de "cargó y no existe": `client` queda en
   * `undefined` en los dos casos.
   */
  clientLoaded: boolean;
  loadingStates: {
    fetching_all: boolean;
    fetching: boolean;
    creating: boolean;
    updating: boolean;
    deleting: boolean;
  };
  error: AppError | null;
}

export interface CarState {
  list: Paginated<Cars>;
  /** Ver `ClientState["listLoaded"]`. */
  listLoaded: boolean;
  car: Cars | undefined;
  /** Ver `ClientState["clientLoaded"]`. */
  carLoaded: boolean;
  loadingStates: {
    fetching_all: boolean;
    fetching: boolean;
    creating: boolean;
    updating: boolean;
    deleting: boolean;
  };
  error: AppError | null;
}

export interface DashboardStats {
  totalCars: number;
  totalClients: number;
  activeClients: number;
  newCarsThisMonth: number;
  newClientsThisMonth: number;
  pendingJobs: number;
  jobsInProgress: number;
  completedJobs: number;
  deliveredJobs: number;
  completedThisMonth: number;
  revenueThisMonth: number;
  carsWithAlerts: number;
  deliveredThisMonth: number;
  monthlyRevenue: { month: string; revenue: number }[];
  recentActiveJobs: {
    licensePlate: string;
    brand: string;
    model: string;
    description: string;
    price: number;
  }[];
  recentCompletedJobs: {
    licensePlate: string;
    brand: string;
    model: string;
    description: string;
    price: number;
  }[];
  recentDeliveredJobs: {
    licensePlate: string;
    brand: string;
    model: string;
    description: string;
    price: number;
  }[];
}

export interface ServiceAlert {
  licensePlate: string;
  brand: string;
  model: string;
  year: number;
  kilometers: number;
  ownerName: string;
  ownerPhone: string;
  daysSinceLastJob: number | null;
  lastJobDate: string | null;
}
