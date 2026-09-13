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
  clientNote?: string;
  isService?: boolean;
}

export interface CreateCarBody {
  licensePlate: string;
  brand: CarBrand;
  model: string;
  year: number;
  owner: Omit<Client, "id" | "cars">;
  /**
   * Titular ya registrado, cuando se lo eligió del autocompletar.
   *
   * Es lo que distingue "este auto es de un cliente que ya está" de "hay que
   * darlo de alta". Antes lo decidía el backend buscando por nombre, y con eso
   * el nombre era la identidad del cliente.
   */
  ownerId?: string;
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
 * **Lo usan todos los canales, también los de sólo lectura.** Antes nueve
 * devolvían el dato pelado —un `Paginated`, un número, un arreglo—, y eso tenía
 * dos consecuencias: `ensureSuccess` no se podía usar en la mitad de las
 * llamadas, así que cada pantalla inventaba su manejo de error; y cuando una
 * lectura fallaba de verdad, la excepción viajaba cruda hasta el renderer y el
 * usuario veía el mensaje de TypeORM.
 *
 * En las lecturas el `message` de éxito va vacío a propósito: no hay nada que
 * avisar cuando algo simplemente se leyó, y un texto ahí sólo invita a
 * mostrarlo.
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
// Los tipos de service (general, aceite, correa, frenos, otro) se eliminaron:
// el taller trabaja con un único circuito y la abstracción a medio usar sólo
// complicaba el modelo. Ahora un trabajo "es un service" o no lo es, y cada
// vehículo tiene a lo sumo un recordatorio vigente. Ver la migración
// SimplifyServiceType1700000011000.

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
  /**
   * Filtra por si ya se contactó al cliente. `undefined` no filtra.
   * Con 70 recordatorios vencidos, lo primero que se necesita saber es a quién
   * todavía no se le avisó.
   */
  contacted?: boolean;
}

/** Body para crear o actualizar a mano el recordatorio de un vehículo. */
export interface SaveReminderBody {
  /** Si viene, actualiza ese recordatorio; si no, crea uno nuevo. */
  id?: string;
  licensePlate: string;
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
/**
 * Copia de lo que se imprimió, para poder volver a imprimirlo.
 *
 * La tabla `document` guardaba tipo, número, patente, titular y total, pero no
 * los renglones. O sea que el historial decía que se emitió `FAC-000007` por
 * $89.000 y **no había forma de reproducir ese PDF**: si el cliente lo perdía, o
 * si mientras tanto se editaba o borraba el trabajo, lo que decía el documento
 * ya no existía en ningún lado. Para algo que es un comprobante, eso no es una
 * mejora que falta: es la razón de ser de la tabla.
 *
 * Se guarda **sólo lo que el documento imprime**, no las entidades enteras: sin
 * `kmHistory`, sin las notas internas del taller y sin los trabajos que no
 * entraron. Un comprobante es lo que dice el papel.
 */
export interface DocumentSnapshot {
  /** Título impreso (varía según el tipo). */
  title: string;
  car: {
    licensePlate: string;
    brand: string;
    model: string;
    year: number;
    kilometers: number;
    owner: {
      fullname: string;
      phone: string;
      address: string;
      city: string;
    } | null;
  };
  jobs: {
    id: string;
    description: string;
    price: number;
    isThirdParty: boolean;
    clientNote?: string;
    parts: { name: string; price: number }[];
  }[];
  /** Mismos campos que `BudgetTotals`, que es lo que el documento imprime. */
  totals: {
    laborTotal: number;
    partsGrandTotal: number;
    thirdPartyTotal: number;
    ownTotal: number;
    total: number;
  };
  /** Sólo en el consolidado de un cliente con varios vehículos. */
  vehicles?: {
    licensePlate: string;
    brand: string;
    model: string;
    year: number;
    kilometers: number;
  }[];
  /** Patente de cada trabajo, en el consolidado. */
  jobPlates?: Record<string, string>;
}

export interface IssueDocumentBody {
  type: DocumentType;
  licensePlate: string;
  clientName: string;
  total: number;
  /** Ver `DocumentSnapshot`. Es lo que permite reimprimir. */
  snapshot: DocumentSnapshot;
}

/** Filtros del historial de documentos. Todos opcionales. */
export interface DocumentQueryParams {
  type?: DocumentType;
  licensePlate?: string;
  /** Cuántos traer (1-100, por defecto 20). */
  limit?: number;
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
  /**
   * Si se guardó la copia de lo impreso, o sea si se puede reimprimir.
   *
   * Va como booleano y no como la copia entera: el historial trae veinte
   * documentos y no tiene por qué arrastrar veinte copias completas para
   * decidir si mostrar un botón.
   */
  hasSnapshot: boolean;
}

/**
 * Campos editables de un vehículo. La patente no está: es la identidad del
 * vehículo —la usan las rutas, los recordatorios y los documentos ya emitidos—
 * así que cambiarla es otra operación, no una corrección de tipeo.
 */
export interface UpdateCarBody {
  brand?: string;
  model?: string;
  year?: number;
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
  /** Observación para el cliente: **sí** sale impresa en el documento. */
  clientNote?: string;
  /** Si es un service: al completarlo se programa el próximo. */
  isService?: boolean;
}

/**
 * Un respaldo automático, tal como lo lista la pantalla de Gestión de datos.
 * La fecha viaja como ISO porque cruza el puente IPC (que serializa a JSON).
 */
export interface BackupEntry {
  name: string;
  date: string;
  sizeKb: number;
}
