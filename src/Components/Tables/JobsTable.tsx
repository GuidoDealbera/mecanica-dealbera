import React from "react";
import { Jobs } from "../../Types/types";
import {
    Pagination,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
interface JobsProps {
  jobs: Jobs[];
  isLoading: boolean;
  noRowsLabel: string;
}

const JobsTable: React.FC<JobsProps> = ({ jobs, isLoading, noRowsLabel }) => {
    const [page, setPage] = React.useState<number>(1);
    const rowsPerPage = 5;
    const pages = Math.ceil(jobs.length / rowsPerPage);
  const columns = [
    {
      key: "description",
      label: "Descripción",
      center: false,
      width: 350
    },
    {
      key: "status",
      label: "Estado",
      center: true,
      width: 120
    },
    {
      key: "isThirdParty",
      label: "Terceros",
      center: true,
      width: 100
    },
    {
      key: "price",
      label: "Precio",
      center: true,
      width: 120
    },
    {
      key: "createdAt",
      label: "Fecha de creación",
      center: true,
      width: 200
    },
    {
      key: "updatedAt",
      label: "Última actualización",
      center: true,
      width: 200
    },
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
          {jobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell>{job.description}</TableCell>
              <TableCell>{job.status}</TableCell>
              <TableCell>{job.isThirdParty}</TableCell>
              <TableCell>{job.price}</TableCell>
              <TableCell>{job.createdAt}</TableCell>
              <TableCell>{job.updatedAt}</TableCell>
            </TableRow>
          ))}
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
