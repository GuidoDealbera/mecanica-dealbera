import React from "react";
import { Jobs } from "../../Types/types";
import {
  Chip,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { JobStatus } from "../../Types/apiTypes";
interface JobsProps {
  jobs: Jobs[];
  isLoading: boolean;
  noRowsLabel: string;
  onEditJob?: (job: Jobs) => void;
}

const STATUS_MAP: Record<
  JobStatus,
  {
    label: string;
    color: "warning" | "success" | "primary" | "secondary" | "default";
  }
> = {
  [JobStatus.IN_PROGRESS]: { label: "En Progreso", color: "primary" },
  [JobStatus.COMPLETED]: { label: "Completado", color: "success" },
  [JobStatus.DELIVERED]: { label: "Entregado", color: "secondary" },
};

const formatJobDate = (date?: string | Date | null): string => {
  if (!date) return "---";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "---";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(price);
};

const JobsTable: React.FC<JobsProps> = ({
  jobs,
  isLoading,
  noRowsLabel,
  onEditJob,
}) => {
  const [page, setPage] = React.useState<number>(1);
  const rowsPerPage = 5;
  const pages = Math.ceil(jobs.length / rowsPerPage);
  const paginatedJobs = React.useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return jobs.slice(start, start + rowsPerPage);
  }, [jobs, page, rowsPerPage]);
  const columns = [
    {
      key: "description",
      label: "Descripción",
      center: false,
      width: 350,
    },
    {
      key: "status",
      label: "Estado",
      center: true,
      width: 120,
    },
    {
      key: "isThirdParty",
      label: "Terceros",
      center: true,
      width: 100,
    },
    {
      key: "price",
      label: "Precio",
      center: true,
      width: 120,
    },
    {
      key: "createdAt",
      label: "Fecha de creación",
      center: true,
      width: 150,
    },
    {
      key: "updatedAt",
      label: "Última actualización",
      center: true,
      width: 150,
    },
    ...(onEditJob
      ? [{ key: "actions", label: "Acciones", center: true, width: 80 }]
      : []),
  ];
  return (
    <div className="bg-white rounded-lg flex flex-col gap-4">
      <Table
        aria-label="Tabla de trabajos"
        classNames={{
          wrapper: "relative min-h-[250px]", // altura mínima definida
          emptyWrapper:
            "absolute inset-0 flex items-center justify-center z-10 h-full",
        }}
      >
        <TableHeader>
          {columns.map((col, i) => (
            <TableColumn
              className={`${col.center ? "text-center" : ""} bg-primary ${
                i !== columns.length - 1 && "border-r-2"
              } border-white shadow shadow-primary text-white text-lg`}
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
          className="bg-foreground-800 w-full"
          emptyContent={
            <div className="fixed">
              <span>{noRowsLabel}</span>
            </div>
          }
        >
          {paginatedJobs.map((job) => {
            const statusInfo = STATUS_MAP[job.status] ?? {
              label: job.status,
              color: "default" as const,
            };
            return (
              <TableRow key={job.id}>
                <TableCell
                  className="max-w-[300px] truncate"
                  title={job.description}
                >
                  {job.description}
                </TableCell>
                <TableCell className="text-center">
                  <Chip color={statusInfo.color} variant="flat">
                    {statusInfo.label}
                  </Chip>
                </TableCell>
                <TableCell className="text-center">
                  <Chip
                    color={job.isThirdParty ? "secondary" : "default"}
                    variant="flat"
                  >
                    {job.isThirdParty ? "Sí" : "No"}
                  </Chip>
                </TableCell>
                <TableCell className="text-center font-medium">
                  {formatPrice(job.price)}
                </TableCell>
                <TableCell className="text-center text-sm">
                  {formatJobDate(job.createdAt)}
                </TableCell>
                <TableCell className="text-center text-sm">
                  {formatJobDate(job.updatedAt)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {jobs.length > 4 && (
        <div className="flex justify-end items-center p-3 gap-4">
          <span>
            Mostrando {(page - 1) * rowsPerPage + 1} -{" "}
            {Math.min(page * rowsPerPage, jobs.length)} de {jobs.length}{" "}
            registros
          </span>
          <Pagination
            showControls
            showShadow
            page={page}
            total={pages}
            onChange={(page) => setPage(page)}
            className=""
          />
        </div>
      )}
    </div>
  );
};

export default JobsTable;
