/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Cars } from "../../Types/types";
import {
  Button,
  Pagination,
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

interface CarsTableProps {
  cars: Cars[];
  isLoading: boolean;
  noRowsLabel: string;
  deleteCar: (licence: string) => void;
}

const CarsTable: React.FC<CarsTableProps> = ({
  cars,
  isLoading,
  noRowsLabel,
  deleteCar,
}) => {
  const navigate = useNavigate();
  const [page, setPage] = React.useState<number>(1);
  const [sortColumn, setSortColumn] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
    "asc"
  );

  const rowsPerPage = 5;

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortColumn(null);
        setSortDirection("asc");
      }
    } else {
      setSortColumn(columnKey);
      setSortDirection("asc");
    }
  };

  const sortedCars = React.useMemo(() => {
    if (!sortColumn) return [...cars];

    return [...cars].sort((a, b) => {
      const valueA = (a as any)[sortColumn];
      const valueB = (b as any)[sortColumn];

      if (valueA == null) return 1;
      if (valueB == null) return -1;

      if (typeof valueA === "number" && typeof valueB === "number") {
        return sortDirection === "asc" ? valueA - valueB : valueB - valueA;
      }

      return sortDirection === "asc"
        ? String(valueA).localeCompare(String(valueB))
        : String(valueB).localeCompare(String(valueA));
    });
  }, [cars, sortColumn, sortDirection]);

  const pages = Math.ceil(cars.length / rowsPerPage);

  const carsToShow = React.useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;

    return sortedCars.slice(start, end);
  }, [page, sortedCars]);

  const columns = [
    {
      key: "licensePlate",
      label: "Patente",
      width: 180,
      center: false,
      sortable: true,
    },
    { key: "brand", label: "Marca", width: 150, center: true, sortable: false },
    {
      key: "model",
      label: "Modelo",
      width: 200,
      center: false,
      sortable: false,
    },
    { key: "year", label: "Año", width: 100, center: false, sortable: true },
    {
      key: "kilometers",
      label: "Kilometraje",
      width: 170,
      center: false,
      sortable: true,
    },
    {
      key: "owner",
      label: "Dueño",
      width: 200,
      center: false,
      sortable: true,
    },
    {
      key: "actions",
      label: "Acciones",
      width: 100,
      center: true,
      sortable: false,
    },
  ];
  return (
    <div className="bg-foreground-700 rounded-lg flex flex-col gap-4">
      <Table
        aria-label="Tabla de vehículos"
        classNames={{
          wrapper: "relative min-h-[250px] bg-foreground-700", // altura mínima definida
          emptyWrapper:
            "absolute inset-0 flex items-center justify-center z-10 h-full",
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
                  <Tooltip content="Ordenar" placement="bottom">
                    <Button
                      onPress={() => handleSort(column.key)}
                      isIconOnly
                      size="sm"
                      className="bg-transparent"
                    >
                      <HiArrowUp
                        size={20}
                        className={`transition-all duration-200 ${
                          sortColumn === column.key && sortDirection
                            ? "text-white"
                            : "text-white/30"
                        } ${
                          sortColumn === column.key && sortDirection === "desc"
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
          className="bg-foreground-800 w-full"
          emptyContent={
            <div className="fixed">
              <span>{noRowsLabel}</span>
            </div>
          }
        >
          {carsToShow.map((car, i) => (
            <TableRow
              key={car.id}
              className={`rounded-lg h-10 shadow-sm ${
                i % 2 === 0 ? "bg-foreground-300" : "bg-foreground-200"
              }`}
            >
              <TableCell
                className={`${
                  i !== carsToShow.length - 1 && "border-b-2"
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
                  i !== carsToShow.length - 1 && "border-b-2"
                } border-r-2 border-foreground-700 text-center`}
              >
                {car.brand}
              </TableCell>
              <TableCell
                className={`${
                  i !== carsToShow.length - 1 && "border-b-2"
                } border-r-2 border-foreground-700`}
              >
                {car.model}
              </TableCell>
              <TableCell
                className={`${
                  i !== carsToShow.length - 1 && "border-b-2"
                } border-r-2 border-foreground-700 text-center`}
              >
                {car.year}
              </TableCell>
              <TableCell
                className={`${
                  i !== carsToShow.length - 1 && "border-b-2"
                } border-r-2 border-foreground-700 text-center`}
              >
                {car.kilometers.toLocaleString("es-AR")} km
              </TableCell>
              <TableCell
                className={`${
                  i !== carsToShow.length - 1 && "border-b-2"
                } border-r-2 border-foreground-700`}
              >
                {car.owner.fullname}
              </TableCell>
              <TableCell
                className={`${
                  i !== carsToShow.length - 1 && "border-b-2"
                } border-foreground-700 text-center`}
                style={{
                  borderTopRightRadius: 8,
                  borderBottomRightRadius: 8,
                }}
              >
                <div className="flex justify-center gap-2">
                  <Tooltip content="Detalle" color="primary">
                    <Button
                      isIconOnly
                      size="sm"
                      className="bg-transparent"
                      onPress={() => navigate(`/cars/${car.licensePlate}`)}
                    >
                      <IoMdEye size={25} className="text-primary-600" />
                    </Button>
                  </Tooltip>
                  <Tooltip content="Eliminar" color="danger">
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
      {cars.length > 4 && (
        <div className="flex justify-end items-center p-3 gap-4">
          <span>
            Mostrando {(page - 1) * rowsPerPage + 1} -{" "}
            {Math.min(page * rowsPerPage, cars.length)} de {cars.length}{" "}
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

export default CarsTable;
