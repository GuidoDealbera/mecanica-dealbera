import {
  DEFAULT_SERVICE_SETTINGS,
  ReminderStatus,
  ReminderUrgency,
  ServiceSettings,
} from "../Types/apiTypes";
import { KmRecord } from "../Types/types";

/**
 * Lógica de los recordatorios de service. Es un módulo **puro y compartido**:
 * lo usan el backend (para generar y filtrar recordatorios) y el renderer (para
 * mostrar urgencia y textos). Antes la regla de "auto sin service" estaba
 * escrita dos veces —el endpoint de alertas y la notificación de arranque—, con
 * el riesgo de que divergieran.
 *
 * Criterio: un service vence por **tiempo o por kilómetros, lo que ocurra
 * primero** (que es cómo se maneja en el taller). Un recordatorio puede tener
 * sólo fecha, sólo kilometraje, o ambos.
 */

const MS_PER_DAY = 86_400_000;

/** Días completos entre dos fechas (positivo si `to` es posterior a `from`). */
export const daysBetween = (from: Date, to: Date): number =>
  Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);

/** Suma meses a una fecha sin desbordar el día (31/01 + 1 mes = 28/02). */
export const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date.getTime());
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
};

export interface NextServiceInput {
  /** Fecha del service que se acaba de hacer. */
  fromDate: Date;
  /** Kilometraje del vehículo al hacerlo (si se conoce). */
  fromKm?: number | null;
  /** Intervalo del vehículo; si no define uno, se usa el global. */
  intervalMonths?: number | null;
  intervalKm?: number | null;
  settings?: ServiceSettings;
}

/**
 * Calcula el próximo vencimiento a partir del service recién hecho. Devuelve
 * `dueKm: null` si no se conoce el kilometraje (el recordatorio queda por fecha).
 */
export const computeNextService = ({
  fromDate,
  fromKm,
  intervalMonths,
  intervalKm,
  settings = DEFAULT_SERVICE_SETTINGS,
}: NextServiceInput): { dueDate: Date; dueKm: number | null } => {
  const months =
    intervalMonths && intervalMonths > 0
      ? intervalMonths
      : settings.intervalMonths;
  const km = intervalKm && intervalKm > 0 ? intervalKm : settings.intervalKm;

  return {
    dueDate: addMonths(fromDate, months),
    dueKm:
      typeof fromKm === "number" && Number.isFinite(fromKm) && fromKm >= 0
        ? fromKm + km
        : null,
  };
};

/**
 * Promedio de kilómetros por día según el historial de kilometraje. Necesita al
 * menos dos registros separados en el tiempo; devuelve `null` si no alcanza.
 * Sirve para proyectar cuándo el vehículo va a alcanzar el km de vencimiento.
 */
export const estimateKmPerDay = (
  kmHistory: KmRecord[] | undefined | null
): number | null => {
  const records = (kmHistory ?? [])
    .map((r) => ({ km: r.km, time: new Date(r.date).getTime() }))
    .filter((r) => Number.isFinite(r.time) && Number.isFinite(r.km))
    .sort((a, b) => a.time - b.time);

  if (records.length < 2) return null;

  const first = records[0];
  const last = records[records.length - 1];
  const days = (last.time - first.time) / MS_PER_DAY;
  const km = last.km - first.km;
  if (days <= 0 || km <= 0) return null;

  return km / days;
};

/**
 * Proyecta la fecha en la que el vehículo alcanzaría `dueKm` al ritmo actual.
 * `null` si faltan datos o si el kilometraje ya se alcanzó.
 */
export const projectKmDueDate = (
  currentKm: number,
  dueKm: number | null,
  kmPerDay: number | null,
  today: Date
): Date | null => {
  if (dueKm === null || kmPerDay === null || kmPerDay <= 0) return null;
  const remaining = dueKm - currentKm;
  if (remaining <= 0) return null;
  return new Date(today.getTime() + (remaining / kmPerDay) * MS_PER_DAY);
};

export interface EvaluateReminderInput {
  status: ReminderStatus;
  dueDate: Date | string | null;
  dueKm: number | null;
  snoozedUntil: Date | string | null;
  currentKm: number;
  kmPerDay?: number | null;
  today?: Date;
  settings?: ServiceSettings;
}

export interface ReminderEvaluation {
  urgency: ReminderUrgency;
  /** Días hasta el vencimiento por fecha (negativo si ya venció). */
  daysUntilDue: number | null;
  /** Kilómetros que faltan para el vencimiento por km (negativo si se pasó). */
  kmRemaining: number | null;
  /** Fecha estimada en la que alcanzaría `dueKm` al ritmo actual. */
  projectedKmDate: Date | null;
  /** `true` si corresponde mostrarlo como pendiente de atención. */
  isDue: boolean;
}

const toDateOrNull = (value: Date | string | null): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Evalúa un recordatorio: urgencia, cuánto falta (en días y en km) y si debe
 * aparecer en la bandeja. Vence por tiempo **o** por kilómetros, lo que ocurra
 * primero; un postergado vigente queda fuera hasta su fecha.
 */
export const evaluateReminder = ({
  status,
  dueDate,
  dueKm,
  snoozedUntil,
  currentKm,
  kmPerDay = null,
  today = new Date(),
  settings = DEFAULT_SERVICE_SETTINGS,
}: EvaluateReminderInput): ReminderEvaluation => {
  const due = toDateOrNull(dueDate);
  const snoozed = toDateOrNull(snoozedUntil);

  const daysUntilDue = due ? daysBetween(today, due) : null;
  const kmRemaining = typeof dueKm === "number" ? dueKm - currentKm : null;
  const projectedKmDate = projectKmDueDate(currentKm, dueKm, kmPerDay, today);

  const base: Omit<ReminderEvaluation, "urgency" | "isDue"> = {
    daysUntilDue,
    kmRemaining,
    projectedKmDate,
  };

  // Cerrados: no se evalúan.
  if (status === ReminderStatus.DONE || status === ReminderStatus.DISMISSED) {
    return { ...base, urgency: "upcoming", isDue: false };
  }

  // Postergado y todavía dentro del plazo: fuera de la bandeja.
  if (snoozed && snoozed.getTime() > today.getTime()) {
    return { ...base, urgency: "snoozed", isDue: false };
  }

  const overdue =
    (daysUntilDue !== null && daysUntilDue < 0) ||
    (kmRemaining !== null && kmRemaining < 0);
  if (overdue) return { ...base, urgency: "overdue", isDue: true };

  const dueSoon =
    (daysUntilDue !== null && daysUntilDue <= settings.soonDays) ||
    (kmRemaining !== null && kmRemaining <= settings.soonKm);
  if (dueSoon) return { ...base, urgency: "due-soon", isDue: true };

  return { ...base, urgency: "upcoming", isDue: false };
};

/** Color semántico de la urgencia (mismo criterio que los Chips de la app). */
export const URGENCY_COLOR: Record<
  ReminderUrgency,
  "danger" | "warning" | "default" | "primary"
> = {
  overdue: "danger",
  "due-soon": "warning",
  upcoming: "default",
  snoozed: "primary",
};

export const URGENCY_LABELS: Record<ReminderUrgency, string> = {
  overdue: "Vencido",
  "due-soon": "Vence pronto",
  upcoming: "Al día",
  snoozed: "Postergado",
};

/**
 * Texto de "cuánto falta / hace cuánto venció" para mostrar en la bandeja.
 * Combina el plazo por fecha y el que falta por kilómetros.
 */
export const formatDueSummary = (evaluation: ReminderEvaluation): string => {
  const parts: string[] = [];
  const { daysUntilDue, kmRemaining } = evaluation;

  if (daysUntilDue !== null) {
    if (daysUntilDue < 0) {
      const days = Math.abs(daysUntilDue);
      parts.push(
        days >= 60
          ? `venció hace ${Math.floor(days / 30)} meses`
          : `venció hace ${days} ${days === 1 ? "día" : "días"}`
      );
    } else if (daysUntilDue === 0) {
      parts.push("vence hoy");
    } else {
      parts.push(
        daysUntilDue >= 60
          ? `en ${Math.floor(daysUntilDue / 30)} meses`
          : `en ${daysUntilDue} ${daysUntilDue === 1 ? "día" : "días"}`
      );
    }
  }

  if (kmRemaining !== null) {
    parts.push(
      kmRemaining < 0
        ? `${Math.abs(kmRemaining).toLocaleString("es-AR")} km pasados`
        : `faltan ${kmRemaining.toLocaleString("es-AR")} km`
    );
  }

  return parts.join(" · ") || "Sin vencimiento definido";
};
