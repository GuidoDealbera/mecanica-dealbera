import React from "react";
import { Chip } from "@heroui/react";
import { MdBuild, MdSpeed } from "react-icons/md";
import { Cars, Jobs, KmRecord } from "../../Types/types";
import { JobStatus, STATUS_LABELS } from "../../Types/apiTypes";
import { formatARS, formatDate } from "../../Utils/utils";

type TimelineEvent =
  | { kind: "km"; date: Date; record: KmRecord }
  | { kind: "job"; date: Date; job: Jobs };

const STATUS_COLOR: Record<
  JobStatus,
  "warning" | "success" | "primary" | "secondary" | "default"
> = {
  [JobStatus.PENDING]: "default",
  [JobStatus.IN_PROGRESS]: "primary",
  [JobStatus.COMPLETED]: "success",
  [JobStatus.DELIVERED]: "secondary",
};

interface CarTimelineProps {
  car: Cars;
}

const CarTimeline: React.FC<CarTimelineProps> = ({ car }) => {
  const events = React.useMemo<TimelineEvent[]>(() => {
    const kmEvents: TimelineEvent[] = (car.kmHistory ?? []).map((r) => ({
      kind: "km",
      date: new Date(r.date),
      record: r,
    }));

    const jobEvents: TimelineEvent[] = (car.jobs ?? []).map((j) => ({
      kind: "job",
      date: new Date((j.updatedAt ?? j.createdAt) as string),
      job: j,
    }));

    return [...kmEvents, ...jobEvents].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [car]);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-foreground-500">
        <MdBuild size={32} />
        <p className="text-sm">Sin registros históricos para este vehículo</p>
      </div>
    );
  }

  return (
    <ol className="relative border-l border-foreground-600 ml-4 flex flex-col gap-6 py-2">
      {events.map((ev, i) => (
        <li key={i} className="ml-6">
          {/* Dot */}
          <span
            className={`absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full ring-4 ring-foreground-800 ${
              ev.kind === "km" ? "bg-primary-700" : "bg-foreground-600"
            }`}
          >
            {ev.kind === "km" ? (
              <MdSpeed size={14} className="text-primary-200" />
            ) : (
              <MdBuild size={14} className="text-foreground-300" />
            )}
          </span>

          {/* Date label */}
          <time className="text-xs text-foreground-500 mb-1 block">
            {formatDate(ev.date)}
          </time>

          {ev.kind === "km" && (
            <div className="p-3 bg-foreground-700 rounded-lg border border-foreground-600">
              <p className="text-sm font-medium text-white">
                Kilometraje actualizado
              </p>
              <p className="text-primary-400 font-bold text-lg">
                {ev.record.km.toLocaleString("es-AR")} km
              </p>
            </div>
          )}

          {ev.kind === "job" && (
            <div className="p-3 bg-foreground-700 rounded-lg border border-foreground-600 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-white line-clamp-2">
                  {ev.job.description}
                </p>
                <Chip
                  size="sm"
                  color={STATUS_COLOR[ev.job.status]}
                  variant="flat"
                  className="flex-shrink-0"
                >
                  {STATUS_LABELS[ev.job.status]}
                </Chip>
              </div>
              <div className="flex items-center gap-3 text-xs text-foreground-400">
                <span className="font-semibold text-white">
                  {formatARS(ev.job.price)}
                </span>
                {ev.job.isThirdParty && (
                  <Chip size="sm" color="secondary" variant="flat">
                    Terceros
                  </Chip>
                )}
                {(ev.job.parts?.length ?? 0) > 0 && (
                  <span>
                    {ev.job.parts!.length}{" "}
                    {ev.job.parts!.length === 1 ? "repuesto" : "repuestos"}
                  </span>
                )}
              </div>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
};

export default CarTimeline;
