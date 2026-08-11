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
  serviceType?: ServiceType | null;
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
 * (`car:get-all`, `client:get-all`) y la búsqueda global (`global:search`, forma
 * `{ status, cars, clients }`) NO usan este envelope.
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

export interface CarQueryParams extends PaginationParams {
  /** Filtra por marca exacta (valor de `CarsBrands`). */
  brand?: string;
  /** Año mínimo (inclusive). */
  yearFrom?: number;
  /** Año máximo (inclusive). */
  yearTo?: number;
}

export interface ClientQueryParams extends PaginationParams {
  /** Si es `true` incluye también los clientes inactivos. */
  includeInactive?: boolean;
  /** Filtra por ciudad/localidad exacta. */
  city?: string;
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

// ─── Recordatorios de service ────────────────────────────────────────────

/** Tipo de service. Cada vehículo lleva un recordatorio vigente por tipo. */
export enum ServiceType {
  GENERAL = "general",
  OIL = "oil",
  BELT = "belt",
  BRAKES = "brakes",
  OTHER = "other",
}

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  [ServiceType.GENERAL]: "Service general",
  [ServiceType.OIL]: "Cambio de aceite",
  [ServiceType.BELT]: "Correa de distribución",
  [ServiceType.BRAKES]: "Frenos",
  [ServiceType.OTHER]: "Otro",
};

/**
 * Estado del recordatorio. Es lo que evita la "fatiga de alerta": un
 * recordatorio atendido, postergado o descartado deja de aparecer.
 */
export enum ReminderStatus {
  /** Vigente: se evalúa contra la fecha y el kilometraje del vehículo. */
  PENDING = "pending",
  /** Postergado hasta `snoozedUntil` (vuelve a aparecer después de esa fecha). */
  SNOOZED = "snoozed",
  /** El service se hizo. Queda como historial; se genera el siguiente. */
  DONE = "done",
  /** Descartado a mano (p. ej. el cliente no vuelve más). */
  DISMISSED = "dismissed",
}

/** Urgencia calculada de un recordatorio vigente. */
export type ReminderUrgency = "overdue" | "due-soon" | "upcoming" | "snoozed";

/** Intervalos y umbrales configurables del sistema de recordatorios. */
export interface ServiceSettings {
  /** Meses entre services (por defecto, si el vehículo no define el suyo). */
  intervalMonths: number;
  /** Kilómetros entre services (ídem). */
  intervalKm: number;
  /** Días de anticipación para considerar que un service "vence pronto". */
  soonDays: number;
  /** Kilómetros de anticipación para lo mismo. */
  soonKm: number;
}

export const DEFAULT_SERVICE_SETTINGS: ServiceSettings = {
  intervalMonths: 6,
  intervalKm: 10000,
  soonDays: 30,
  soonKm: 1000,
};

/** Recordatorio tal como lo devuelve el backend, con el contexto que se muestra. */
export interface ServiceReminderView {
  id: string;
  type: ServiceType;
  status: ReminderStatus;
  /** Fecha de vencimiento (ISO) o `null` si el recordatorio es sólo por km. */
  dueDate: string | null;
  /** Kilometraje de vencimiento o `null` si es sólo por fecha. */
  dueKm: number | null;
  snoozedUntil: string | null;
  contactedAt: string | null;
  notes: string;
  car: {
    licensePlate: string;
    brand: string;
    model: string;
    year: number;
    kilometers: number;
  };
  owner: { fullname: string; phone: string };
  /**
   * Promedio de kilómetros por día del vehículo (de su historial de km), para
   * proyectar cuándo alcanzará `dueKm`. `null` si no hay historial suficiente.
   */
  kmPerDay: number | null;
}

/** Alcance del listado de recordatorios. */
export type ReminderScope = "due" | "pending" | "all";

export interface ReminderQueryParams extends PaginationParams {
  /** `due` (vencidos o por vencer, default), `pending` (todos los vigentes) o `all`. */
  scope?: ReminderScope;
  /** Filtra por tipo de service. */
  type?: ServiceType;
}

/** Body para crear o actualizar a mano el recordatorio de un vehículo. */
export interface SaveReminderBody {
  /** Si viene, actualiza ese recordatorio; si no, crea uno nuevo. */
  id?: string;
  licensePlate: string;
  type: ServiceType;
  /** Fecha de vencimiento en ISO (o `null` para que sea sólo por km). */
  dueDate?: string | null;
  dueKm?: number | null;
  notes?: string;
}

/**
 * Tipo de documento emitido. Cada tipo lleva su propia numeración correlativa.
 */
export enum DocumentType {
  BUDGET = "budget",
  INVOICE = "invoice",
}

/** Prefijo del número según el tipo de documento (ej. PRE-000123). */
export const DOCUMENT_PREFIX: Record<DocumentType, string> = {
  [DocumentType.BUDGET]: "PRE",
  [DocumentType.INVOICE]: "FAC",
};

/** Cantidad de dígitos del correlativo (PRE-000123). */
const DOCUMENT_NUMBER_PAD = 6;

/**
 * Formatea el número correlativo de un documento. Única fuente de verdad del
 * formato: la usan el backend (al emitir) y el PDF.
 */
export const formatDocumentNumber = (
  type: DocumentType,
  number: number
): string =>
  `${DOCUMENT_PREFIX[type]}-${String(number).padStart(DOCUMENT_NUMBER_PAD, "0")}`;

/** Datos que se guardan al emitir un documento (snapshot del momento). */
export interface IssueDocumentBody {
  type: DocumentType;
  licensePlate: string;
  clientName: string;
  total: number;
}

/** Documento ya emitido, con su número correlativo asignado. */
export interface IssuedDocument {
  id: string;
  type: DocumentType;
  /** Correlativo dentro del tipo (1, 2, 3...). */
  number: number;
  /** Número formateado para mostrar/imprimir (ej. "PRE-000123"). */
  formatted: string;
  licensePlate: string;
  clientName: string;
  total: number;
  createdAt: string;
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
  /** Si el trabajo es un service, de qué tipo (programa el próximo). */
  serviceType?: ServiceType | null;
}
