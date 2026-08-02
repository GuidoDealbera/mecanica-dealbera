import React from "react";
import { Cars } from "../../Types/types";
import { TableColumnDef } from "../../Types/tableTypes";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tooltip,
} from "@heroui/react";
import { IoMdEye } from "react-icons/io";
import { MdDelete } from "react-icons/md";
import LicenceTable from "../Licenses/LicenceTable";
import { HiArrowUp } from "react-icons/hi";
import { useNavigate } from "react-router-dom";
import TableLoadingContent from "../TableLoadingContent";
import TablePagination from "../TablePagination";

interface CarsTableProps {
  /** Items de la página actual (ya paginados y ordenados en el servidor). */
  cars: Cars[];
  isLoading: boolean;
  emptyContent: React.ReactNode;
  deleteCar: (licence: string) => void;
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

const CarsTable: React.FC<CarsTableProps> = ({
  cars,
  isLoading,
  emptyContent,
  deleteCar,
  page,
  pageSize,
  total,
  onPageChange,
  sortBy,
  sortDir,
  onSortChange,
}) => {
  const navigate = useNavigate();

  const columns: TableColumnDef<Cars>[] = [
    { key: "licensePlate", label: "Patente",     width: 180, sortable: true },
    { key: "brand",        label: "Marca",       width: 150, center: true },
    { key: "model",        label: "Modelo",      width: 200 },
    { key: "year",         label: "Año",         width: 100, sortable: true },
    { key: "kilometers",   label: "Kilometraje", width: 170, sortable: true },
    { key: "owner",        label: "Dueño",       width: 200, sortable: true },
    { key: "actions",      label: "Acciones",    width: 100, center: true },
  ];
  return (
    <div className="bg-foreground-700 rounded-lg flex flex-col gap-4">
      <Table
        aria-label="Tabla de vehículos"
        classNames={{
          wrapper: "relative min-h-[250px] bg-foreground-700", // altura mínima definida
          emptyWrapper:
            "absolute inset-0 flex items-center justify-center z-10 h-full bg-foreground-700",
        }}
      >
        <TableHeader>
          {columns.map((column, i) => (
            <TableColumn
              className={`${column.center ? "text-center" : ""} bg-primary-800 ${
                i !== columns.length - 1 && "border-r-2"
              } border-foreground-700 shadow shadow-primary-600 text-white text-lg`}
              key={column.key}
              style={{
                width: column.width,
                minWidth: column.width,
                maxWidth: column.width,
              }}
            >
              <div
                className={`${
                  column.sortable ? "flex justify-between items-center" : ""
                }`}
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
                          sortBy === column.key
                            ? "text-white"
                            : "text-white/30"
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
          {cars.map((car, i) => (
            <TableRow
              key={car.id}
              className={`rounded-lg h-10 shadow-sm ${
                i % 2 === 0 ? "bg-foreground-300" : "bg-foreground-200"
              }`}
            >
              <TableCell
                className={`${
                  i !== cars.length - 1 && "border-b-2"
                } border-r-2 border-foreground-700`}
                style={{
                  borderTopLeftRadius: 8,
                  borderBottomLeftRadius: 8,
                }}
              >
                <div className="flex justify-center items-center">
                  <LicenceTable licence={car.licensePlate} dialog />
                </div>
              </TableCell>
              <TableCell
                className={`${
                  i !== cars.length - 1 && "border-b-2"
                } border-r-2 border-foreground-700 text-center`}
              >
                {car.brand}
              </TableCell>
              <TableCell
                className={`${
                  i !== cars.length - 1 && "border-b-2"
                } border-r-2 border-foreground-700`}
              >
                {car.model}
              </TableCell>
              <TableCell
                className={`${
                  i !== cars.length - 1 && "border-b-2"
                } border-r-2 border-foreground-700 text-center`}
              >
                {car.year}
              </TableCell>
              <TableCell
                className={`${
                  i !== cars.length - 1 && "border-b-2"
                } border-r-2 border-foreground-700 text-center`}
              >
                {car.kilometers.toLocaleString("es-AR")} km
              </TableCell>
              <TableCell
                className={`${
                  i !== cars.length - 1 && "border-b-2"
                } border-r-2 border-foreground-700`}
              >
                {car.owner.fullname}
              </TableCell>
              <TableCell
                className={`${
                  i !== cars.length - 1 && "border-b-2"
                } border-foreground-700 text-center`}
                style={{
                  borderTopRightRadius: 8,
                  borderBottomRightRadius: 8,
                }}
              >
                <div className="flex justify-center gap-2">
                  <Tooltip content="Detalle" color="primary" showArrow>
                    <Button
                      isIconOnly
                      size="sm"
                      className="bg-transparent"
                      onPress={() => navigate(`/cars/${car.licensePlate}`)}
                    >
                      <IoMdEye size={25} className="text-primary-600" />
                    </Button>
                  </Tooltip>
                  <Tooltip content="Eliminar" color="danger" showArrow>
                    <Button
                      onPress={() => deleteCar(car.licensePlate)}
                      isIconOnly
                      size="sm"
                      className="bg-transparent"
                    >
                      <MdDelete size={25} className="text-danger-600" />
                    </Button>
                  </Tooltip>
                </div>
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

export default CarsTable;
