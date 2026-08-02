import React from "react";
import { Clients } from "../../Types/types";
import { TableColumnDef } from "../../Types/tableTypes";
import {
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tooltip,
} from "@heroui/react";
import { IoMdEye } from "react-icons/io";
import { MdDelete, MdToggleOn, MdToggleOff } from "react-icons/md";
import LicenceTable from "../Licenses/LicenceTable";
import { HiArrowUp } from "react-icons/hi";
import { useNavigate } from "react-router-dom";
import TableLoadingContent from "../TableLoadingContent";
import TablePagination from "../TablePagination";

interface ClientTableProps {
  /** Items de la página actual (ya paginados y ordenados en el servidor). */
  clients: Clients[];
  isLoading: boolean;
  emptyContent: React.ReactNode;
  onToggleActive?: (id: string, name: string, isActive: boolean) => void;
  onDelete?: (id: string, name: string) => void;
  // Paginación controlada por el padre (server-side)
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  // Orden controlado por el padre (server-side)
  sortBy: string | null;
  sortDir: "asc" | "desc";
  onSortChange: (columnKey: string) => void;
}

const ClientTable: React.FC<ClientTableProps> = ({
  clients,
  isLoading,
  emptyContent,
  onToggleActive,
  onDelete,
  page,
  pageSize,
  total,
  onPageChange,
  sortBy,
  sortDir,
  onSortChange,
}) => {
  const navigate = useNavigate();

  const showActions = !!onToggleActive || !!onDelete;

  const columns: TableColumnDef<Clients>[] = [
    { key: "fullname", label: "Nombre",    width: 200, sortable: true },
    { key: "phone",    label: "Teléfono",  width: 150, center: true },
    { key: "email",    label: "Correo",    width: 200, center: true },
    { key: "address",  label: "Dirección", width: 150 },
    { key: "city",     label: "Ciudad",    width: 150, center: true },
    { key: "cars",     label: "Vehículos", width: 150, center: true },
    { key: "isActive", label: "Estado",    width: 100, center: true },
    ...(showActions
      ? [{ key: "actions" as const, label: "Acciones", width: 120, center: true }]
      : []),
  ];

  return (
    <div className="bg-foreground-700 rounded-lg flex flex-col gap-4">
      <Table
        classNames={{
          wrapper: "relative min-h-[250px] bg-foreground-700",
          emptyWrapper:
            "absolute inset-0 flex items-center justify-center z-10 h-full bg-foreground-700",
        }}
        aria-label="Tabla de clientes"
      >
        <TableHeader>
          {columns.map((column, i) => (
            <TableColumn
              key={column.key}
              className={`${column.center ? "text-center" : ""} bg-primary-800 ${
                i !== columns.length - 1 ? "border-r-2" : ""
              } border-foreground-700 shadow shadow-primary-600 text-white text-lg`}
              style={{
                width: column.width,
                minWidth: column.width,
                maxWidth: column.width,
              }}
            >
              <div
                className={
                  column.sortable ? "flex justify-between items-center" : ""
                }
              >
                {column.label}
                {column.sortable && (
                  <Tooltip content="Ordenar" placement="bottom" showArrow>
                    <Button
                      onPress={() => onSortChange(column.key)}
                      isIconOnly
                      size="sm"
                      className="bg-transparent"
                    >
                      <HiArrowUp
                        size={20}
                        className={`transition-all duration-200 ${
                          sortBy === column.key ? "text-white" : "text-white/30"
                        } ${
                          sortBy === column.key && sortDir === "desc"
                            ? "rotate-180"
                            : ""
                        }`}
                      />
                    </Button>
                  </Tooltip>
                )}
              </div>
            </TableColumn>
          ))}
        </TableHeader>
        <TableBody
          isLoading={isLoading}
          loadingContent={<TableLoadingContent />}
          className="bg-foreground-800 w-full"
          emptyContent={emptyContent}
        >
          {clients.map((client, i) => (
            <TableRow
              key={client.id}
              className={`rounded-lg h-10 shadow-sm ${
                i % 2 === 0 ? "bg-foreground-300" : "bg-foreground-200"
              } ${!client.isActive ? "opacity-60" : ""}`}
            >
              <TableCell
                className={`${i !== clients.length - 1 ? "border-b-2" : ""} border-r-2 border-foreground-700`}
                style={{ borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }}
              >
                {client.fullname}
              </TableCell>
              <TableCell
                className={`${i !== clients.length - 1 ? "border-b-2" : ""} border-r-2 border-foreground-700 text-center`}
              >
                {client.phone}
              </TableCell>
              <TableCell
                className={`${i !== clients.length - 1 ? "border-b-2" : ""} border-r-2 border-foreground-700 text-center`}
              >
                {client.email || "---"}
              </TableCell>
              <TableCell
                className={`${i !== clients.length - 1 ? "border-b-2" : ""} border-r-2 border-foreground-700`}
              >
                {client.address}
              </TableCell>
              <TableCell
                className={`${i !== clients.length - 1 ? "border-b-2" : ""} border-r-2 border-foreground-700 text-center`}
              >
                {client.city}
              </TableCell>
              <TableCell
                className={`${i !== clients.length - 1 ? "border-b-2" : ""} border-r-2 border-foreground-700`}
              >
                {client.cars && client.cars.length > 0 ? (
                  client.cars.length > 1 ? (
                    <span className="text-center block">
                      {client.cars.length}
                    </span>
                  ) : (
                    <div className="flex justify-center items-center">
                      <LicenceTable
                        licence={client.cars[0].licensePlate}
                        dialog
                      />
                    </div>
                  )
                ) : (
                  <span className="text-center block text-foreground-500 text-xs">
                    Sin vehículos
                  </span>
                )}
              </TableCell>
              <TableCell
                className={`${i !== clients.length - 1 ? "border-b-2" : ""} border-r-2 border-foreground-700 text-center`}
              >
                <Chip
                  size="sm"
                  color={client.isActive ? "success" : "danger"}
                >
                  {client.isActive ? "Activo" : "Inactivo"}
                </Chip>
              </TableCell>
              <TableCell
                className={`${i !== clients.length - 1 ? "border-b-2" : ""} border-foreground-700 text-center`}
                style={{ borderTopRightRadius: 8, borderBottomRightRadius: 8 }}
              >
                {showActions && (
                  <div className="flex justify-center gap-1">
                    <Tooltip content="Ver detalle" color="primary" showArrow>
                      <Button
                        isIconOnly
                        size="sm"
                        className="bg-transparent"
                        onPress={() =>
                          navigate(
                            `/clients/${encodeURIComponent(client.fullname)}`,
                          )
                        }
                      >
                        <IoMdEye size={22} className="text-primary-600" />
                      </Button>
                    </Tooltip>
                    {onToggleActive && (
                      <Tooltip
                        content={client.isActive ? "Desactivar" : "Activar"}
                        color={client.isActive ? "warning" : "success"}
                        showArrow
                      >
                        <Button
                          isIconOnly
                          size="sm"
                          className="bg-transparent"
                          onPress={() =>
                            onToggleActive(
                              client.id,
                              client.fullname,
                              client.isActive,
                            )
                          }
                        >
                          {client.isActive ? (
                            <MdToggleOn
                              size={22}
                              className="text-warning-500"
                            />
                          ) : (
                            <MdToggleOff
                              size={22}
                              className="text-success-500"
                            />
                          )}
                        </Button>
                      </Tooltip>
                    )}
                    {onDelete && (
                      <Tooltip content="Eliminar" color="danger" showArrow>
                        <Button
                          isIconOnly
                          size="sm"
                          className="bg-transparent"
                          onPress={() => onDelete(client.id, client.fullname)}
                        >
                          <MdDelete size={22} className="text-danger-600" />
                        </Button>
                      </Tooltip>
                    )}
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
      />
    </div>
  );
};

export default ClientTable;
