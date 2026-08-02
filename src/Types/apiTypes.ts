import type { CarBrand } from "../Utils/utils";
import { Client, Jobs } from "./types";

export enum JobStatus {
  PENDING = "pending",
  IN_PROGRESS = "in-progress",
  COMPLETED = "completed",
  DELIVERED = "delivered",
}

export const STATUS_LABELS: Record<JobStatus, string> = {
  [JobStatus.IN_PROGRESS]: "En progreso",
  [JobStatus.COMPLETED]: "Completado",
  [JobStatus.DELIVERED]: "Entregado",
  [JobStatus.PENDING]: "Sin comenzar",
};

export interface UpdateJobBody {
  status?: JobStatus;
  price?: number;
  parts?: {
    name: string;
    price: number;
  }[];
  notes?: string;
}

export interface CreateCarBody {
  licensePlate: string;
  brand: CarBrand;
  model: string;
  year: number;
  owner: Omit<Client, "id" | "cars">;
  jobs?: Jobs[];
  kilometers: number;
}

export type ApiStatus = "success" | "failed" | "cancelled";

/**
 * Respuesta unificada del backend (IPC) para operaciones tipo comando.
 * Discriminada por `status`:
 * - `success`: incluye `result` tipado (`T`).
 * - `failed` / `cancelled`: sin `result`.
 * `message` está siempre presente (los consumidores lo muestran en toasts).
 *
 * Los endpoints de solo-lectura que devuelven colecciones crudas
 * (`car:get-all`, `client:get-all`, `car:find-jobs`) y la búsqueda global
 * (`global:search`, forma `{ status, cars, clients }`) NO usan este envelope.
 */
export type APIResponse<T = undefined> =
  | { status: "success"; message: string; result: T }
  | { status: "failed"; message: string; result?: undefined }
  | { status: "cancelled"; message: string; result?: undefined };

export type SortDir = "asc" | "desc";

/**
 * Parámetros de un listado paginado server-side. `page` es 1-based. `search`
 * filtra (LIKE, case-insensitive) y `sortBy`/`sortDir` ordenan en la DB. Las
 * columnas válidas de `sortBy` las define cada endpoint.
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortDir?: SortDir;
}

export type CarQueryParams = PaginationParams;

export interface ClientQueryParams extends PaginationParams {
  /** Si es `true` incluye también los clientes inactivos. */
  includeInactive?: boolean;
}

/** Una página de resultados + metadatos para paginar en la vista. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Body para actualizar un cliente: el id es obligatorio (identifica el registro),
// el resto de los campos son opcionales (se actualiza solo lo que venga definido).
export type UpdateClientBody = Partial<Omit<Client, "id" | "cars">> & {
  id: string;
};

export interface AppError {
  message: string;
  code?: string;
}

export interface UpdateCar {
  owner?: Omit<Client, "id" | "cars">;
  kilometers?: number;
}

export interface CreateCarJob {
  price: number | "";
  description: string;
  isThirdParty: boolean;
  status: JobStatus;
  parts: {
    name: string;
    price: number;
  }[];
  notes?: string;
}
