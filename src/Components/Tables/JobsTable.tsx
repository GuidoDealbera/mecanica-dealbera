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
    textColor: 'text-warning' | 'text-success' | 'text-primary' | 'text-secondary' | 'text-default';
  }
> = {
  [JobStatus.IN_PROGRESS]: { label: "En progreso", color: "primary", textColor: "text-primary" },
  [JobStatus.COMPLETED]: { label: "Completado", color: "success", textColor: "text-success" },
  [JobStatus.DELIVERED]: { label: "Entregado", color: "secondary", textColor: "text-secondary" },
  [JobStatus.PENDING]: {label: "Sin comenzar", color: "default", textColor: "text-default"}
};

const JobsTable: React.FC<JobsProps> = ({
  jobs: jobsProp,
  isLoading,
  noRowsLabel,
  onEditJob,
  onQuickStatusChange,
  isUpdating,
}) => {
  const jobs = React.useMemo(() => jobsProp ?? [], [jobsProp])

  const [page, setPage] = React.useState<number>(1);
  const rowsPerPage = 5;
  const paginatedJobs = React.useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return jobs.slice(start, start + rowsPerPage);
  }, [jobs, page, rowsPerPage]);

  // Los trabajos se paginan en el cliente (vienen embebidos en el auto), así
  // que si la lista se achica —se filtró o se borró un trabajo— la página
  // actual puede quedar fuera de rango. Retrocede a la última válida.
  React.useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(jobs.length / rowsPerPage));
    if (page > lastPage) setPage(lastPage);
  }, [jobs.length, page, rowsPerPage]);
  const columns: TableColumnDef<Jobs>[] = [
    { key: "description",  label: "Descripción", width: 300 },
    { key: "status",       label: "Estado",      width: 120, center: true },
    { key: "isThirdParty", label: "Terceros",    width: 100, center: true },
    { key: "parts",        label: "Repuestos",   width: 150, center: true },
    { key: "price",        label: "Precio",      width: 120, center: true },
    ...(onEditJob
      ? [{ key: "actions" as const, label: "Acciones", center: true, width: 100 }]
      : []),
  ];
  return (
    <div className="bg-foreground-700 rounded-lg flex flex-col gap-4">
      <Table
        aria-label="Tabla de trabajos"
        classNames={{
          wrapper: "relative min-h-[250px] bg-foreground-700", // altura mínima definida
          emptyWrapper:
            "absolute inset-0 flex items-center justify-center z-10 h-full bg-foreground-700",
        }}
      >
        <TableHeader>
          {columns.map((col, i) => (
            <TableColumn
              className={`${col.center ? "text-center" : ""} bg-primary-800 ${
                i !== columns.length - 1 && "border-r-2"
              } border-foreground-700 shadow shadow-primary-600 text-white text-lg`}
              key={col.key}
              style={{
                width: col.width,
                minWidth: col.width,
                maxWidth: col.width,
              }}
            >
              {col.label}
            </TableColumn>
          ))}
        </TableHeader>
        <TableBody
          isLoading={isLoading}
          loadingContent={<TableLoadingContent />}
          className="bg-foreground-800 w-full"
          emptyContent={<span>{noRowsLabel}</span>}
        >
          {paginatedJobs.map((job) => {
            const statusInfo = STATUS_MAP[job.status] ?? {
              label: job.status,
              color: "default" as const,
              textColor: "text-default" as const
            };
            
            return (
              <TableRow key={job.id} className="text-white">
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
                          if (next !== job.status) onQuickStatusChange(job, next);
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
                    className={job.isThirdParty ? "text-secondary" : "text-default"}
                  >
                    {job.isThirdParty ? "Sí" : "No"}
                  </Chip>
                </TableCell>
                <TableCell className="text-center">
                  {(job.parts?.length ?? 0) > 0 ? (
                    <Chip color="primary" variant="flat" className="text-primary">
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
        total={jobs.length}
        onPageChange={setPage}
      />
    </div>
  );
};

export default JobsTable;
