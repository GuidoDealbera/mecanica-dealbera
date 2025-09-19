import { Button } from "@heroui/react";
import React, { useEffect, useMemo, useState } from "react";
import { useClientQueries } from "../Hooks/useClientQueries";
import { HiOutlineRefresh } from "react-icons/hi";
import ClientTable from "../Components/Tables/ClientsTable";
import FilterName from "../Components/SearchBars/FilterName";

const ClientPage: React.FC = () => {
  const [fullnameFilter, setFullnameFilter] = useState<string>("");
  const { allClients, loading, refreshing, getAllClients, refresh } =
    useClientQueries();

  const filteredClients = useMemo(() => {
    if (!fullnameFilter) return allClients;
    return allClients.filter((client) =>
      client.fullname.toLowerCase().includes(fullnameFilter.toLowerCase())
    );
  }, [allClients, fullnameFilter]);
  useEffect(() => {
    getAllClients();
  }, [getAllClients]);

  const isLoading = loading || refreshing;
  return (
    <div className="w-full h-full shadow shadow-primary bg-foreground-800 rounded-md p-3">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-white font-semibold text-4xl text-shadow-2xs text-shadow-primary">
          Listado de clientes
        </h4>
        <Button
          isLoading={isLoading}
          startContent={!isLoading ? <HiOutlineRefresh size={20} /> : undefined}
          color="primary"
          className="font-bold"
          onPress={refresh}
        >
          {loading && !refreshing
            ? "Cargando..."
            : refreshing && !loading
            ? "Actualizando"
            : "Actualizar"}
        </Button>
      </div>
      <FilterName onFilterChange={setFullnameFilter} />
      <ClientTable
        clients={filteredClients}
        isLoading={isLoading}
        noRowsLabel={
          fullnameFilter
            ? "No hay clientes que coincidan con la búsqueda"
            : "No hay clientes registrados"
        }
      />
    </div>
  );
};

export default ClientPage;
