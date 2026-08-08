import React from "react";
import { Jobs } from "../../Types/types";
import { TableColumnDef } from "../../Types/tableTypes";
import {
  Button,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tooltip,
} from "@heroui/react";
import { JobStatus } from "../../Types/apiTypes";
import { MdEdit, MdKeyboardArrowDown, MdStickyNote2 } from "react-icons/md";
import { HiArrowUp } from "react-icons/hi";
import { formatARS } from "../../Utils/utils";
import TableLoadingContent from "../TableLoadingContent";
import TablePagination from "../TablePagination";
interface JobsProps {
  jobs: Jobs[];
  isLoading: boolean;
  noRowsLabel: string;
  onEditJob?: (job: Jobs) => void;
  /** Cambio rápido de estado desde el listado (sin abrir el modal). */
  onQuickStatusChange?: (job: Jobs, status: JobStatus) => void;
  /** Deshabilita las quick-actions mientras hay una actualización en curso. */
  isUpdating?: boolean;
}

const STATUS_MAP: Record<
  JobStatus,
  {
    label: string;
    color: "warning" | "success" | "primary" | "secondary" | "default";
    textColor:
      | "text-warning"
      | "text-success"
      | "text-primary"
      | "text-secondary"
      | "text-default";
  }
> = {
  [JobStatus.IN_PROGRESS]: {
    label: "En progreso",
    color: "primary",
    textColor: "text-primary",
  },
  [JobStatus.COMPLETED]: {
    label: "Completado",
    color: "success",
    textColor: "text-success",
  },
  [JobStatus.DELIVERED]: {
    label: "Entregado",
    color: "secondary",
    textColor: "text-secondary",
  },
  [JobStatus.PENDING]: {
    label: "Sin comenzar",
    color: "default",
    textColor: "text-default",
  },
};

// Orden de "avance" de los estados, para ordenar la columna Estado.
const STATUS_ORDER: Record<JobStatus, number> = {
  [JobStatus.PENDING]: 0,
  [JobStatus.IN_PROGRESS]: 1,
  [JobStatus.COMPLETED]: 2,
  [JobStatus.DELIVERED]: 3,
};

// Opciones del filtro por estado (incluye "Todos").
const STATUS_FILTER_OPTIONS: { key: JobStatus | "all"; label: string }[] = [
  { key: "all", label: "Todos" },
  ...Object.values(JobStatus).map((s) => ({
    key: s,
    label: STATUS_MAP[s].label,
  })),
];

const JobsTable: React.FC<JobsProps> = ({
  jobs: jobsProp,
  isLoading,
  noRowsLabel,
  onEditJob,
  onQuickStatusChange,
  isUpdating,
}) => {
  const jobs = React.useMemo(() => jobsProp ?? [], [jobsProp]);

  const [page, setPage] = React.useState<number>(1);
  const [statusFilter, setStatusFilter] = React.useState<JobStatus | "all">(
    "all"
  );
  const [sort, setSort] = React.useState<{
    by: string | null;
    dir: "asc" | "desc";
  }>({ by: null, dir: "asc" });
  const rowsPerPage = 5;

  // Filtro por estado + orden por columna (client-side, antes de paginar).
  const processedJobs = React.useMemo(() => {
    let result =
      statusFilter === "all"
        ? jobs
        : jobs.filter((j) => j.status === statusFilter);
    if (sort.by) {
      const dir = sort.dir === "asc" ? 1 : -1;
      result = [...result].sort((a, b) => {
        if (sort.by === "price") return (a.price - b.price) * dir;
        if (sort.by === "status")
          return (
            ((STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0)) *
            dir
          );
        return 0;
      });
    }
    return result;
  }, [jobs, statusFilter, sort]);

  const paginatedJobs = React.useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return processedJobs.slice(start, start + rowsPerPage);
  }, [processedJobs, page, rowsPerPage]);

  // Si la lista visible se achica (se filtró o se borró un trabajo), la página
  // actual puede quedar fuera de rango. Retrocede a la última válida.
  React.useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(processedJobs.length / rowsPerPage));
    if (page > lastPage) setPage(lastPage);
  }, [processedJobs.length, page, rowsPerPage]);

  const handleStatusFilter = (value: JobStatus | "all") => {
    setStatusFilter(value);
    setPage(1);
  };

  // Ciclo de orden por columna: asc → desc → sin orden.
  const handleSort = (columnKey: string) => {
    setSort((prev) => {
      if (prev.by !== columnKey) return { by: columnKey, dir: "asc" };
      if (prev.dir === "asc") return { by: columnKey, dir: "desc" };
      return { by: null, dir: "asc" };
    });
    setPage(1);
  };

  const columns: TableColumnDef<Jobs>[] = [
    { key: "description", label: "Descripción", width: 300 },
    {
      key: "status",
      label: "Estado",
      width: 120,
      center: true,
      sortable: true,
    },
    { key: "isThirdParty", label: "Terceros", width: 100, center: true },
    { key: "parts", label: "Repuestos", width: 150, center: true },
    { key: "price", label: "Precio", width: 120, center: true, sortable: true },
    ...(onEditJob
      ? [
          {
            key: "actions" as const,
            label: "Acciones",
            center: true,
            width: 100,
          },
        ]
      : []),
  ];
  return (
    // Isla de tema claro (className light): la tabla se ve como "papel" claro
    // con bordes en ambos temas (HeroUI toma el tema del ancestro con clase light).
    <div className="text-foreground rounded-lg flex flex-col gap-4 border border-divider overflow-hidden">
      <div className="flex items-center gap-3 px-3 pt-3">
        <Select
          label="Filtrar por estado"
          size="sm"
          className="max-w-[220px]"
          selectedKeys={[statusFilter]}
          onSelectionChange={(keys) => {
            const v = Array.from(keys)[0] as JobStatus | "all" | undefined;
            if (v) handleStatusFilter(v);
          }}
        >
          {STATUS_FILTER_OPTIONS.map((o) => (
            <SelectItem key={o.key}>{o.label}</SelectItem>
          ))}
        </Select>
      </div>
      <Table
        aria-label="Tabla de trabajos"
        classNames={{
          wrapper: "relative min-h-[250px] bg-content1", // altura mínima definida
          emptyWrapper:
            "absolute inset-0 flex items-center justify-center z-10 h-full bg-content1",
        }}
      >
        <TableHeader>
          {columns.map((col, i) => (
            <TableColumn
              className={`${col.center ? "text-center" : ""} bg-primary-800 ${
                i !== columns.length - 1 && "border-r-2"
              } border-divider shadow shadow-primary-600 text-white text-lg`}
              key={col.key}
              style={{
                width: col.width,
                minWidth: col.width,
                maxWidth: col.width,
              }}
            >
              {col.sortable ? (
                <div className="flex justify-center items-center gap-1">
                  {col.label}
                  <Tooltip content="Ordenar" placement="bottom" showArrow>
                    <Button
                      onPress={() => handleSort(col.key)}
                      isIconOnly
                      size="sm"
                      className="bg-transparent"
                    >
                      <HiArrowUp
                        size={18}
                        className={`transition-all duration-200 ${
                          sort.by === col.key ? "text-white" : "text-white/30"
                        } ${
                          sort.by === col.key && sort.dir === "desc"
                            ? "rotate-180"
                            : ""
                        }`}
                      />
                    </Button>
                  </Tooltip>
                </div>
              ) : (
                col.label
              )}
            </TableColumn>
          ))}
        </TableHeader>
        <TableBody
          isLoading={isLoading}
          loadingContent={<TableLoadingContent />}
          className="w-full"
          emptyContent={<span>{noRowsLabel}</span>}
        >
          {paginatedJobs.map((job) => {
            const statusInfo = STATUS_MAP[job.status] ?? {
              label: job.status,
              color: "default" as const,
              textColor: "text-default" as const,
            };

            return (
              <TableRow key={job.id} className="text-foreground">
                <TableCell className="max-w-[300px]" title={job.description}>
                  <div className="flex items-center gap-1.5">
                    {job.notes && job.notes.trim() !== "" && (
                      <Tooltip
                        content={
                          <span className="block max-w-xs whitespace-pre-wrap py-1">
                            {job.notes}
                          </span>
                        }
                        color="foreground"
                        placement="top"
                        showArrow
                      >
                        <span className="flex-shrink-0 text-warning-500">
                          <MdStickyNote2 size={16} />
                        </span>
                      </Tooltip>
                    )}
                    <span className="min-w-0 truncate">{job.description}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {onQuickStatusChange ? (
                    <Dropdown>
                      <DropdownTrigger>
                        <button
                          type="button"
                          disabled={isUpdating}
                          className="inline-flex disabled:opacity-60"
                        >
                          <Chip
                            color={statusInfo.color}
                            variant="flat"
                            className={`${statusInfo.textColor} cursor-pointer`}
                            endContent={<MdKeyboardArrowDown size={16} />}
                          >
                            {statusInfo.label}
                          </Chip>
                        </button>
                      </DropdownTrigger>
                      <DropdownMenu
                        aria-label="Cambiar estado del trabajo"
                        disabledKeys={[job.status]}
                        onAction={(key) => {
                          const next = key as JobStatus;
                          if (next !== job.status)
                            onQuickStatusChange(job, next);
                        }}
                      >
                        {Object.values(JobStatus).map((s) => {
                          const info = STATUS_MAP[s];
                          return (
                            <DropdownItem
                              key={s}
                              color={info.color}
                              className={info.textColor}
                            >
                              {info.label}
                            </DropdownItem>
                          );
                        })}
                      </DropdownMenu>
                    </Dropdown>
                  ) : (
                    <Chip
                      color={statusInfo.color}
                      variant="flat"
                      className={statusInfo.textColor}
                    >
                      {statusInfo.label}
                    </Chip>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Chip
                    color={job.isThirdParty ? "secondary" : "default"}
                    variant="flat"
                    className={
                      job.isThirdParty ? "text-secondary" : "text-default"
                    }
                  >
                    {job.isThirdParty ? "Sí" : "No"}
                  </Chip>
                </TableCell>
                <TableCell className="text-center">
                  {(job.parts?.length ?? 0) > 0 ? (
                    <Chip
                      color="primary"
                      variant="flat"
                      className="text-primary"
                    >
                      {job.parts!.length}{" "}
                      {job.parts!.length === 1 ? "repuesto" : "repuestos"}
                    </Chip>
                  ) : (
                    <span className="text-foreground-400">---</span>
                  )}
                </TableCell>
                <TableCell className="text-center font-medium">
                  {formatARS(job.price)}
                </TableCell>
                <TableCell className="text-center">
                  {onEditJob && (
                    <Tooltip content="Editar trabajo" color="primary" showArrow>
                      <Button
                        isIconOnly
                        size="sm"
                        className="bg-transparent"
                        onPress={() => onEditJob(job)}
                      >
                        <MdEdit size={20} className="text-primary-600" />
                      </Button>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <TablePagination
        page={page}
        pageSize={rowsPerPage}
        total={processedJobs.length}
        onPageChange={setPage}
      />
    </div>
  );
};

export default JobsTable;
