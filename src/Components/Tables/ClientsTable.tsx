import React from "react";
import { Client } from "../../Types/types";
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
import LicenceTable from "../Licenses/LicenceTable";
import { MdEdit } from "react-icons/md";
import { HiArrowUp } from "react-icons/hi";

interface ClientTableProps {
  clients: Client[];
  isLoading: boolean;
  noRowsLabel: string;
}

const ClientTable: React.FC<ClientTableProps> = ({
  clients,
  isLoading,
  noRowsLabel,
}) => {
  const [page, setPage] = React.useState<number>(1);
  const [sortMode, setSortMode] = React.useState<"asc" | "desc" | null>(null);

  const rowsPerPage = 5;

  const sortedClients = React.useMemo(() => {
    if (!sortMode) return clients;

    const sorted = [...clients].sort((a, b) => {
      if (sortMode === "asc") {
        return a.fullname.localeCompare(b.fullname);
      } else {
        return b.fullname.localeCompare(a.fullname);
      }
    });

    return sorted;
  }, [clients, sortMode]);

  const pages = Math.ceil(sortedClients.length / rowsPerPage);

  const clientsToShow = React.useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;

    return sortedClients.slice(start, end);
  }, [page, sortedClients]);

  const handleSort = () => {
    if (sortMode === null) {
      setSortMode("asc");
    } else if (sortMode === "asc") {
      setSortMode("desc");
    } else {
      setSortMode(null);
    }
  };
  const columns = [
    {
      key: "fullname",
      label: "Nombre",
      width: 200,
      center: false,
      sortable: true,
    },
    {
      key: "phone",
      label: "Teléfono",
      width: 150,
      center: true,
      sortable: false,
    },
    {
      key: "email",
      label: "Correo Electrónico",
      width: 200,
      center: true,
      sortable: false,
    },
    {
      key: "address",
      label: "Dirección",
      width: 200,
      center: false,
      sortable: false,
    },
    { key: "city", label: "Ciudad", width: 150, center: true, sortable: false },
    {
      key: "cars",
      label: "Vehículos",
      width: 180,
      center: true,
      sortable: false,
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
    <div className="bg-white rounded-lg flex flex-col gap-4">
      <Table
        classNames={{
          wrapper: "relative min-h-[250px]", // altura mínima definida
          emptyWrapper:
            "absolute inset-0 flex items-center justify-center z-10 h-full",
        }}
        aria-label="Tabla de clientes"
      >
        <TableHeader>
          {columns.map((column, i) => (
            <TableColumn
              className={`${column.center ? "text-center" : ""} bg-primary ${
                i !== columns.length - 1 && "border-r-2"
              } border-white shadow shadow-primary text-white text-lg`}
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
                      onPress={handleSort}
                      isIconOnly
                      size="sm"
                      className="bg-transparent"
                    >
                      <HiArrowUp
                        size={20}
                        className={`transition-all duration-200 ${
                          sortMode ? "text-white" : "text-white/30"
                        } ${sortMode === "desc" ? "rotate-180" : ""}`}
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
          {clientsToShow.map((client, i) => (
            <TableRow
              key={client.id}
              className={`rounded-lg h-10 shadow-sm ${
                i % 2 === 0 ? "bg-foreground-300" : "bg-foreground-200"
              }`}
            >
              <TableCell
                className={`${
                  i !== clientsToShow.length - 1 && "border-b-2"
                } border-r-2 border-white`}
                style={{
                  borderTopLeftRadius: 8,
                  borderBottomLeftRadius: 8,
                }}
              >
                {client.fullname}
              </TableCell>
              <TableCell
                className={`${
                  i !== clientsToShow.length - 1 && "border-b-2"
                } border-r-2 border-white text-center`}
              >
                {client.phone}
              </TableCell>
              <TableCell
                className={`${
                  i !== clientsToShow.length - 1 && "border-b-2"
                } text-center border-r-2 border-white`}
              >
                {client.email ? client.email : "---"}
              </TableCell>
              <TableCell
                className={`${
                  i !== clientsToShow.length - 1 && "border-b-2"
                } border-r-2 border-white`}
              >
                {client.address}
              </TableCell>
              <TableCell
                className={`${
                  i !== clientsToShow.length - 1 && "border-b-2"
                } border-r-2 border-white text-center`}
              >
                {client.city}
              </TableCell>
              <TableCell
                className={`${
                  i !== clientsToShow.length - 1 && "border-b-2"
                } border-r-2 border-white`}
              >
                {client.cars ? (
                  client.cars?.length > 1 ? (
                    client.cars.length
                  ) : (
                    <div className="flex justify-center items-center">
                      <LicenceTable
                        licence={client.cars[0].licensePlate}
                        dialog
                      />
                    </div>
                  )
                ) : (
                  "---"
                )}
              </TableCell>
              <TableCell
                className={`${
                  i !== clientsToShow.length - 1 && "border-b-2"
                } border-white text-center`}
                style={{
                  borderTopRightRadius: 8,
                  borderBottomRightRadius: 8,
                }}
              >
                <div>
                  <Tooltip content="Editar" color="foreground">
                    <Button isIconOnly size="sm" className="bg-transparent">
                      <MdEdit size={25} className="text-foreground" />
                    </Button>
                  </Tooltip>
                  <Tooltip content="Detalle" color="primary">
                    <Button isIconOnly size="sm" className="bg-transparent">
                      <IoMdEye size={25} className="text-primary-600" />
                    </Button>
                  </Tooltip>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {clients.length > 4 && (
        <div className="flex justify-end items-center p-3 gap-4">
          <span>
            Mostrando {(page - 1) * rowsPerPage + 1} -{" "}
            {Math.min(page * rowsPerPage, clients.length)} de {clients.length}{" "}
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

export default ClientTable;
