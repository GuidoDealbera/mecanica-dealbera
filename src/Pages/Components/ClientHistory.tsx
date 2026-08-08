import React from "react";
import { Button, Chip, Select, SelectItem } from "@heroui/react";
import { MdBuild, MdHistory, MdSpeed } from "react-icons/md";
import { Cars } from "../../Types/types";
import { JobStatus, STATUS_LABELS } from "../../Types/apiTypes";
import { formatARS, formatDate, formatLicence } from "../../Utils/utils";
import { buildTimelineEvents } from "../../Utils/timeline";

const STATUS_COLOR: Record<
  JobStatus,
  "warning" | "success" | "primary" | "secondary" | "default"
> = {
  [JobStatus.PENDING]: "default",
  [JobStatus.IN_PROGRESS]: "primary",
  [JobStatus.COMPLETED]: "success",
  [JobStatus.DELIVERED]: "secondary",
};

/** Cantidad de eventos que se muestran por tanda (el resto con "Ver más"). */
const PAGE_SIZE = 8;

const TYPE_OPTIONS = [
  { key: "all", label: "Todo" },
  { key: "job", label: "Trabajos" },
  { key: "km", label: "Kilometraje" },
];

interface ClientHistoryProps {
  /** Vehículos del cliente (con sus trabajos e historial de kilometraje). */
  cars: Cars[];
}

/**
 * Historial **cruzado** del cliente: mezcla en una sola línea de tiempo los
 * trabajos y las actualizaciones de kilometraje de **todos** sus vehículos, de
 * lo más reciente a lo más antiguo, indicando a qué patente pertenece cada
 * evento. Se arma con los datos que ya trae la ficha del cliente.
 */
const ClientHistory: React.FC<ClientHistoryProps> = ({ cars }) => {
  const [carFilter, setCarFilter] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [visible, setVisible] = React.useState(PAGE_SIZE);

  const events = React.useMemo(() => buildTimelineEvents(cars), [cars]);

  const filtered = React.useMemo(
    () =>
      events.filter(
        (ev) =>
          (carFilter === "all" || ev.car.licensePlate === carFilter) &&
          (typeFilter === "all" || ev.kind === typeFilter)
      ),
    [events, carFilter, typeFilter]
  );

  // Al cambiar un filtro se vuelve a la primera tanda.
  const handleFilter = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setVisible(PAGE_SIZE);
  };

  const shown = filtered.slice(0, visible);
  const remaining = filtered.length - shown.length;

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2 text-foreground-500">
        <MdHistory size={30} />
        <p className="text-sm">Todavía no hay actividad registrada</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros: por vehículo (sólo si tiene más de uno) y por tipo */}
      <div className="flex flex-wrap items-center gap-3">
        {cars.length > 1 && (
          <Select
            label="Vehículo"
            size="sm"
            className="max-w-[200px]"
            selectedKeys={[carFilter]}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as string | undefined;
              if (value) handleFilter(setCarFilter)(value);
            }}
          >
            {[
              <SelectItem key="all">Todos</SelectItem>,
              ...cars.map((car) => (
                <SelectItem key={car.licensePlate}>
                  {formatLicence(car.licensePlate)}
                </SelectItem>
              )),
            ]}
          </Select>
        )}
        <Select
          label="Tipo"
          size="sm"
          className="max-w-[170px]"
          selectedKeys={[typeFilter]}
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0] as string | undefined;
            if (value) handleFilter(setTypeFilter)(value);
          }}
        >
          {TYPE_OPTIONS.map((option) => (
            <SelectItem key={option.key}>{option.label}</SelectItem>
          ))}
        </Select>
        <span className="text-foreground-400 text-xs ml-auto">
          {filtered.length} {filtered.length === 1 ? "evento" : "eventos"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-foreground-400 text-sm py-6 text-center">
          No hay eventos que coincidan con los filtros aplicados.
        </p>
      ) : (
        <ol className="relative border-l border-divider ml-4 flex flex-col gap-5 py-2">
          {shown.map((ev, i) => (
            <li key={`${ev.kind}-${ev.car.id}-${i}`} className="ml-6">
              {/* Punto del timeline */}
              <span
                className={`absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full ring-4 ring-content1 ${
                  ev.kind === "km" ? "bg-primary-700" : "bg-content3"
                }`}
              >
                {ev.kind === "km" ? (
                  <MdSpeed size={14} className="text-primary-200" />
                ) : (
                  <MdBuild size={14} className="text-foreground-300" />
                )}
              </span>

              {/* Fecha + patente: la patente es lo que hace "cruzado" al historial */}
              <div className="flex items-center gap-2 mb-1">
                <time className="text-xs text-foreground-500">
                  {ev.date ? formatDate(ev.date) : "Sin fecha"}
                </time>
                <Chip
                  size="sm"
                  variant="flat"
                  color="primary"
                  className="text-primary h-5"
                >
                  {formatLicence(ev.car.licensePlate)}
                </Chip>
                <span className="text-foreground-400 text-xs truncate">
                  {ev.car.brand} {ev.car.model}
                </span>
              </div>

              {ev.kind === "km" && (
                <div className="p-3 bg-content2 rounded-lg border border-divider">
                  <p className="text-sm font-medium text-foreground">
                    Kilometraje actualizado
                  </p>
                  <p className="text-primary-400 font-bold text-lg">
                    {ev.record.km.toLocaleString("es-AR")} km
                  </p>
                </div>
              )}

              {ev.kind === "job" && (
                <div className="p-3 bg-content2 rounded-lg border border-divider flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground line-clamp-2">
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
                    <span className="font-semibold text-foreground">
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
      )}

      {remaining > 0 && (
        <Button
          size="sm"
          variant="flat"
          className="self-center"
          onPress={() => setVisible((v) => v + PAGE_SIZE)}
        >
          Ver más ({remaining})
        </Button>
      )}
    </div>
  );
};

export default ClientHistory;
