import { Cars, Jobs, KmRecord } from "../Types/types";

/**
 * Modelo de eventos del historial. Lo comparten el timeline de un vehículo
 * (ficha del auto) y el historial cruzado del cliente (todos sus vehículos en
 * una sola línea de tiempo), por eso cada evento lleva su `car`.
 */
export type TimelineEvent = {
  /** `null` si el registro no tiene una fecha válida (se ordena al final). */
  date: Date | null;
  car: Cars;
} & ({ kind: "km"; record: KmRecord } | { kind: "job"; job: Jobs });

/** Convierte a `Date` sólo si el valor produce una fecha válida. */
const toDate = (value: string | Date | undefined | null): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Arma la línea de tiempo de uno o varios vehículos: mezcla actualizaciones de
 * kilometraje y trabajos, y ordena de lo más reciente a lo más antiguo. Los
 * eventos sin fecha válida quedan al final (no se descartan: son datos reales).
 */
export const buildTimelineEvents = (cars: Cars[]): TimelineEvent[] => {
  const events: TimelineEvent[] = [];

  for (const car of cars) {
    for (const record of car.kmHistory ?? []) {
      events.push({ kind: "km", date: toDate(record.date), record, car });
    }
    for (const job of car.jobs ?? []) {
      events.push({
        kind: "job",
        date: toDate(job.updatedAt ?? job.createdAt),
        job,
        car,
      });
    }
  }

  return events.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.getTime() - a.date.getTime();
  });
};
